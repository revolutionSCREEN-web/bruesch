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

    /* --- 2) Hauptpreis: 1 pro Tag, FRÜHESTENS nach dem N-ten Klick -------
       `hauptpreisAbKlick` (Standard 150) sperrt den Gutschein für die ersten
       N Drehungen des Tages. `stand.drehungen` zählt die bereits erfolgten
       Drehungen, die laufende ist also die (drehungen+1)-te: Bei 150 kann er
       damit frühestens beim 151. Klick fallen.
       Danach entscheidet `hauptpreisChance` je Klick (1 = sofort beim ersten
       Zug nach der Sperre, 0.1 = im Schnitt nach zehn weiteren Klicks).    */
    var abKlick   = (typeof a.hauptpreisAbKlick === 'number') ? a.hauptpreisAbKlick : 0;
    var hpChance  = (typeof a.hauptpreisChance === 'number') ? a.hauptpreisChance : 1;
    var klicks    = stand.drehungen || 0;
    for (var h = 0; h < segs.length; h++) {
      var s = segs[h];
      if (!s.win || !s.hauptpreis) continue;
      var mengeH = tagesmenge(s, jetzt);
      if (mengeH === null) mengeH = 1;
      var rausH = stand.ausgegeben[schluessel(s)] || 0;
      if (rausH >= mengeH) break;                       // heute schon vergeben
      if (klicks < abKlick) break;                      // Sperre noch aktiv
      if (Math.random() < hpChance) return h;
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
    // Zusätzlich ans Google Sheet. Bewusst gekapselt: Die lokale Zählung ist
    // führend und darf NIE an der Meldung scheitern.
    try { meldeAusgabe(cfg, seg, jetzt); } catch (e) {}
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

  /* =======================================================================
     ONLINE-ABGLEICH mit dem Google Sheet (optional, cfg.ausspielung.online)
     -----------------------------------------------------------------------
     Zweck: Der Tagesstand überlebt einen Neustart des Displays und ist auch
     von aussen sichtbar. Ohne diesen Abgleich beginnt die Zählung bei null,
     sobald der Browser-Speicher des Anzeigegeräts geleert wird.

     Beide Wege laufen über <script>-Abrufe (JSONP) statt fetch: Apps Script
     setzt keine CORS-Kopfzeilen, und ein Script-Tag funktioniert auch auf dem
     alten Tizen-Browser. Nichts davon blockiert das Rad – schlägt es fehl,
     zählt weiter die lokale Ablage.
     ======================================================================= */

  var laufendeNr = 0;
  // null = noch unbekannt · true = Sheet antwortet · false = antwortet nicht
  // (dann wird auch nichts gemeldet, bis ein Abgleich wieder klappt). So
  // entstehen keine Fehler im Dauerbetrieb, wenn das Script im Sheet noch
  // die alte Fassung ist oder das Netz fehlt.
  var onlineBereit = null;

  function onlineCfg(cfg) {
    var o = (cfg.ausspielung || {}).online;
    return (o && o.enabled && o.scriptUrl) ? o : null;
  }

  // JSONP-Abruf mit Zeitlimit; ruft `fertig(datenOderNull)` genau einmal auf.
  function jsonpAbruf(url, fertig, zeitlimit) {
    if (!global.document || !global.document.createElement) { fertig(null); return; }
    var name = '_radCb' + (++laufendeNr) + '_' + Math.floor(Math.random() * 1e6);
    var script = global.document.createElement('script');
    var erledigt = false;
    function schluss(daten) {
      if (erledigt) return;
      erledigt = true;
      try { delete global[name]; } catch (e) { global[name] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
      fertig(daten);
    }
    global[name] = function (daten) { schluss(daten); };
    script.src = url + (url.indexOf('?') < 0 ? '?' : '&') + 'callback=' + name;
    script.onerror = function () { schluss(null); };
    (global.document.body || global.document.documentElement).appendChild(script);
    global.setTimeout(function () { schluss(null); }, zeitlimit || 6000);
  }

  /* --- Eine Ausgabe ans Sheet melden (feuern und vergessen) ------------- */
  function meldeAusgabe(cfg, seg, jetzt) {
    var o = onlineCfg(cfg);
    if (!o || !seg || !seg.win) return;
    if (onlineBereit === false) return;              // Sheet antwortet gerade nicht
    var kennung = datumsSchluessel(jetzt) + '-' + (new Date()).getTime() + '-' +
                  Math.random().toString(36).slice(2, 7);
    var url = o.scriptUrl +
      (o.scriptUrl.indexOf('?') < 0 ? '?' : '&') +
      'art=ausgabe' +
      '&schluessel=' + encodeURIComponent(schluessel(seg)) +
      '&artikel='    + encodeURIComponent(lesbarerName(seg.name)) +
      '&datum='      + encodeURIComponent(datumsSchluessel(jetzt)) +
      '&geraet='     + encodeURIComponent(o.geraet || 'Display') +
      '&id='         + encodeURIComponent(kennung);
    jsonpAbruf(url, function () {}, 8000);      // Antwort interessiert nicht
  }

  /* --- Tagesstand aus dem Sheet holen und einrechnen -------------------
     Es gilt je Artikel der GRÖSSERE Wert aus Sheet und lokaler Ablage: So
     geht nach einem Neustart nichts verloren, und eine Meldung, die das Sheet
     nie erreicht hat, wird trotzdem nicht doppelt vergeben.               */
  function synchronisiere(cfg, fertig, jetztOpt) {
    var jetzt = jetztOpt || new Date();
    var o = onlineCfg(cfg);
    if (!o) { if (fertig) fertig(null); return; }
    var heute = datumsSchluessel(jetzt);
    var url = o.scriptUrl + (o.scriptUrl.indexOf('?') < 0 ? '?' : '&') +
              'stand=1&datum=' + encodeURIComponent(heute);
    jsonpAbruf(url, function (daten) {
      if (!daten || !daten.ausgegeben) {
        onlineBereit = false;                        // Meldungen aussetzen
        if (fertig) fertig(null);
        return;
      }
      onlineBereit = true;
      var stand = ladeBestand(heute);
      var geaendert = false;
      for (var k in daten.ausgegeben) {
        if (!Object.prototype.hasOwnProperty.call(daten.ausgegeben, k)) continue;
        var online = parseInt(daten.ausgegeben[k], 10) || 0;
        if (online > (stand.ausgegeben[k] || 0)) { stand.ausgegeben[k] = online; geaendert = true; }
      }
      if (geaendert) { stand.datum = heute; speichereBestand(stand); }
      if (fertig) fertig(daten);
    }, o.zeitlimitMs || 6000);
  }

  /* --- Stand eines beliebigen Tages abfragen (für die Admin-Seite) ------
     Verändert nichts, liefert nur die Zahlen aus dem Sheet.               */
  function standAusSheet(cfg, datum, fertig) {
    var o = onlineCfg(cfg);
    if (!o) { fertig(null); return; }
    var url = o.scriptUrl + (o.scriptUrl.indexOf('?') < 0 ? '?' : '&') +
              'stand=1&datum=' + encodeURIComponent(datum);
    jsonpAbruf(url, fertig, o.zeitlimitMs || 6000);
  }

  global.Ausspielung = {
    ziehe: ziehe,
    verbuche: verbuche,
    synchronisiere: synchronisiere,
    standAusSheet: standAusSheet,
    uebersicht: uebersicht,
    zuruecksetzen: zuruecksetzen,
    _intern: { schluessel: schluessel, zeitanteil: zeitanteil, tagesplan: tagesplan,
               tagesmenge: tagesmenge, ladeBestand: ladeBestand, datumsSchluessel: datumsSchluessel }
  };

})(window);
