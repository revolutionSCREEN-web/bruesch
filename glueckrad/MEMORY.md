# MEMORY — Brüesch Glücksrad

Projekt-Gedächtnis: Stand, Entscheidungen, offene Punkte. Chronologisch ergänzen.
(Details/Regeln stehen in `CLAUDE.md`, Einrichtung im `README.md`.)

## Kurzstatus (13.07.2026)

**Neu aufgesetzt** als Brüesch-Instanz des wiederverwendbaren Signage-Glücksrads (Basis:
verifizierte OceanPilot-Instanz). Für die **Gewerbeausstellung** von **Brüesch Gestaltungs-
technik AG** (Werbetechnik/Leuchtreklame, Hochdorf). Design + Preise stehen, headless gerendert
(Bereitschaft + Gewinn-Overlay). Auslöser wie gehabt: USB-Bewegungssensor am Signage-Display =
Enter (Code 13). **Weg A gewählt: Lead-Erfassung aktiv.**

## Design / Branding (aus dem Logo)

- **Logo oben = Wortmarke** «brüesch GESTALTUNGSTECHNIK» in weisser Schrift
  (`assets/images/bruesch-logo-weiss.png`); **Rad-Nabe = grünes «B»** (`bruesch-mark.png`).
- Marken-Grün: **Dunkelgrün `#2E7D33`**, Mittelgrün `#69A756`, **Hellgrün `#88BF67`** (Akzent/Zeiger).
- Rad-Segmente wechseln **Grün `#2E7D33` ↔ Anthrazit `#23272A`** (wie die Brüesch-Website),
  weisse Segmentschrift auf beiden gut lesbar. Bühnen-Hintergrund dunkel (Anthrazit-Grün-Verlauf).
- Sie-Form (Gewerbeausstellung). Keine animierte Szene (`backgroundScene:''`) — ruhiger Verlauf.
- **Hochformat (Portrait) ist der Ziel-Modus** — CSS `@media (orientation:portrait)` stapelt
  Logo/Text oben, Rad darunter; Overlay-Karte `max-height:92vh` + Scroll. Beides gerendert (1080×1920).
- **Dreh-Geräusch**: Web-Audio-„Ratsche" (`playWheelSpinSound` in `app.js`, kein Sound-File nötig,
  offline). **Synchron gelöst:** Klicks werden beim Dreh-Start entlang DERSELBEN Kurve wie das Rad
  (`easyWheel` == `easeOutQuart`) vorab getaktet — feine Winkelschritte (`easeOutQuartInv`), am Start
  auf `MIN_GAP` 45 ms gedrosselt (kein Gebrassel), Ende bei `P_CAP` 0.997. Verifiziert: letzter Klick
  ~6,1 s, danach dreht das Rad nur noch **5°** (unsichtbar) bis onComplete 8 s → klickt NICHT nach dem
  sichtbaren Stopp; Abstände laufen glatt aus (…212, 282, 455 ms), keine Schluss-Lücke. `onStep`-Tick
  deaktiviert. Gate `behavior.sound`, AudioContext wird auf der Sensor-/Tap-Geste fortgesetzt.
  ⚠️ Gilt für `easeOutQuart`; bei anderer Easing die Umkehrfunktion anpassen.
- **Feld-Texte: radial (entlang der Speiche), im ÄUSSEREN Feldbereich, fett** — exakt nach
  User-Referenz `vorschau/vorschau-rad-textzentrierung.png` (mit `vorschau-rad-abgleich-referenz.png`
  gegengeprüft). Plugin-Radialtext `name:s.name`, `textLine:'v'`, **`fontSize:30`, `textOffset:0`**;
  signage.css-Override `.eWheel-txt>div { text-align:center; padding-left:22%; padding-right:0 }`.
  **`padding-left` schiebt den zentrierten Textblock radial NACH AUSSEN** (grosser Naben-Abstand,
  User-Wunsch „100px mehr"); 22% = Maximum, bei dem die längsten Wörter „Hauptpreis"/„GreenPower" den
  Rand noch nicht berühren (>=~26% schneidet ab). (padding-RIGHT zöge nach innen zur Nabe – falsch.)
  ⚠️ Die zwischenzeitliche „aufrechte Label-Ebene" (`.wheel-labels`) wurde wieder ENTFERNT.
- **Logo oben vergrössert** auf Titelbreite: `.logo { width: min(71vw,900px) }` im Portrait (Logo-Inhalt
  füllt 85% der PNG-Breite → Box 71vw ≈ Titel „Das Brüesch Glücksrad"; gemessen: 653 vs. 652 px).

## Preise (5 Felder, echt zufällig gleichverteilt, 4 Gewinne + 1 Niete) — Stand 13.07. abends

1. **Hauptpreis CHF 500.–** = Teilnahme an der Verlosung: CHF 500.– an eine Fahrzeugbeschriftung.
   Mit Hinweistext im Overlay (`note`): „Die Verlosung findet nach der Messe statt. Es wird keine
   Korrespondenz geführt. Der Gewinner wird persönlich benachrichtigt." (grün)
2. Popcorn — Frisches Popcorn zum Mitnehmen (anthrazit)
3. GreenPower Drink (grün)
4. GreenKey (anthrazit)
5. „Auf ein neues Glück" (Niete, `win:false`, kein Preis/kein QR, anthrazit) — Overlay-Titel „Auf ein neues Glück!"

Gutschein CHF 100 wurde entfernt (User). Neues Feld `note` pro Segment → rendert unter dem Preis
(nur bei Gewinn); Element `#overlay-note` in index.html + `.overlay-note` in signage.css.
2 Grün-Felder (Hauptpreis, GreenPower) bewusst nicht benachbart; Niete anthrazit.

**User bestätigt: Preise passen so.** Falls einzelne Felder seltener gewinnen sollen (z. B.
CHF-100-Gutschein), braucht es die Plugin-Gewichtung (siehe CLAUDE.md Punkt 2) — aktuell nicht.

## Lead-Erfassung (Weg A)

- **Google Sheet:** https://docs.google.com/spreadsheets/d/<Sheet-ID>/edit
  (Sheet-ID `1N7A7y…szjHA`). Script schreibt ins Blatt „Leads".
- `google-apps-script.gs` ist auf Brüesch angepasst; Formularfelder decken sich 1:1 mit den
  Sheet-Spalten (firma/vorname/nachname/strasse/plz/ort/email/telefon/prize/id).
- QR erscheint bei Gewinn, sobald `lead.formUrl` gesetzt ist (unabhängig von scriptUrl!) →
  Formular postet an `lead.scriptUrl`. **Beide müssen live sein, sonst QR ohne Ziel/Speicher.**

## Erledigt (13.07. abends)

- [x] Apps-Script als Web-App bereitgestellt, `lead.scriptUrl` in `config.js` gesetzt.
- [x] **LIVE auf GitHub Pages** (öffentliches Repo `revolutionSCREEN-web/bruesch`, Ordner `glueckrad/`):
      Anzeige `https://revolutionscreen-web.github.io/bruesch/glueckrad/index.html`, `form.html` daneben.
      `lead.formUrl` zeigt auf diese live gehostete `form.html`.
- [x] **Bug „Niete nur 3 s"** überprüft: kein 3-s-Pfad im Code – Overlay bleibt volle **15 s**
      (headless 15001 ms). Alte/gecachte Version war die Ursache.
- [x] **Bug „QR-Link falsch"** behoben: `formUrl` war die tote `help.revolutionscreen.net`-Adresse,
      jetzt live Pages-`form.html`. Kette Gewinn→QR→Formular→`scriptUrl` Ende-zu-Ende verifiziert (200).

## Offen (To-do)

- [ ] **User:** Test-Zeilen im Blatt „Leads" aus der Entwicklung löschen.
- [ ] ⚠️ `config.js` (mit `scriptUrl`) liegt im ÖFFENTLICHEN Repo/Pages – URL ist einsehbar.
      Bei Missbrauch Apps-Script neu bereitstellen (neue URL → hier eintragen).
- [ ] Anzeige-URL (`index.html`, Pages) in der LINK-App als **Vollbild-Einzelzone** setzen (Tastatur-Fokus!).
- [ ] Live-Test am Display: Sensor-Trigger/Verzögerung (`behavior.debug:true`) + Autoplay Tick-Sound.
- [ ] End-to-End am Handy: einmal gewinnen → QR scannen → Formular absenden → Zeile im Sheet prüfen.

## Basis / Herkunft

Kopiert aus `revolutionSCREEN/Sensorik/gluecksrad-signage` (ohne `.git`). Technische Fallen
(currentSlice, Cooldown-vs-Overlay, Fokus im iframe) stehen unverändert in `CLAUDE.md`.

## Sensor-Hub-Anbindung (20.07.2026, gebaut, NICHT deployt)

Zweiter, optionaler Auslöse-Weg neben dem USB-Sensor: `js/sensorhub.js` (Client aus
`revolutionSCREEN/Sensorik/player/`) + `js/sensorhub-anbindung.js` (Brücke), eingebunden
in `index.html`, konfiguriert über den neuen Abschnitt `sensorHub` in `config.js`.

- **`enabled: false` = Standard.** Live-Verhalten bleibt exakt wie bisher; per Node-Test
  verifiziert, dass bei ausgeschalteter Anbindung nichts instanziiert oder geklickt wird.
- **`js/app.js` unverändert** (Projektregel): Ausgelöst wird über `document.body.click()`,
  was app.js bereits als `trigger('Tap/Klick')` auswertet — inklusive Cooldown, State-Sperre
  und Attract-Ende. Beide Auslöse-Wege dürfen gleichzeitig laufen.
- Sperrzeit automatisch = `spinDurationMs + overlayAutoCloseMs + 2 s` (hier 25 s).
- `maxDistanzM` filtert Vorbeigehende (getestet: 1,2 m löst aus, 5,0 m nicht,
  unbekannte Distanz löst aus).

⚠️ **Mixed Content:** Der Hub spricht http/ws. Auf der Live-URL (GitHub Pages = **https**)
funktioniert die Hub-Anbindung deshalb **nicht** — der Browser blockiert sie. Für den
Hub-Betrieb muss die Seite lokal bzw. per http vom Player ausgeliefert werden.
Der USB-Tastendruck-Weg ist davon nicht betroffen.


---

## 02./03.09.2026 — Messe-Fassung: Mengensteuerung, Tizen-Fix, Google-Sheet-Bestand

Alles LIVE auf GitHub Pages (`revolutionSCREEN-web/bruesch`, Ordner `glueckrad/`),
Commits `3810f45` → `6775454` → `435d455`.

### ⚠️⚠️ Die Ursache für «der QR-Code wird nicht angezeigt»

Nicht die Overlays fehlen dem Tizen-Browser — **Tizen 4.0 ist Chromium 56**, und dort werden
Deklarationen mit unbekannten Funktionen **still verworfen**:

| Eigenschaft | ab Chromium | Folge auf dem Display |
|---|---|---|
| `inset: 0` | 87 | Overlay ohne Ausdehnung → sass bei y=1920, **ausserhalb des Bildes** |
| `clamp()` | 79 | alle Schriftgrössen fielen weg (Titel 16 px statt 45 px) |
| `min()` | 79 | Rad-/Logo-Begrenzung weg |
| Flexbox-`gap` | 84 | Abstände weg |

Der QR wurde also erzeugt, war nur nie zu sehen. **Fix:** vor jeder solchen Deklaration ein
klassischer Fallback (`/* Fallback Tizen 4.0 */`, 20 Stellen in `signage.css`), `gap` komplett
durch Margins ersetzt. **Nachstellen ohne Display:** Stylesheet per Playwright `page.route`
ausliefern und dabei alle Zeilen mit `clamp(|min(|max(|inset:|gap:` entfernen — genau so sieht
Chromium 56 die Datei. Vorher/Nachher damit belegt.

### Gesteuerte Ausspielung statt Zufall (`js/ausspielung.js`)

Das Ergebnis steht **vor** der Drehung fest; das Rad dreht gezielt dorthin (`dreheZu()` in
`app.js`, eigene CSS-Transition). Das easyWheel-Plugin **zeichnet nur noch** — `spin.click()`
wird nicht mehr ausgelöst, `onComplete` ist leer, `currentSlice` wird nicht mehr gelesen.
Damit ist die alte Notiz «gewichtete Chancen brauchen einen Plugin-Patch» erledigt.

**Winkel-Konvention** (für alle 6 Felder verifiziert): Segment 0 beginnt oben am Zeiger,
im Uhrzeigersinn. Mitte von Segment *i* = `360 − Segmentwinkel·i − Segmentwinkel/2`;
umgekehrt `Index = floor((360 − Rotation) / Segmentwinkel)`.
⚠️ Zum Messen den **nicht rotierten `.eWheel-wrapper`** nehmen — die Hülle von `.eWheel`
wächst mit dem Drehwinkel (kostete einen Fehlversuch).

Enthalten:
- **Tageskontingente** je Artikel (Fr/Sa/So), Zählung je Datum, beginnt am nächsten Messetag neu.
- **Streckung** über die Öffnungszeit; Bremse erst bei `streckPuffer` 15 % Vorsprung — ohne
  Puffer verwässert sie das Mengenverhältnis (gemessen: 1,3:1 statt 2:1).
- **Gewichtung nach Restmenge** → Kugelschreiber (doppeltes Kontingent) kommt ~1,8× so oft
  wie die Trinkflasche, ohne zweimal auf dem Rad zu stehen.
- **Nietenquote** `nietenAnteil` 0.10 (vom User von 0.25 heruntergesetzt).
- **Hauptpreis**: siehe unten, vom User am 03.09. präzisiert.

### ⚠️ Hauptpreis-Regel (vom User präzisiert)

Der Kinogutschein CHF 100.– ist die **ersten 150 Drehungen des Tages gesperrt**
(`hauptpreisAbKlick: 150`) und kann **frühestens beim 151. Klick** fallen, danach mit
20 % je Klick gestreut (`hauptpreisChance: 0.2`, im Mittel Klick 155), damit niemand mitzählen
kann. **Kommen an einem Tag weniger als 151 Klicks zusammen, wird an diesem Tag KEIN Gutschein
ausgespielt — so gewollt** (Entscheid des Users gegen eine Ausnahme kurz vor Messeschluss).
Verifiziert am Rad: Klickstand 149 → 0 von 300 Zügen; Klickstand 150 → 65 von 300 (22 %).

⚠️ **Mengen in `preise.txt` sind OBERGRENZEN, keine Ausspielungsmengen.** Bei 150 Klicks/Tag
gehen am Samstag ~117 Sachartikel raus, obwohl 400 hinterlegt sind. Das war der Punkt, den der
User ausdrücklich geklärt haben wollte.

### Bestand im Google Sheet (übersteht den Display-Neustart)

Jeder Gewinn wird ins Blatt **«Ausgaben»** gemeldet; beim Start und alle 3 min im Leerlauf holt
das Rad den Tagesstand zurück (je Artikel der grössere Wert aus Sheet und lokaler Ablage).
**Grund:** Ohne das begann die Zählung bei jedem Neustart des Displays wieder bei null und die
Kontingente hätten überschritten werden können.

- Alles per **JSONP** — Apps Script setzt keine CORS-Kopfzeilen, ein `fetch` würde blockiert;
  ein `<script>`-Tag funktioniert auch auf Chromium 56.
- Nichts blockiert die Anzeige. Antwortet das Sheet nicht, gilt die lokale Zählung, und die
  Meldungen setzen aus (`onlineBereit=false`), bis ein Abgleich wieder klappt.
- `verbuche()` kapselt die Meldung in try/catch — die lokale Zählung ist führend und darf nie
  an einer fehlgeschlagenen Meldung scheitern.
- Doppelschutz über eine einmalige `id` je Meldung (Antwort `DOPPELT`).
- ⚠️ Das Apps Script muss nach jeder Änderung **neu bereitgestellt** werden (Version «Neu»),
  sonst kennt es `art=ausgabe`/`stand=1` nicht. Am 02.09. vom User erledigt, Kette danach
  end-to-end im echten Sheet geprüft.
- ⚠️ `Run` auf `doPost` im Apps-Script-Editor schreibt eine **leere Zeile ins Blatt «Leads»**
  (`e` ist dann undefined) — nicht zum Testen verwenden.

### Neu: `admin.html`

Preise und Mengen in einer Tabelle bearbeiten → erzeugt `preise.txt` zum Herunterladen/Kopieren;
darunter der Bestand **aus dem Google Sheet**, je Messetag wählbar, plus Reset der lokalen Zählung.

### Weitere Änderungen

- Aufruf-Text `messages.cta` → **«Drücken Sie den Buzzer»**.
- `preise.txt` hat eine **5. Spalte** (`Mengen Fr/Sa/So`) und die ART `HAUPTPREIS`.
- Kundendokument `Bruesch-Gluecksrad-Uebersicht.docx` (+ vom User erzeugte PDF).
