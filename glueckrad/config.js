/* =========================================================================
   GLÜCKSRAD – ZENTRALE KONFIGURATION  ·  Instanz: BRÜESCH Gestaltungstechnik AG
   -------------------------------------------------------------------------
   Aktion: Gewerbeausstellung (Messe). Ziel-Display: Samsung Signage im
   Querformat mit USB-Bewegungssensor (näher treten = Enter/Code 13 = Rad dreht).
   Alles Kundenspezifische steht in DIESER Datei – kein Eingriff in js/app.js.
   Marken-Grün aus dem Logo: Dunkelgrün #2E7D33 · Mittelgrün #69A756 · Hellgrün #88BF67.
   ========================================================================= */
window.GLUECKSRAD_CONFIG = {

  /* ---- Branding / Design ------------------------------------------------ */
  brand: {
    logo:        'assets/images/bruesch-logo-weiss.png',  // Brüesch-Wortmarke (weisse Schrift) oben
    centerImage: 'assets/images/bruesch-mark.png',        // «B» in der Rad-Mitte (weisse Nabe)
    title:       'Das Brüesch Glücksrad',
    subtitle:    'Drehen Sie am Rad – und gewinnen Sie mit Brüesch',

    // Bühnen-Hintergrund (hinter dem Rad, füllt die Ränder) – dunkles Anthrazit-Grün
    background:  'radial-gradient(circle at 50% 12%, #223026 0%, #15191A 52%, #0C0F0E 100%)',

    // Keine animierte Szene (OceanPilot-spezifisch) – nur ruhiger Farbverlauf.
    backgroundScene: '',
    backgroundVideo: '',

    textColor:       '#FFFFFF',   // Titel/Untertitel/Hinweis – weiss auf dunklem Grund
    accentColor:     '#88BF67',   // Akzent (Overlay-Rand, Trennstrich, markiertes Segment) = Hellgrün
    centerBackground:'#FFFFFF',   // Rad-Nabe weiss, damit das grüne «B» sauber steht
    markerColor:     '#88BF67'    // Zeiger oben – Hellgrün, sichtbar auf dem dunklen Rad
  },

  /* ---- Rad-Segmente ------------------------------------------------------
     >>> PREISE ÄNDERN am einfachsten in der Datei `preise.txt` (Klartext)! <<<
     Das Rad liest beim Laden `preise.txt`; die folgende Liste dient nur als
     SICHERUNG (falls preise.txt fehlt oder lokal per Doppelklick geöffnet wird).
     Ergebnis ist ECHT ZUFÄLLIG und gleichverteilt über alle Segmente.
     Farben wechseln Grün ↔ Anthrazit (wie die Brüesch-Website) für Kontrast;
     weisse Segment-Schrift bleibt auf beiden gut lesbar.
     win:true = Gewinn (QR zur Lead-Erfassung), win:false = Niete.
     qr = Einlöse-URL oder null.                                             */
  segments: [
    { id:'a', name:'Hauptpreis<br>Kinogutschein', color:'#2E7D33', win:true, hauptpreis:true,
      prize:'Hauptpreis CHF 100.– Kinogutschein',
      note:'Der Gutschein wird am Stand übergeben. Es wird keine Korrespondenz geführt.',
      mengen:{ '5':1, '6':1, '0':1 },                               qr:null },
    { id:'b', name:'Kugel-<br>schreiber',         color:'#23272A', win:true,
      prize:'Ein Brüesch-Kugelschreiber',
      mengen:{ '5':100, '6':200, '0':100 },                         qr:null },
    { id:'c', name:'Trinkflasche',                color:'#2E7D33', win:true,
      prize:'Eine Brüesch-Trinkflasche in Grün',
      mengen:{ '5':50, '6':100, '0':50 },                           qr:null },
    { id:'d', name:'GreenTEA',                    color:'#23272A', win:true,
      prize:'Ein GreenTEA',
      mengen:null,                                                  qr:null },
    { id:'e', name:'Kühl-/Wärme-<br>Pad',        color:'#2E7D33', win:true,
      prize:'Ein Kühl-/Wärme-Pad',
      mengen:{ '5':50, '6':100, '0':50 },                           qr:null },
    { id:'f', name:'Auf ein<br>neues Glück',      color:'#23272A', win:false,
      prize:null,                                                   qr:null }
  ],

  /* ---- Ausspiel-Steuerung (Kontingente + Streckung über die Öffnungszeit)
     Die STÜCKZAHLEN je Artikel stehen bei den Segmenten oben bzw. – einfacher
     zu pflegen – in `preise.txt`. Hier stehen nur die Rahmenbedingungen.
     Schlüssel der Wochentage: 0 = Sonntag, 5 = Freitag, 6 = Samstag.          */
  ausspielung: {
    enabled: true,

    // Öffnungszeiten der Gewerbeausstellung – darüber wird die Warenmenge
    // gleichmässig gestreckt, damit am Abend noch etwas da ist.
    tage: {
      '5': { von: '17:00', bis: '21:00' },   // Freitag
      '6': { von: '10:00', bis: '21:00' },   // Samstag
      '0': { von: '10:00', bis: '17:00' }    // Sonntag
    },

    // HAUPTPREIS (Kinogutschein CHF 100.–, einer pro Tag):
    // Er ist für die ersten 150 Drehungen des Tages GESPERRT und kann damit
    // frühestens beim 151. Klick auf den Buzzer fallen.
    hauptpreisAbKlick: 150,

    // Chance je Klick, sobald die Sperre vorbei ist. 0.2 = jeder fünfte Klick,
    // der Gutschein fällt also im Schnitt fünf Klicks nach der Sperre – mal
    // früher, mal später. So kann niemand mitzählen, wann er dran ist.
    // (1 = sofort beim ersten Zug nach dem 150. Klick.)
    // Kommen an einem Tag weniger als 151 Klicks zusammen, wird an diesem Tag
    // KEIN Gutschein ausgespielt – so gewollt.
    hauptpreisChance: 0.2,

    // Nur noch informativ: erwartete Teilnehmer pro Messetag.
    teilnehmerProTag: 150,

    // Anteil der Drehungen, die unabhängig vom Bestand eine Niete ergeben.
    // 0.10 = etwa jede zehnte Drehung. Auf 0 setzen, wenn jeder etwas gewinnen soll.
    nietenAnteil: 0.10,

    // Wie weit die Ausgabe dem Zeitplan vorauslaufen darf, bevor gebremst wird
    // (Anteil der Tagesmenge). 0.15 = 15 %. Grösser = lockerer, kleiner = strenger.
    streckPuffer: 0.15,

    // Gewicht für Artikel OHNE Mengenbegrenzung (Trostpreis GreenTEA).
    // Zum Vergleich: Kugelschreiber wiegt am Samstag 200, Trinkflasche 100.
    gewichtUnbegrenzt: 50,

    /* ---- Abgleich mit dem Google Sheet ---------------------------------
       Jeder ausgespielte Gewinn wird zusätzlich ins Blatt „Ausgaben" des
       Sheets geschrieben, und beim Start (sowie alle paar Minuten) holt sich
       das Rad den Tagesstand von dort zurück.

       >>> Damit beginnt die Zählung NICHT bei null, wenn das Display neu
           startet oder sein Browser-Speicher geleert wird. <<<

       Fällt das Netz aus, läuft alles unverändert mit der lokalen Zählung
       weiter – das Rad wartet nie auf das Sheet.
       `scriptUrl` ist dieselbe Web-App wie bei `lead.scriptUrl`; das Script
       im Sheet muss dafür in der aktuellen Fassung bereitgestellt sein
       (google-apps-script.gs, siehe README Abschnitt 5).                    */
    online: {
      enabled:    true,
      scriptUrl:  'https://script.google.com/macros/s/AKfycbyQ076w0zb5L0jh1DZRNPZP3V3ZBhIti5fGCZpOoGAbT7WxcD64RoUQthMSxnsDPgBx/exec',
      geraet:     'Display Messestand',   // erscheint im Sheet, falls mehrere Räder laufen
      zeitlimitMs: 6000,                  // danach gilt einfach der lokale Stand
      abgleichAlleMs: 180000              // Leerlauf-Abgleich alle 3 Minuten
    }
  },

  /* ---- Ergebnis-Texte (Overlay) – Sie-Form (Gewerbeausstellung) --------- */
  messages: {
    cta:        'Drücken Sie den Buzzer',
    winTitle:   'Gewonnen!',
    winText:    'Ihr Gewinn:',
    loseTitle:  'Auf ein neues Glück!',
    loseText:   'Diesmal leider nichts – gleich nochmals drehen!',
    qrHint:     'Scannen & Gewinn am Stand abholen',
    countdown:  'Noch {s} Sekunden'      // {s} = verbleibende Sekunden
  },

  /* ---- Lead-Formular (QR bei Gewinn -> Handy-Formular -> Google Sheet) ---
     Solange scriptUrl leer ist, wird KEIN QR gezeigt – der Gewinn wird dann
     einfach am Stand abgeholt. Für echte Lead-Erfassung: eigenes Brüesch-
     Google-Sheet + Apps-Script anlegen (README Abschnitt 4) und scriptUrl setzen. */
  lead: {
    enabled:  true,
    formUrl:  'https://revolutionscreen-web.github.io/bruesch/glueckrad/form.html',
    scriptUrl: 'https://script.google.com/macros/s/AKfycbyQ076w0zb5L0jh1DZRNPZP3V3ZBhIti5fGCZpOoGAbT7WxcD64RoUQthMSxnsDPgBx/exec'
  },

  /* ---- Verhalten / Bewegungssensor -------------------------------------- */
  behavior: {
    triggerKeyCode:    13,     // Taste des Bewegungssensors (13 = Enter)
    cooldownMs:        12000,  // Sperre nach Auslösung (Doppel-Trigger-Schutz)
    spinDurationMs:    8000,   // Dauer einer Drehung
    overlayAutoCloseMs:15000,  // GEWINN-Overlay (mit QR) bleibt so lange + Countdown
    loseAutoCloseMs:   3000,   // NIETE-Overlay kurz zeigen -> schnell wieder drehen
    idleWatchdogMs:    40000,  // Notbremse zurück in Bereitschaft (> Dreh + Overlay)
    attractMode:       true,   // Rad dreht im Leerlauf langsam als Blickfang
    sound:             true,   // Tick-Sound beim Drehen
    debug:             false   // true = Debug-Log am Bildschirm
  },

  /* ---- Sensor Hub (optional, zweiter Auslöse-Weg) ------------------------
     Statt (oder zusätzlich zum) USB-Bewegungssensor kann der revolutionSCREEN
     Sensor Hub das Rad auslösen: ein ESP32 mit mmWave-Radar, der übers WLAN
     meldet, wenn jemand vor das Display tritt.

     >>> enabled: false = ausgeschaltet. Der USB-Sensor (Enter/Code 13) läuft
         unverändert weiter. Beide Wege dürfen gleichzeitig aktiv sein. <<<

     Zum Einschalten: enabled auf true und `host` auf die Adresse des Hubs.
     Am Display ist die feste IP zuverlässiger als 'sensorhub.local', weil
     nicht jeder Player mDNS auflöst. Die IP steht in der Weboberfläche des
     Hubs oder auf dessen serieller Konsole.

     ⚠ Der Hub spricht http/ws. Wird diese Seite über https ausgeliefert,
       blockiert der Browser die Verbindung (Mixed Content) – die Seite dann
       per http oder lokal vom Player ausliefern.                            */
  sensorHub: {
    enabled:       false,               // <<< true = Hub-Auslösung einschalten
    host:          '192.168.1.121',     // IP oder 'sensorhub.local'
    maxDistanzM:   0,                   // nur auslösen bis zu dieser Distanz (0 = egal)
    abwesendAbMs:  3000,                // ms ohne Präsenz, bis wieder "frei" gilt
    sperrzeitMs:   0                    // 0 = automatisch (Drehung + Overlay + Puffer)
  },

  /* ---- Layout ----------------------------------------------------------- */
  layout: {
    wheelSize: 800   // Basisgrösse des Rads in px (skaliert responsiv)
  }
};
