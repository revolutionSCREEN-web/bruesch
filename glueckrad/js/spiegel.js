/* =========================================================================
   RADSPIEGEL (Client)  ·  Brüesch Glücksrad
   -------------------------------------------------------------------------
   Überträgt die Drehungen vom Anzeigegerät am Stand auf weitere Bildschirme
   (z. B. einen Beamer), damit dort dieselbe Drehung gleichzeitig läuft.

     Anzeige am Stand   index.html                 → sendet
     Beamer / Zweitbild index.html?zuschauer=1     → empfängt, keine Bedienung

   Grundregel: Das Rad am Stand darf davon NIE abhängen. Es wird nur gesendet
   und nie auf eine Antwort gewartet; fällt Netz oder Dienst aus, dreht das
   Rad unverändert weiter und der Beamer bleibt stehen, bis es wieder geht.

   Alles in ES5 – der Tizen-Browser des Samsung-Displays ist Chromium 56.
   ========================================================================= */
(function (global) {
  'use strict';

  var ZUSCHAUER = String(global.location.search || '').indexOf('zuschauer=1') !== -1;

  var ws = null;                 // aktuelle Verbindung
  var offen = false;
  var versuche = 0;
  var neuTimer = null, pingTimer = null;
  var beiNachricht = null;       // Rückruf im Zuschauer-Modus
  var beiStatus = null;          // Rückruf für die Anzeige «verbunden / getrennt»
  var protokoll = function () {};

  function konfig(CFG) {
    var s = CFG && CFG.spiegel;
    return (s && s.enabled && s.wsUrl) ? s : null;
  }

  function adresse(s) {
    return s.wsUrl +
      (s.wsUrl.indexOf('?') < 0 ? '?' : '&') +
      'raum=' + encodeURIComponent(s.raum || 'bruesch') +
      '&rolle=' + (ZUSCHAUER ? 'zuschauer' : 'display');
  }

  function melde(zustand) {
    if (beiStatus) { try { beiStatus(zustand); } catch (e) {} }
  }

  function verbinde(CFG) {
    var s = konfig(CFG);
    if (!s || !global.WebSocket) return;

    try {
      ws = new global.WebSocket(adresse(s));
    } catch (e) {
      protokoll('Spiegel: Verbindung nicht möglich – ' + e.message);
      planeNeuversuch(CFG);
      return;
    }

    ws.onopen = function () {
      offen = true;
      versuche = 0;
      protokoll('Spiegel verbunden (' + (ZUSCHAUER ? 'Zuschauer' : 'Anzeige am Stand') + ')');
      melde('verbunden');
      // Das Display hält die Leitung wach – manche WLAN-Router kappen sonst
      // eine Verbindung, über die lange nichts läuft. Der Ping geht an die
      // Zuschauer weiter und zeigt denen zugleich: der Stand ist da.
      if (!ZUSCHAUER) {
        clearInterval(pingTimer);
        pingTimer = setInterval(function () { sende({ typ: 'ping' }); }, 30000);
      }
    };

    ws.onmessage = function (ev) {
      if (!ZUSCHAUER) return;                       // die Anzeige hört nicht zu
      var daten = null;
      try { daten = JSON.parse(ev.data); } catch (e) { return; }
      if (!daten || !daten.typ) return;
      if (daten.typ === 'ping') { melde('verbunden'); return; }
      if (beiNachricht) { try { beiNachricht(daten); } catch (e) {} }
    };

    ws.onclose = function () {
      offen = false;
      clearInterval(pingTimer);
      melde('getrennt');
      planeNeuversuch(CFG);
    };

    ws.onerror = function () { /* onclose räumt auf */ };
  }

  // Immer wieder versuchen, aber mit wachsendem Abstand (2 s … 20 s).
  function planeNeuversuch(CFG) {
    var s = konfig(CFG);
    if (!s) return;
    clearTimeout(neuTimer);
    versuche++;
    var wartezeit = Math.min(20000, 2000 * versuche);
    protokoll('Spiegel getrennt – neuer Versuch in ' + Math.round(wartezeit / 1000) + ' s');
    neuTimer = setTimeout(function () { verbinde(CFG); }, wartezeit);
  }

  /* --- Senden (nur die Anzeige am Stand) --------------------------------
     Bewusst ohne Rückmeldung und in try/catch: Ein Problem hier darf die
     Drehung am Stand niemals aufhalten.                                   */
  function sende(daten) {
    if (ZUSCHAUER || !offen || !ws) return;
    try { ws.send(JSON.stringify(daten)); } catch (e) {}
  }

  global.Radspiegel = {
    istZuschauer: function () { return ZUSCHAUER; },
    start: function (CFG, opt) {
      opt = opt || {};
      beiNachricht = opt.beiNachricht || null;
      beiStatus    = opt.beiStatus || null;
      protokoll    = opt.protokoll || function () {};
      if (!konfig(CFG)) {
        if (ZUSCHAUER) protokoll('Spiegel ist in config.js nicht eingeschaltet');
        return false;
      }
      verbinde(CFG);
      return true;
    },
    // Wird bei jeder Drehung am Stand aufgerufen. `feld` dient nur der
    // Sicherheit: Der Zuschauer prüft damit, ob er dieselbe Preisliste hat.
    sendeDrehung: function (idx, feld) {
      sende({ typ: 'dreh', idx: idx, feld: feld || '' });
    },
    verbunden: function () { return offen; }
  };

})(window);
