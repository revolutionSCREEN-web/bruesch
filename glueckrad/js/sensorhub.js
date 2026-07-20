/*
 * revolutionSCREEN Sensor Hub — Player-Client
 * ===========================================
 * Verbindet eine Signage-Seite mit dem Sensor Hub. Ohne Abhaengigkeiten,
 * laeuft auf Tizen und Android-Playern.
 *
 *   const hub = new SensorHub();
 *   hub.beiAnnaeherung(() => radDrehen());     // jemand tritt heran
 *   hub.start();
 *
 * Ausgelegt auf Dauerbetrieb am Display. Das heisst konkret:
 *  - Verbindungsabbrueche werden automatisch geheilt (WLAN wackelt, Hub startet neu)
 *  - faellt der WebSocket aus, wird auf REST-Abfragen umgeschaltet, damit die
 *    Seite weiterlaeuft statt einzufrieren
 *  - "Annaeherung" wird entprellt und hat eine Sperrzeit, sonst loest ein
 *    Vorbeigehen die Aktion mehrfach aus
 *  - die Seite laeuft weiter, auch wenn der Hub gar nicht erreichbar ist
 */

(function (global) {
  'use strict';

  var VORGABE = {
    host: 'sensorhub.local',   // oder feste IP, z.B. '192.168.1.121'
    sperrzeit: 20000,          // ms, in denen nach einem Ausloesen nicht erneut ausgeloest wird
    abwesendAb: 3000,          // ms ohne Praesenz, bis wieder "frei" gilt (entprellt Aussetzer)
    neuVerbindenNach: 3000,    // ms bis zum naechsten Verbindungsversuch
    restIntervall: 2000,       // ms zwischen REST-Abfragen im Ersatzbetrieb
    protokoll: false           // true = Meldungen in die Browser-Konsole
  };

  function SensorHub(optionen) {
    var o = optionen || {};
    this.k = {};
    for (var s in VORGABE) this.k[s] = (o[s] !== undefined) ? o[s] : VORGABE[s];

    this.daten = null;          // letzter Datensatz vom Hub
    this.verbunden = false;
    this.anwesend = false;

    this._ws = null;
    this._restTimer = null;
    this._verbindeTimer = null;
    this._abwesendTimer = null;
    this._letztesAusloesen = 0;
    this._laeuft = false;
    this._horcher = { annaeherung: [], weggegangen: [], daten: [], verbindung: [] };
  }

  SensorHub.prototype._log = function () {
    if (!this.k.protokoll) return;
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[SensorHub]');
    console.log.apply(console, a);
  };

  SensorHub.prototype._melden = function (art, wert) {
    var liste = this._horcher[art] || [];
    for (var i = 0; i < liste.length; i++) {
      try { liste[i](wert, this.daten); }
      catch (e) { console.error('[SensorHub] Fehler im Horcher "' + art + '":', e); }
    }
  };

  // ---------- Anmeldung von Rueckrufen ----------
  SensorHub.prototype.beiAnnaeherung = function (fn) { this._horcher.annaeherung.push(fn); return this; };
  SensorHub.prototype.beiWeggehen   = function (fn) { this._horcher.weggegangen.push(fn); return this; };
  SensorHub.prototype.beiDaten      = function (fn) { this._horcher.daten.push(fn); return this; };
  SensorHub.prototype.beiVerbindung = function (fn) { this._horcher.verbindung.push(fn); return this; };

  // ---------- Verbindungszustand ----------
  SensorHub.prototype._setzeVerbindung = function (an) {
    if (this.verbunden === an) return;
    this.verbunden = an;
    this._log(an ? 'verbunden' : 'getrennt');
    this._melden('verbindung', an);
  };

  // ---------- Auswertung eines Datensatzes ----------
  SensorHub.prototype._verarbeite = function (d) {
    if (!d || typeof d !== 'object') return;
    this.daten = d;
    this._melden('daten', d);

    // presence kann null sein (Radar liefert gerade nichts) — das ist KEIN "frei".
    if (d.presence === null || d.presence === undefined) return;

    if (d.presence) {
      if (this._abwesendTimer) { clearTimeout(this._abwesendTimer); this._abwesendTimer = null; }
      if (!this.anwesend) {
        this.anwesend = true;
        var jetzt = Date.now();
        if (jetzt - this._letztesAusloesen >= this.k.sperrzeit) {
          this._letztesAusloesen = jetzt;
          this._log('Annaeherung', d.distance !== null ? d.distance + ' m' : '');
          this._melden('annaeherung', d.distance);
        } else {
          this._log('Annaeherung ignoriert (Sperrzeit laeuft)');
        }
      }
    } else if (this.anwesend && !this._abwesendTimer) {
      // Erst nach einer Weile "frei" melden — der Radar hat gelegentlich Aussetzer,
      // und ein kurzes Flackern soll die laufende Anzeige nicht abbrechen.
      var selbst = this;
      this._abwesendTimer = setTimeout(function () {
        selbst._abwesendTimer = null;
        selbst.anwesend = false;
        selbst._log('weggegangen');
        selbst._melden('weggegangen');
      }, this.k.abwesendAb);
    }
  };

  // ---------- WebSocket ----------
  SensorHub.prototype._wsVerbinden = function () {
    var selbst = this;
    if (!this._laeuft) return;

    try {
      this._ws = new WebSocket('ws://' + this.k.host + '/ws');
    } catch (e) {
      this._log('WebSocket nicht moeglich:', e.message);
      this._aufRestUmschalten();
      return;
    }

    this._ws.onopen = function () {
      selbst._log('WebSocket offen');
      selbst._restStoppen();
      selbst._setzeVerbindung(true);
    };

    this._ws.onmessage = function (e) {
      try { selbst._verarbeite(JSON.parse(e.data)); }
      catch (err) { selbst._log('unlesbare Nachricht'); }
    };

    this._ws.onclose = function () {
      selbst._setzeVerbindung(false);
      selbst._ws = null;
      if (!selbst._laeuft) return;
      // Bis der WebSocket wieder steht, per REST weiterarbeiten.
      selbst._aufRestUmschalten();
      selbst._verbindeTimer = setTimeout(function () { selbst._wsVerbinden(); },
                                         selbst.k.neuVerbindenNach);
    };

    this._ws.onerror = function () { /* onclose folgt und uebernimmt */ };
  };

  // ---------- REST als Ersatzbetrieb ----------
  SensorHub.prototype._aufRestUmschalten = function () {
    if (this._restTimer || !this._laeuft) return;
    var selbst = this;
    this._log('Ersatzbetrieb ueber REST');
    var holen = function () {
      selbst._holeStatus(function (ok) { if (ok) selbst._setzeVerbindung(true); });
    };
    holen();
    this._restTimer = setInterval(holen, this.k.restIntervall);
  };

  SensorHub.prototype._restStoppen = function () {
    if (this._restTimer) { clearInterval(this._restTimer); this._restTimer = null; }
  };

  SensorHub.prototype._holeStatus = function (fertig) {
    var selbst = this;
    var a = new XMLHttpRequest();                     // XHR statt fetch: aeltere Tizen-Player
    a.open('GET', 'http://' + this.k.host + '/api/v1/status?t=' + Date.now(), true);
    a.timeout = 4000;
    a.onload = function () {
      if (a.status < 200 || a.status >= 300) { if (fertig) fertig(false); return; }
      try { selbst._verarbeite(JSON.parse(a.responseText)); if (fertig) fertig(true); }
      catch (e) { if (fertig) fertig(false); }
    };
    a.onerror = a.ontimeout = function () {
      selbst._setzeVerbindung(false);
      if (fertig) fertig(false);
    };
    a.send();
  };

  // ---------- Steuerung ----------
  SensorHub.prototype.start = function () {
    if (this._laeuft) return this;
    this._laeuft = true;
    this._log('Start, Hub =', this.k.host);
    this._wsVerbinden();
    return this;
  };

  SensorHub.prototype.stop = function () {
    this._laeuft = false;
    if (this._verbindeTimer) { clearTimeout(this._verbindeTimer); this._verbindeTimer = null; }
    if (this._abwesendTimer) { clearTimeout(this._abwesendTimer); this._abwesendTimer = null; }
    this._restStoppen();
    if (this._ws) { this._ws.onclose = null; this._ws.close(); this._ws = null; }
    this._setzeVerbindung(false);
    return this;
  };

  // Sperrzeit vorzeitig aufheben, z.B. wenn die Anzeige frueher fertig ist.
  SensorHub.prototype.freigeben = function () { this._letztesAusloesen = 0; return this; };

  global.SensorHub = SensorHub;
})(window);
