/* =========================================================================
   GLÜCKSRAD – ANBINDUNG AN DEN revolutionSCREEN SENSOR HUB
   -------------------------------------------------------------------------
   Zweiter, optionaler Auslöse-Weg neben dem USB-Bewegungssensor:
   Der Sensor Hub (ESP32 mit mmWave-Radar) meldet über WLAN, wenn jemand vor
   das Display tritt.

   >>> Standardmässig AUS. Einschalten in config.js unter `sensorHub`. <<<

   Wichtig: Der bisherige Weg (USB-Sensor sendet Enter/Code 13) bleibt
   unverändert bestehen und funktioniert weiter. Beide Wege können gleichzeitig
   aktiv sein — app.js verhindert über `locked`/`state` ohnehin Doppel-Auslösungen.

   Ausgelöst wird über einen Klick auf den Seitenhintergrund. Den wertet app.js
   bereits als Auslöser aus (`trigger('Tap/Klick')`), inklusive Cooldown,
   Attract-Ende und Watchdog. So bleibt `js/app.js` unangetastet.
   ========================================================================= */
(function () {
  'use strict';

  var CFG = window.GLUECKSRAD_CONFIG || {};
  var HUB = CFG.sensorHub || {};

  if (!HUB.enabled) return;                       // nichts tun, wenn nicht eingeschaltet

  if (typeof window.SensorHub !== 'function') {
    console.warn('[Hub] js/sensorhub.js fehlt – Anbindung übersprungen.');
    return;
  }

  var log = function (t) { if (CFG.behavior && CFG.behavior.debug) console.log('[Hub] ' + t); };

  // Sperrzeit an den Ablauf des Rads koppeln: erst wenn Drehung und Overlay
  // durch sind, darf der nächste Besucher auslösen.
  var b = CFG.behavior || {};
  var sperre = HUB.sperrzeitMs ||
               ((b.spinDurationMs || 8000) + (b.overlayAutoCloseMs || 15000) + 2000);

  var hub = new window.SensorHub({
    host:       HUB.host || 'sensorhub.local',
    sperrzeit:  sperre,
    abwesendAb: HUB.abwesendAbMs || 3000,
    protokoll:  !!(b.debug)
  });

  hub.beiAnnaeherung(function (distanz) {
    // Zu weit weg? Dann noch nicht drehen — verhindert Auslösen durch
    // Personen, die nur vorbeilaufen. 0 = beliebige Distanz.
    var max = HUB.maxDistanzM || 0;
    if (max > 0 && distanz !== null && distanz > max) {
      log('ignoriert, ' + distanz.toFixed(2) + ' m > ' + max + ' m');
      return;
    }
    log('Annäherung' + (distanz !== null ? ' auf ' + distanz.toFixed(2) + ' m' : '') + ' → Rad dreht');
    // Denselben Weg nutzen wie ein Tap aufs Display.
    if (document.body) document.body.click();
  });

  hub.beiVerbindung(function (an) {
    log(an ? 'verbunden mit ' + (HUB.host || 'sensorhub.local') : 'getrennt – versuche erneut');
  });

  hub.start();
  log('Anbindung aktiv, Hub = ' + (HUB.host || 'sensorhub.local'));

  // Für Diagnose am Display von der Konsole aus erreichbar.
  window.GLUECKSRAD_HUB = hub;
})();
