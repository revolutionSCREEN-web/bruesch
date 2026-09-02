/* =========================================================================
   Brüesch Glücksrad – Google-Sheet-Anbindung
   -------------------------------------------------------------------------
   Dieses Script gehört in das Google Sheet (Erweiterungen > Apps Script).
   Es erledigt ZWEI Aufgaben:

     1) LEADS      Das Handy-Formular (form.html) schickt die Angaben des
                   Gewinners hierher -> eine Zeile im Blatt „Leads".
                   (unverändert gegenüber der bisherigen Fassung)

     2) AUSGABEN   Das Rad meldet jeden ausgespielten Gewinn -> eine Zeile im
                   Blatt „Ausgaben". Damit ist der Bestand nicht mehr nur im
                   Anzeigegerät, sondern zentral sichtbar – auch wenn das
                   Display neu startet oder mehrere Räder laufen.

   Das Rad fragt beim Start ausserdem den Tagesstand ab und rechnet ihn in
   seine eigene Zählung ein. Antwortet das Sheet nicht, läuft das Rad
   unverändert mit seiner lokalen Zählung weiter – der Messebetrieb hängt
   also NIE am Netz.

   NACH JEDER ÄNDERUNG HIER: Bereitstellen > Bereitstellung verwalten >
   Bearbeiten > Version „Neu" > Bereitstellen. Die URL bleibt dabei gleich.
   ========================================================================= */

var SHEET_LEADS    = 'Leads';
var SHEET_AUSGABEN = 'Ausgaben';

/* =======================================================================
   SCHREIBEN
   ======================================================================= */

function doPost(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  if (p.art === 'ausgabe') return ausgabeVerbuchen(p);
  return leadSpeichern(p);
}

/* --- 1) Lead aus dem Handy-Formular ----------------------------------- */
function leadSpeichern(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);                      // parallele Absenden serialisieren
  try {
    var sheet = blatt(SHEET_LEADS, ['Datum/Zeit', 'Preis', 'Firma', 'Vorname', 'Nachname',
                                    'Strasse & Nr.', 'PLZ', 'Ort', 'E-Mail', 'Telefon', 'ID']);
    sheet.appendRow([
      new Date(),                            // Datum/Zeit = Server-Zeitstempel
      p.prize    || '',
      p.firma    || '',
      p.vorname  || '',
      p.nachname || '',
      p.strasse  || '',
      p.plz      || '',
      p.ort      || '',
      p.email    || '',
      p.telefon  || '',
      p.id       || ''
    ]);
    return text('OK');
  } catch (err) {
    return text('ERROR: ' + err);
  } finally {
    lock.releaseLock();
  }
}

/* --- 2) Ausgespielten Gewinn verbuchen --------------------------------
   Erwartet: art=ausgabe · schluessel=kugel-schreiber · artikel=Kugelschreiber
             datum=2026-09-05 · geraet=Display · id=<einmalige Kennung>
   Die `id` verhindert Doppelzählung, wenn eine Meldung wiederholt wird.    */
function ausgabeVerbuchen(p) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = blatt(SHEET_AUSGABEN, ['Datum/Zeit', 'Datum', 'Schlüssel', 'Artikel', 'Gerät', 'ID']);
    var id = String(p.id || '');

    // Schon gemeldet? Dann nichts tun (nur die letzten 400 Zeilen prüfen – das
    // reicht, weil Wiederholungen unmittelbar erfolgen, und bleibt schnell).
    if (id) {
      var letzte = sheet.getLastRow();
      var ab = Math.max(2, letzte - 400);
      if (letzte >= 2) {
        var ids = sheet.getRange(ab, 6, letzte - ab + 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === id) return text('DOPPELT');
        }
      }
    }

    sheet.appendRow([
      new Date(),
      String(p.datum || '').slice(0, 10),
      String(p.schluessel || ''),
      String(p.artikel || ''),
      String(p.geraet || ''),
      id
    ]);
    return text('OK');
  } catch (err) {
    return text('ERROR: ' + err);
  } finally {
    lock.releaseLock();
  }
}

/* =======================================================================
   LESEN  (GET)
   -----------------------------------------------------------------------
   ?stand=1&datum=2026-09-05[&callback=fn]
       -> { datum:…, gesamt:…, ausgegeben:{ schluessel: anzahl, … } }
   Mit `callback` wird JSONP geliefert. Das ist nötig, weil Apps Script keine
   CORS-Kopfzeilen setzt: Ein normales fetch() würde vom Browser blockiert,
   ein <script>-Tag nicht.

   Ausgaben können auch per GET gemeldet werden (art=ausgabe) – das Rad nutzt
   diesen Weg, weil ein Bild-/Script-Abruf ohne CORS-Probleme funktioniert und
   die Anzeige nicht blockiert.
   ======================================================================= */
function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};

  if (p.art === 'ausgabe') {
    var r = ausgabeVerbuchen(p);
    return p.callback ? jsonp(p.callback, { ok: true }) : r;
  }

  if (p.stand) {
    var datum = String(p.datum || '').slice(0, 10) || heute();
    var daten = standFuer(datum);
    return p.callback ? jsonp(p.callback, daten) : json(daten);
  }

  return text('Brüesch Glücksrad – Endpoint aktiv (Leads + Ausgaben).');
}

/* --- Tagesstand aus dem Blatt „Ausgaben" zusammenzählen ---------------- */
function standFuer(datum) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_AUSGABEN);
  var ausgegeben = {}, gesamt = 0;
  if (sheet && sheet.getLastRow() >= 2) {
    var werte = sheet.getRange(2, 2, sheet.getLastRow() - 1, 2).getValues();  // Datum + Schlüssel
    for (var i = 0; i < werte.length; i++) {
      var d = werte[i][0];
      d = (d instanceof Date) ? Utilities.formatDate(d, tz(), 'yyyy-MM-dd') : String(d).slice(0, 10);
      if (d !== datum) continue;
      var k = String(werte[i][1] || '');
      if (!k) continue;
      ausgegeben[k] = (ausgegeben[k] || 0) + 1;
      gesamt++;
    }
  }
  return { datum: datum, gesamt: gesamt, ausgegeben: ausgegeben };
}

/* =======================================================================
   Hilfsfunktionen
   ======================================================================= */
function blatt(name, kopf) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(kopf);
  return sheet;
}
function tz()    { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone() || 'Europe/Zurich'; }
function heute() { return Utilities.formatDate(new Date(), tz(), 'yyyy-MM-dd'); }
function text(t) { return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT); }
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function jsonp(fn, o) {
  var name = String(fn).replace(/[^A-Za-z0-9_$.]/g, '');     // nur harmlose Zeichen zulassen
  return ContentService.createTextOutput(name + '(' + JSON.stringify(o) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}
