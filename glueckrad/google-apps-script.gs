/* =========================================================================
   Brüesch Glücksrad – Lead-Erfassung ins Google Sheet
   -------------------------------------------------------------------------
   Dieses Script gehört in ein Google Sheet (Erweiterungen > Apps Script).
   Es nimmt die Formulardaten entgegen und hängt pro Absenden eine Zeile an.
   Einrichtung Schritt für Schritt: siehe README, Abschnitt „Lead-Erfassung".
   ========================================================================= */

var SHEET_NAME = 'Leads';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);                      // parallele Absenden serialisieren
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // Kopfzeile einmalig anlegen
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Datum/Zeit', 'Preis', 'Firma', 'Vorname', 'Nachname',
                       'Strasse & Nr.', 'PLZ', 'Ort', 'E-Mail', 'Telefon', 'ID']);
    }

    var p = (e && e.parameter) ? e.parameter : {};
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

    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput('ERROR: ' + err).setMimeType(ContentService.MimeType.TEXT);
  } finally {
    lock.releaseLock();
  }
}

// Aufruf im Browser (GET) -> kleine Statusmeldung zum Testen der Bereitstellung
function doGet() {
  return ContentService.createTextOutput('Brüesch Glücksrad Lead-Endpoint aktiv.')
    .setMimeType(ContentService.MimeType.TEXT);
}
