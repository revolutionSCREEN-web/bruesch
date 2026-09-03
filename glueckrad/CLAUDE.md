# CLAUDE.md — Glücksrad Signage

Leitfaden für Claude Code in diesem Projekt. Diese Regeln haben Vorrang vor Default-Verhalten.

## Was ist das

Anpassbares **digitales Glücksrad** für Digital Signage, zum Einbinden über die
**LINK-App** in revolutionSCREEN. Aktuelle Instanz: **Brüesch Gestaltungstechnik AG**
(Werbetechnik/Leuchtreklame, Hochdorf) für eine **Gewerbeausstellung**.
Ziel-Display: **Samsung Signage** (**Hochformat/Portrait**) mit **USB-Bewegungssensor**, der bei
Bewegung eine Taste (**Enter / Code 13**) sendet → das Rad dreht.

- **Rein statisch & offline-tauglich**: kein Server nötig; alle Bibliotheken, die Schrift
  und das Hintergrund-Video sind lokal eingebettet (kein Google Fonts / kein Analytics).
- Einzige externe Anbindung: **Google Apps Script** (nur für die Lead-Erfassung ins Sheet).
- Basiert auf dem jQuery-Plugin „easyWheel" (Original von gluecksrad.elco-webteam.ch,
  neu aufgebaut).

## Sprache & Stil (WICHTIG)

- Alles auf **Deutsch**, **Schweizer Schreibweise: „ss" statt „ß"** (in Chat, Code, Inhalten).
- **Code-Kommentare auf Deutsch.**
- UI-Texte kommen aus `config.js`, nicht hartkodieren.

## Struktur

```
index.html          Anzeige-Seite (Hochformat ist Ziel-Modus)
                    ?zuschauer=1  → Beamer/Zweitbildschirm · ?debug=1 → Protokoll
admin.html          Preise/Mengen eintragen, preise.txt erzeugen, Bestandsübersicht, Reset
form.html           Handy-Formular, das der QR-Code öffnet (Lead-Erfassung)
config.js           >>> EINZIGE Stelle für Branding, Segmente, Preise, Sensor, Timings,
                    Lead, Ausspiel-Steuerung, Radspiegel
preise.txt          Preise + Mengen im Klartext (wird beim Start geladen; config.js = Fallback)
google-apps-script.gs   ins Google Sheet einfügen (Leads + Blatt „Ausgaben")
css/
  reset.css · easywheel.css   Original (nicht anfassen)
  signage.css       Layout, Overlay, Attract, Countdown, Zuschauer-Modus
                    ⚠️ mit Tizen-4.0-Fallbacks (20 Stellen, siehe Stolperfalle 4)
js/
  jquery*.js · jquery.easywheel.min.js   Original-Plugin (nicht anfassen)
  qrcode.min.js     QR-Erzeugung, offline (public domain)
  marine-bg.js      animierter Canvas-Hintergrund + Freeze/Resume (hier nicht aktiv)
  app.js            Steuerlogik: Sensor, Drehung, Overlay, Attract, QR/Lead, Countdown
  ausspielung.js    Kontingente, Streckung, gewichtete Ziehung, Hauptpreis, Sheet-Abgleich
  spiegel.js        Radspiegel: sendet/empfängt die Drehungen (Beamer)
  sensorhub*.js     Sensor-Hub-Anbindung (gebaut, hier NICHT aktiv)
assets/
  images/bruesch-logo-weiss.png (Wortmarke oben) · bruesch-mark.png («B» in der Nabe)
  media/tick.mp3 · fonts/lato-*.woff2
Bruesch-Gluecksrad-Uebersicht*.docx   Kundendokument (siehe Config-Abschnitt)
STAND-2026-09-03.md · MEMORY.md       Übergabestand · Verlauf und Begründungen

../radspiegel-worker/   Cloudflare Worker für die Beamer-Übertragung (eigenes README)
```

**Regel:** Kundenspezifisches immer in `config.js`. `js/app.js` nur für Logik ändern,
nie Branding/Texte hineinschreiben. Original-Plugin-Dateien nicht editieren.

## Funktionsweise (Kurz)

- **Gesteuerte Ausspielung** (`js/ausspielung.js`, seit 02.09.2026): Das Ergebnis steht VOR der
  Drehung fest; das Rad dreht gezielt dorthin. Tageskontingente je Artikel (Fr/Sa/So), Streckung
  über die Öffnungszeit, Gewichtung nach Restmenge, Hauptpreis genau 1×/Tag, Nietenquote.
  Gezählt wird im `localStorage` des Anzeigegeräts, getrennt je Datum.
- **Sensor-Trigger**: globales `keydown` auf `behavior.triggerKeyCode` (13) → Dreh; mit
  Doppel-Trigger-Schutz (`cooldownMs`), Auto-Repeat wird ignoriert, Fokus wird aktiv
  gehalten. Tap/Klick löst zum Testen ebenfalls aus.
- **Attract-Modus**: im Leerlauf dreht das Rad langsam (GPU-beschleunigt) + Call-to-Action.
- **Hintergrund**: animierte Marine-Szene (`marine-bg.js`, `brand.backgroundScene`):
  Radar/Wind/Leuchtturm. **Friert beim Rad-Start ein** (Standbild) und läuft weiter, wenn
  das Overlay/der QR verschwindet (`MarineBG.freeze()`/`.resume()`). Alternativ Video via
  `brand.backgroundVideo` (nur wenn `backgroundScene` leer).
- **Ergebnis-Overlay**: bleibt `overlayAutoCloseMs` (15 s) stehen, mit **Countdown**
  (Zahl + schrumpfender Balken).
- **Lead-Erfassung**: bei Gewinn erscheint ein **QR-Code** → öffnet `form.html` auf dem
  Handy (Preis via URL) → Absenden schreibt eine Zeile ins **Google Sheet** (Blatt „Leads").
- **Bestand im Google Sheet** (`ausspielung.online`, seit 02.09.2026): Jeder ausgespielte Gewinn
  wird zusätzlich ins Blatt **„Ausgaben"** geschrieben; beim Start und alle 3 Minuten im Leerlauf
  holt das Rad den Tagesstand von dort und rechnet ihn ein (je Artikel gilt der grössere Wert aus
  Sheet und lokaler Zählung). **Damit beginnt die Zählung nach einem Neustart des Displays nicht
  bei null.** Alles über JSONP (Apps Script setzt keine CORS-Kopfzeilen); nichts blockiert die
  Anzeige. Antwortet das Sheet nicht, gilt die lokale Zählung und die Meldungen setzen aus, bis
  ein Abgleich wieder klappt.

- **Radspiegel** (`js/spiegel.js`, seit 03.09.2026): Die Anzeige am Stand meldet jede Drehung
  über einen Cloudflare-Dienst; `index.html?zuschauer=1` spielt sie auf einem Beamer oder
  zweiten Bildschirm gleichzeitig ab (55–77 ms Versatz). Der Zuschauer bedient nichts, zählt
  nichts und zeigt keinen QR. Das Rad am Stand ist davon unabhängig.

## Technische Stolperfallen (unbedingt beachten)

1. **Das Plugin dreht nicht mehr selbst** (seit 02.09.2026). `app.js` bestimmt das Ziel über
   `Ausspielung.ziehe()` und dreht `.eWheel` per **eigener CSS-Transition** (`dreheZu()`);
   `onSpinComplete(index)` bekommt den Index als Parameter. `currentSlice` wird nicht mehr
   gebraucht, der Plugin-`onComplete` ist leer, `spin.click()` wird nicht mehr ausgelöst.
2. **Winkel-Konvention** (empirisch verifiziert, alle 6 Felder): Segment 0 beginnt oben am
   Zeiger und läuft im Uhrzeigersinn. Die Mitte von Segment *i* liegt bei
   `360 − Segmentwinkel·i − Segmentwinkel/2`. Umgekehrt gilt
   `Index = floor((360 − Rotation) / Segmentwinkel)`.
   ⚠️ Für Messungen im Test **nicht** `.eWheel` als Geometrie nehmen — dessen Hülle wächst mit
   dem Drehwinkel. Der nicht rotierte `.eWheel-wrapper` liefert die stabile Radgeometrie.
3. **Cooldown darf das Overlay nicht kappen.** Der Fallback-`cooldownTimer` wird in
   `onSpinComplete` per `clearTimeout` gestoppt; das Overlay-Ende steuert nur der Countdown.
   `idleWatchdogMs` muss `> spinDurationMs + overlayAutoCloseMs` sein (aktuell 40 s).
4. ⚠️⚠️ **Tizen 4.0 = Chromium 56 — modernes CSS fällt still aus.** Das Ergebnisfenster war am
   Display unsichtbar, weil `inset: 0` (ab Chromium 87) verworfen wurde: Das `position:fixed`-
   Overlay hatte dadurch keine Ausdehnung und sass bei y=1920, also unterhalb des Bildes. Der
   QR-Code wurde erzeugt, war nur nie zu sehen. Ebenso betroffen: `clamp()` und `min()` (ab 79),
   Flexbox-`gap` (ab 84). In `signage.css` steht vor jeder solchen Deklaration ein klassischer
   Fallback (markiert mit `/* Fallback Tizen 4.0 */`), `gap` wurde ganz durch Margins ersetzt.
   **Neue CSS-Eigenschaften daher immer mit Fallback schreiben.** Nachstellen ohne Display:
   Stylesheet per `page.route` ausliefern und dabei alle Zeilen mit
   `clamp(|min(|max(|inset:|gap:` entfernen — so sieht Chromium 56 die Datei.

5. **Tastatur-Fokus im LINK-App/iframe.** Ohne Fokus kommt das Sensor-„Enter" nicht an.
   Als **Vollbild-Einzelzone** einplanen. Zum Eingrenzen `behavior.debug: true` setzen →
   grünes Log oben links zeigt Tasten + Latenz (Software-Latenz ist ~5 ms; eine spürbare
   Verzögerung liegt an Sensor-Nachlaufzeit/Poti oder Fokus, nicht am Code).
6. ⚠️ **Apps Script muss nach jeder Änderung NEU BEREITGESTELLT werden** (Bereitstellen >
   Bereitstellung verwalten > Bearbeiten > Version „Neu" > Bereitstellen). Die URL bleibt gleich.
   Solange die alte Fassung läuft, kennt sie `art=ausgabe`/`stand=1` nicht und antwortet mit
   Text statt JSONP → das Rad läuft normal weiter, meldet aber nichts und gleicht nichts ab.
7. **Lead-Formular postet CORS-frei** über ein verstecktes iframe an Apps Script. Datum
   setzt das Script serverseitig. Solange `lead.scriptUrl` leer ist, blendet das Rad den
   QR aus und das Formular zeigt einen Setup-Hinweis.

8. ⚠️⚠️ **Der Hauptpreis darf auf KEINEM Zufalls-Pfad fallen** (03.09.2026, am Messestand
   passiert). Der Aufbau war an einem Donnerstag; der steht in `ausspielung.tage` nicht, also
   lieferte `tagesplan()` `null` und `ziehe()` fiel auf reinen Zufall über alle Felder zurück —
   der Kinogutschein kam beim ersten Buzzer-Druck, und beim zweiten gleich noch einmal.
   Es gibt **drei** solche Zufalls-Pfade, alle laufen jetzt über `zufallOhneHauptpreis()`:
   kein Messetag hinterlegt (auch bei falschem Gerätedatum), `ausspielung.enabled:false`,
   und der Notfall-Fallback in `app.js`, wenn `ausspielung.js` fehlt.
   **Beim Erweitern gilt:** Ein Fallback darf bei Sachpreisen grosszügig sein, den Hauptpreis
   muss er ausschliessen — der Zufalls-Zweig ist genau der Pfad, den man beim Testen zuerst
   trifft. `verbuche()` meldet aus demselben Grund nur an Messetagen ans Google Sheet.
9. **Debug am Display ohne Deploy:** `index.html?debug=1` (neben `behavior.debug`). Das
   Protokoll nennt den Grund jeder Ziehung — «Messetag 2026-09-04, Klick 37» oder «kein
   Messetag (…) – Hauptpreis gesperrt». Steht dort «kein Messetag», obwohl Messe ist, geht
   die **Uhr des Displays falsch**: dann greifen weder Kontingente noch Sheet-Meldung.

10. **`hauptpreisAbKlick` ist je Wochentag gestaffelt** (`{ '5': 60, '6': 150, '0': 100 }`,
    `sperreFuerTag()`). Grund: 4 h Ausstellung am Freitag gegen 11 h am Samstag — eine
    einheitliche Sperre trifft die Tage völlig unterschiedlich hart. Eine einzelne Zahl gilt
    weiterhin für alle Tage. **Bei einer neuen Aktion die Sperre immer an der Öffnungsdauer
    ausrichten**, nicht pauschal setzen: Faustregel ~14 Drehungen pro Öffnungsstunde.

11. **Radspiegel (`js/spiegel.js`, `?zuschauer=1`).** Die Anzeige am Stand sendet bei jeder
    Drehung `{typ:'dreh', idx, feld}` über einen Cloudflare-Dienst (Ordner
    `../radspiegel-worker`, Durable Object mit WebSocket); Zuschauer-Bildschirme spielen
    dieselbe Drehung ab. **Regeln beim Erweitern:**
    - Senden ist «feuern und vergessen» — nie auf eine Antwort warten, nie den Ablauf am
      Stand davon abhängig machen. Ohne Netz muss das Rad unverändert laufen.
    - Im Zuschauer-Modus **nicht verbuchen** (`ZUSCHAUER`-Flag in `app.js`), sonst zählt
      jede Ausgabe doppelt und wird doppelt ins Sheet gemeldet.
    - Im Zuschauer-Modus **keinen QR** zeigen — er wäre aus der Ferne abscannbar.
    - `feld` (der Segmentname) wird mitgeschickt, damit der Zuschauer bei abweichender
      `preise.txt` das richtige Feld über den Namen findet statt über die Nummer.

12. **JSONP-Callback stilllegen, nicht löschen.** Antwortet Apps Script erst nach dem
    Zeitlimit, ruft das nachgeladene Script seinen Callback trotzdem auf — war er per
    `delete` entfernt, gibt es «`_radCb… is not defined`». In `jsonpAbruf()` wird er darum
    durch eine leere Funktion ersetzt und erst nach 30 s aufgeräumt. `zeitlimitMs` steht auf
    **10 s**: Apps Script läuft nach einer Ruhephase träge an, und ein verpasster
    Start-Abgleich setzt die Sheet-Meldungen bis zum nächsten Versuch (3 min) aus.
    Gefunden im nachgestellten Tizen-Browser — dieser Test lohnt sich nach jeder Änderung.

## Testen (headless)

Es gibt keine Testdateien im Repo — Playwright-Skripte im Scratchpad erzeugen. Muster:
lokaler `http`-Server über den Ordner + `chromium.launch({channel:'chrome'})`, `config.js`
per `page.route` mit schnellen Timings überschreiben, Enter drücken, `#overlay.visible`
prüfen, `instance.currentSlice` auslesen. Video-Autoplay:
`args:['--autoplay-policy=no-user-gesture-required']`. Vor Screenshots ~1,5 s warten.

## Deployment

- **LIVE auf GitHub Pages** (öffentliches Repo `revolutionSCREEN-web/bruesch`, Branch `master`,
  Ordner `glueckrad/`): Anzeige = `https://revolutionscreen-web.github.io/bruesch/glueckrad/index.html`,
  Formular = `.../glueckrad/form.html`. `form.html` lädt `config.js` aus demselben Ordner.
  Re-Deploy = Änderungen im Repo `scratchpad/bruesch-repo` committen + pushen (Pages baut selbst).
- **LINK-App-URL** (für den Bildschirm) = die `index.html`-Pages-URL oben.
- Alternativ eigener Webspace: gesamten Ordnerinhalt (inkl. `form.html` + `config.js`) hochladen,
  dann `lead.formUrl` in `config.js` auf die neue `form.html`-Adresse setzen.
- **Lead-Sheet**: `google-apps-script.gs` ins Google Sheet (Erweiterungen → Apps Script),
  als Web-App bereitstellen (Ausführen als: Ich · Zugriff: Jeder), URL in `config.js`
  unter `lead.scriptUrl`. Schritt für Schritt: README Abschnitt 4.

## Aktuelle Config-Werte (Stand 03.09.2026 — Brüesch, Hofdere 2026, Fr–So)

- **6 Segmente** (in dieser Reihenfolge): Hauptpreis Kinogutschein CHF 100.– (`HAUPTPREIS`, 1/1/1,
  Sperre je Tag: Fr ab Klick 61, Sa ab 151, So ab 101) ·
  Kugelschreiber (100/200/100) · Trinkflasche (50/100/50) · GreenTEA (unbegrenzt, Trostpreis) ·
  Kühl-/Wärme-Pad (50/100/50) · Niete „Auf ein neues Glück".
- **Preise + Mengen bearbeiten = `preise.txt`** oder bequemer **`admin.html`**. Format je Zeile:
  `Rad-Text | Gewinn-Text | ART | Hinweis | Mengen Fr/Sa/So`. ART = `GEWINN` / `HAUPTPREIS` / `NIETE`,
  `//` = Zeilenumbruch, Mengen leer/`unbegrenzt` = keine Begrenzung. **Fallback:** schlägt `fetch`
  fehl (z. B. `file://`), gelten die `segments` aus `config.js` — die also synchron halten.
- **`ausspielung`-Block in config.js:** `tage` = Öffnungszeiten (Fr 17–21, Sa 10–21, So 10–17,
  Schlüssel 0=So/5=Fr/6=Sa) · `teilnehmerProTag: 150` (steuert die Hauptpreis-Chance) ·
  **`hauptpreisAbKlick: { '5': 60, '6': 150, '0': 100 }`** (Sperre je Wochentag, gelesen über
  `sperreFuerTag()`; eine einzelne Zahl gilt für alle Tage → Fr ab Klick 61, Sa ab 151, So ab 101,
  überall rund 14–15 Drehungen pro Öffnungsstunde nötig) · **`hauptpreisChance: 0.2`** (danach
  20 % je Klick, fällt im Schnitt fünf Klicks nach der Sperre, damit niemand mitzählen kann).
  ⚠️ Kommen an einem Tag weniger Drehungen zusammen als die Sperre verlangt, wird an diesem Tag
  KEIN Gutschein ausgespielt — so gewollt.
  `nietenAnteil: 0.10` · `streckPuffer: 0.15` (wie weit die Ausgabe dem Zeitplan vorauslaufen darf,
  bevor gebremst wird) · `gewichtUnbegrenzt: 50` (Gewicht des Trostpreises).
  **`enabled: false`** schaltet die ganze Steuerung ab → wieder reiner Zufall wie früher.
- **Zählung:** `localStorage`-Schlüssel `bruesch-gluecksrad-ausspielung-v1`, Feld `datum` — bei
  Datumswechsel beginnt die Zählung automatisch neu. ⚠️ Wird der Browser-Speicher des Displays
  gelöscht (Neustart/Cache-Reset), beginnt die Zählung mitten am Tag wieder bei null.
- Farben: Segmente Grün `#2E7D33` ↔ Anthrazit `#23272A`, Akzent/Zeiger Hellgrün `#88BF67`,
  Nabe weiss, dunkler Bühnen-Verlauf. Schrift weiss, Sie-Form.
- **Logo oben** = `assets/images/bruesch-logo-weiss.png`; **Nabe** = `bruesch-mark.png`.
- **Hochformat** ist Ziel-Modus (`@media orientation:portrait`); Overlay-Karte `max-height:92vh`.
- **Dreh-Geräusch** via Web-Audio-Ratsche `playWheelSpinSound()` (offline, kein File), vorab entlang
  der Rad-Kurve getaktet. ⚠️ an `easeOutQuart` gekoppelt — die eigene Drehung in `dreheZu()` nutzt
  darum `cubic-bezier(0.165, 0.84, 0.44, 1)`; wird die Kurve geändert, passt der Ton nicht mehr.
- **Feld-Texte = radial**, `.eWheel-txt>div{text-align:center; padding-left:6%}`.
- **Aufruf-Text** (`messages.cta`, im Leerlauf sichtbar) = **«Drücken Sie den Buzzer»**
  (seit 02.09.2026; vorher «Näher treten – das Rad dreht von selbst»).
- **Kundendokument** `Bruesch-Gluecksrad-Uebersicht.docx` (+ PDF): Preise/Mengen je Tag,
  erwartete Ausspielung je Messetag (Klick-Szenarien an der Öffnungsdauer ausgerichtet:
  Fr 60/100/150 · Sa 150/250/400 · So 100/150/250), Sperre je Tag, Funktionsweise, beide
  Adressen (Display + Beamer). **Bei Preis-, Mengen- oder Regeländerungen mitziehen.**
  Bearbeitet mit `python-docx` (venv im Scratchpad).
  ⚠️ **Layout ist hier nicht rendernd prüfbar:** kein LibreOffice, kein pandoc, und die
  AppleScript-Steuerung von Word/Pages scheitert (Timeout bzw. „Verbindung ungültig" — dem
  Terminal fehlt die macOS-Automation-Berechtigung). Ersatzprüfung: Spaltenbreiten aufsummieren
  und gegen die nutzbare Textbreite halten — **17,19 cm** (Letter 21,6 cm minus 2×2,2 cm Rand).
  `table.add_column()` übernimmt die Breite der letzten Spalte, sprengt also die Seite; danach
  `tblGrid` **und** jede Zellenbreite neu setzen. Neue Zellen erben kein Format → `tcPr` und
  den Absatz von einer Nachbarzelle deepcopy'en (grüne Kopfzeile `2E7D33`).
  ⚠️ Word hält nach dem Öffnen eine Sperrdatei `~$…docx` im Ordner; die verschwindet erst,
  wenn der User das Dokument in Word schliesst. Die PDF erzeugt der User selbst aus dem Word.
- `behavior`: Trigger Code 13, `spinDurationMs` 8000, `overlayAutoCloseMs` 15000 (+Countdown),
  `loseAutoCloseMs` 3000, `cooldownMs` 12000, `idleWatchdogMs` 40000, `attractMode` true,
  `sound` true, `debug` false.
- `lead.formUrl` = Pages-`form.html`, `lead.scriptUrl` = Apps-Web-App im Sheet
  `1N7A7y…szjHA`. QR erscheint nur bei Gewinn.
- **`spiegel`-Block:** `enabled: true`, `wsUrl` = `wss://bruesch-radspiegel.patrick-buch3r.workers.dev/kanal`,
  `raum: 'bruesch'`, plus die beiden Zuschauer-Texte (`zuschauerCta`, `zuschauerHinweis`).
  `enabled: false` schaltet die Übertragung aus.

## Offen

- ⏸️ **Feldtest am QB24T abschliessen.** Am 03.09. war das Rad am Stand installiert, der Buzzer
  löste aus und das Ergebnisfenster erschien (dabei fiel Stolperfalle 8 auf). Noch offen: QR am
  echten Display, Tick-Sound (Autoplay), und der Radspiegel **mit dem Display als Sender** — der
  ist bisher nur zwischen zwei Desktop-Browsern geprüft. Blockiert das WLAN ausgehende
  `wss`-Verbindungen, bleibt der Beamer stehen; das Rad läuft unbeeinflusst weiter.
- ⚠️ **Vor Messebeginn am Display: hart neu laden.** Sonst läuft dort die alte Fassung mit dem
  Hauptpreis-Fehler weiter.
- ⚠️ **Am Messemorgen prüfen:** Datum/Uhrzeit des Displays. `?debug=1` muss «Messetag …» zeigen.
- ⚠️ **Testdrehungen an einem Messetag zählen mit** (Kontingent + Sheet) und senken die
  Hauptpreis-Schwelle entsprechend. Zum Testen lieber einen Nicht-Messetag nehmen — dort wird
  weder verbucht noch gemeldet und der Hauptpreis ist gesperrt.
- **User:** PDF aus dem aktualisierten Word neu erzeugen; Testzeilen im Google Sheet löschen
  (Blatt „Ausgaben": Gerät `TEST-Pruefung` und die Zeilen vom 03.09.; Blatt „Leads": die leere
  Zeile vom `Run`-Versuch und die Juli-Testzeilen).
- **Hinweis:** `config.js` (mit `scriptUrl` und der Spiegel-Adresse) liegt im ÖFFENTLICHEN
  Repo/Pages. Bei Missbrauch das Apps Script neu bereitstellen (neue URL) und beide
  `scriptUrl`-Stellen anpassen; den Spiegel notfalls mit `spiegel.enabled: false` abschalten.
- Sensor-Hub-Anbindung bleibt aus (`sensorHub.enabled:false`); über https ohnehin blockiert
  (Mixed Content).
