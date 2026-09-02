/* =========================================================================
   AUSSPIEL-STEUERUNG  ·  Brüesch Glücksrad
   -------------------------------------------------------------------------
   Bestimmt VOR jeder Drehung, welches Feld gewinnen darf. Das Rad dreht
   anschliessend gezielt dorthin (js/app.js). Damit gilt:

   1) KONTINGENT   Jeder Artikel hat eine Tagesmenge (Fr/Sa/So). Ist sie
                   aufgebraucht, kommt der Artikel an diesem Tag nicht mehr.
   2) STRECKUNG    Die Menge wird über die Öffnungszeit verteilt. Das Rad
                   rechnet laufend, wie viel zum aktuellen Zeitpunkt "dran"
                   wäre (Soll). Liegt die Ausgabe vor dem Plan, kommt eine
                   Niete – so reicht die Ware bis Messeschluss.
   3) GEWICHTUNG   Gezogen wird gewichtet nach RESTmenge. Der Kugelschreiber
                   (doppelte Menge) gewinnt damit doppelt so oft wie die
                   Trinkflasche – ohne zweimal auf dem Rad zu stehen. Weil die
                   Restmenge sinkt, regelt sich das Verhältnis von selbst nach.
   4) HAUPTPREIS   Genau 1 pro Tag. Die Chance je Dreh richtet sich nach der
                   erwarteten Zahl verbleibender Teilnehmer, damit er über den
                   Tag verteilt und zuverlässig einmal ausgespielt wird.

   Gezählt wird im localStorage des Anzeigegeräts, getrennt je Datum. Um
   Mitternacht (bzw. am nächsten Messetag) beginnt die Zählung von vorn.
   Alles läuft ohne Server und ohne Netz.
   ========================================================================= */
(function (global) {
  'use strict';

  var SPEICHER_KEY = 'bruesch-gluecksrad-ausspielung-v1';

  /* --- Hilfsfunktionen -------------------------------------------------- */

  // "17:00" -> Minuten seit Mitternacht
  function zeitInMinuten(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  // Datum als YYYY-MM-DD (lokale Zeit, nicht UTC – sonst kippt der Tag um 02:00)
  function datumsSchluessel(d) {
    function zwei(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + zwei(d.getMonth() + 1) + '-' + zwei(d.getDate());
  }

  // Rad-Text -> stabiler Schlüssel für die Zählung ("Kugel-<br>schreiber" -> "kugelschreiber")
  function schluessel(segment) {
    var basis = segment.key || segment.name || segment.prize || '';
    return String(basis)
      .replace(/<[^>]+>/g, '')          // HTML-Umbrüche raus
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /* --- Bestand (localStorage, je Datum) --------------------------------- */

  function ladeBestand(heute) {
    var leer = { datum: heute, ausgegeben: {}, drehungen: 0 };
    try {
      var roh = global.localStorage.getItem(SPEICHER_KEY);
      if (!roh) return leer;
      var daten = JSON.parse(roh);
      if (!daten || daten.datum !== heute) return leer;   // neuer Tag = neue Zählung
      daten.ausgegeben = daten.ausgegeben || {};
      daten.drehungen  = daten.drehungen || 0;
      return daten;
    } catch (e) { return leer; }
  }

  function speichereBestand(daten) {
    try { global.localStorage.setItem(SPEICHER_KEY, JSON.stringify(daten)); } catch (e) {}
  }

  /* --- Tagesplan: Öffnungszeit + Mengen für den aktuellen Wochentag ------ */

  function tagesplan(cfg, jetzt) {
    var a = cfg.ausspielung || {};
    var tage = a.tage || {};
    return tage[String(jetzt.getDay())] || null;   // 0 = Sonntag … 5 = Freitag, 6 = Samstag
  }

  // Anteil der Öffnungszeit, der bereits vorbei ist (0 = Türöffnung, 1 = Messeschluss)
  function zeitanteil(plan, jetzt) {
    var von = zeitInMinuten(plan.von), bis = zeitInMinuten(plan.bis);
    if (von === null || bis === null || bis <= von) return 1;
    var jetztMin = jetzt.getHours() * 60 + jetzt.getMinutes() + jetzt.getSeconds() / 60;
    var anteil = (jetztMin - von) / (bis - von);
    return Math.max(0, Math.min(1, anteil));
  }

  /* --- Tagesmenge eines Segments ----------------------------------------
     segment.mengen = { '5': 50, '6': 100, '0': 50 }  (Wochentag -> Stück)
     null/undefined = unbegrenzt (z. B. GreenTEA, Niete)                    */
  function tagesmenge(segment, jetzt) {
    if (!segment.mengen) return null;
    var m = segment.mengen[String(jetzt.getDay())];
    return (typeof m === 'number' && isFinite(m)) ? m : null;
  }

  /* =======================================================================
     KERN: Welches Segment darf gewinnen?
     Liefert den Index in cfg.segments.
     ======================================================================= */
  function ziehe(cfg, jetztOpt) {
    var jetzt = jetztOpt || new Date();
    var a     = cfg.ausspielung || {};
    var segs  = cfg.segments || [];
    var heute = datumsSchluessel(jetzt);
    var stand = ladeBestand(heute);

    // Nieten-Felder (win:false) – auf eines davon fällt jede nicht gewonnene Drehung
    var nietenIdx = [];
    for (var n = 0; n < segs.length; n++) if (!segs[n].win) nietenIdx.push(n);
    function niete() {
      if (!nietenIdx.length) return -1;
      return nietenIdx[Math.floor(Math.random() * nietenIdx.length)];
    }

    // Steuerung aus? Dann rein zufällig über alle Felder (Verhalten wie früher).
    if (a.enabled === false) return Math.floor(Math.random() * segs.length);

    var plan = tagesplan(cfg, jetzt);
    if (!plan) {
      // Kein Messetag hinterlegt (z. B. Testlauf am Mittwoch): alles erlaubt,
      // aber nichts wird vom Kontingent abgebucht.
      return Math.floor(Math.random() * segs.length);
    }

    var anteil = zeitanteil(plan, jetzt);

    /* --- 1) Grundrauschen Niete ---------------------------------------- */
    var nietenAnteil = (typeof a.nietenAnteil === 'number') ? a.nietenAnteil : 0;
    if (nietenAnteil > 0 && Math.random() < nietenAnteil) return niete();

    /* --- 2) Hauptpreis: genau 1 pro Tag, über den Tag verteilt ---------- */
    var erwartet = a.teilnehmerProTag || 150;
    for (var h = 0; h < segs.length; h++) {
      var s = segs[h];
      if (!s.win || !s.hauptpreis) continue;
      var mengeH = tagesmenge(s, jetzt);
      if (mengeH === null) mengeH = 1;
      var rausH = stand.ausgegeben[schluessel(s)] || 0;
      if (rausH >= mengeH) break;                       // heute schon vergeben
      // Erwartete Zahl noch kommender Teilnehmer; je weniger übrig, desto höher die Chance.
      var restTeilnehmer = Math.max(1, Math.round(erwartet * (1 - anteil)));
      var chance = (mengeH - rausH) / restTeilnehmer;
      if (Math.random() < chance) return h;
      break;
    }

    /* --- 3) Sachpreise: Kontingent + Streckung + Gewichtung ------------- */
    var pool = [], summe = 0;
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (!seg.win || seg.hauptpreis) continue;

      var menge = tagesmenge(seg, jetzt);
      var raus  = stand.ausgegeben[schluessel(seg)] || 0;
      var gewicht;

      if (menge === null) {
        // Unbegrenzt (GreenTEA): festes Gewicht, damit es nicht alles dominiert.
        gewicht = seg.gewicht || a.gewichtUnbegrenzt || 50;
      } else {
        if (raus >= menge) continue;                    // ausverkauft
        // Streckung: Der Artikel wird erst geschont, wenn die Ausgabe dem
        // Zeitplan DEUTLICH voraus ist. Der Puffer sorgt dafür, dass die Bremse
        // bei normalem Andrang gar nicht greift (und das Mengenverhältnis
        // unverfälscht bleibt), bei Ansturm aber zuverlässig die Ware schützt.
        var soll   = menge * anteil;
        var puffer = Math.max(5, menge * (a.streckPuffer || 0.15));
        if (raus >= soll + puffer) continue;
        // Gewicht = RESTmenge: anfangs im Verhältnis der Kontingente (Kugi doppelt),
        // und selbstregulierend – was schon viel raus ist, wiegt weniger.
        gewicht = seg.gewicht || (menge - raus);
      }
      if (gewicht <= 0) continue;
      pool.push({ idx: i, gewicht: gewicht });
      summe += gewicht;
    }

    if (!pool.length || summe <= 0) return niete();     // nichts "dran" -> Niete

    var wurf = Math.random() * summe;
    for (var k = 0; k < pool.length; k++) {
      if (wurf < pool[k].gewicht) return pool[k].idx;
      wurf -= pool[k].gewicht;
    }
    return pool[pool.length - 1].idx;
  }

  /* --- Ausgabe verbuchen (nach der Drehung aufrufen) --------------------- */
  function verbuche(cfg, index, jetztOpt) {
    var jetzt = jetztOpt || new Date();
    var segs  = cfg.segments || [];
    var seg   = segs[index];
    var heute = datumsSchluessel(jetzt);
    var stand = ladeBestand(heute);
    stand.datum = heute;
    stand.drehungen = (stand.drehungen || 0) + 1;
    if (seg && seg.win && tagesplan(cfg, jetzt)) {
      var k = schluessel(seg);
      stand.ausgegeben[k] = (stand.ausgegeben[k] || 0) + 1;
    }
    speichereBestand(stand);
    return stand;
  }

  // "Kugel-<br>schreiber" -> "Kugelschreiber", "Auf ein<br>neues Glück" -> "Auf ein neues Glück"
  function lesbarerName(name) {
    return String(name || '')
      .replace(/-\s*<br\s*\/?>/gi, '-')      // Trennstrich: ohne Leerzeichen verbinden
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ').trim();
  }

  /* --- Übersicht für die Admin-Seite ------------------------------------ */
  function uebersicht(cfg, jetztOpt) {
    var jetzt = jetztOpt || new Date();
    var plan  = tagesplan(cfg, jetzt);
    var stand = ladeBestand(datumsSchluessel(jetzt));
    var anteil = plan ? zeitanteil(plan, jetzt) : null;
    var zeilen = [];
    var segs = cfg.segments || [];
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i];
      if (!s.win) continue;
      var menge = tagesmenge(s, jetzt);
      var raus  = stand.ausgegeben[schluessel(s)] || 0;
      // Ohne Messetag (z. B. beim Einrichten unter der Woche) die geplanten
      // Mengen aller drei Tage zeigen statt "unbegrenzt".
      var geplant = null;
      if (menge === null && s.mengen) {
        geplant = [s.mengen['5'], s.mengen['6'], s.mengen['0']]
          .map(function (v) { return (typeof v === 'number') ? v : '–'; }).join(' / ');
      }
      zeilen.push({
        name:   lesbarerName(s.name),
        geplant: geplant,
        key:    schluessel(s),
        menge:  menge,
        raus:   raus,
        rest:   menge === null ? null : Math.max(0, menge - raus),
        soll:   (menge === null || anteil === null) ? null : Math.round(menge * anteil)
      });
    }
    return {
      datum: stand.datum, drehungen: stand.drehungen || 0,
      plan: plan, zeitanteil: anteil, zeilen: zeilen
    };
  }

  function zuruecksetzen() {
    try { global.localStorage.removeItem(SPEICHER_KEY); } catch (e) {}
  }

  global.Ausspielung = {
    ziehe: ziehe,
    verbuche: verbuche,
    uebersicht: uebersicht,
    zuruecksetzen: zuruecksetzen,
    _intern: { schluessel: schluessel, zeitanteil: zeitanteil, tagesplan: tagesplan,
               tagesmenge: tagesmenge, ladeBestand: ladeBestand, datumsSchluessel: datumsSchluessel }
  };

})(window);
