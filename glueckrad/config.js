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
    { id:'a', name:'Hauptpreis<br>CHF 500.–',     color:'#2E7D33', win:true,
      prize:'Teilnahme an der Verlosung: CHF 500.– an eine Fahrzeugbeschriftung',
      note:'Die Verlosung findet nach der Messe statt. Es wird keine Korrespondenz geführt. Der Gewinner wird persönlich benachrichtigt.',
      qr:null },
    { id:'b', name:'Popcorn',                     color:'#23272A', win:true,
      prize:'Frisches Popcorn zum Mitnehmen',                       qr:null },
    { id:'c', name:'GreenPower<br>Drink',         color:'#2E7D33', win:true,
      prize:'Ein GreenPower Drink',                                 qr:null },
    { id:'d', name:'GreenKey',                    color:'#23272A', win:true,
      prize:'Ein GreenKey',                                         qr:null },
    { id:'e', name:'Auf ein<br>neues Glück',      color:'#23272A', win:false,
      prize:null,                                                   qr:null }
  ],

  /* ---- Ergebnis-Texte (Overlay) – Sie-Form (Gewerbeausstellung) --------- */
  messages: {
    cta:        'Näher treten – das Rad dreht von selbst',
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

  /* ---- Layout ----------------------------------------------------------- */
  layout: {
    wheelSize: 800   // Basisgrösse des Rads in px (skaliert responsiv)
  }
};
