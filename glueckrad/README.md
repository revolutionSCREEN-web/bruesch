# Digitales Glücksrad – Signage-Version

Anpassbares, komplett offline lauffähiges Glücksrad zum Einbinden in
revolutionSCREEN DigitalSignage (LINK-App). Basiert auf der Elco-Vorlage,
neu aufgebaut mit zentraler Konfiguration, echtem Zufall, Gewinn-Overlay,
QR-Code und Bewegungssensor-Auslösung.

---

## 1. Schnellstart / anpassen

**Alles Kundenspezifische steht in `config.js`.** Kein Eingriff in `js/app.js` nötig.

| Was ändern | Wo in `config.js` |
|---|---|
| Logo (oben + Rad-Mitte) | `brand.logo`, `brand.centerImage` – Datei in `assets/images/` ablegen |
| Titel / Untertitel | `brand.title`, `brand.subtitle` |
| Hintergrund (Farbe/Verlauf/Bild) | `brand.background` |
| Text-/Akzentfarbe | `brand.textColor`, `brand.accentColor` |
| Preise / Segmente / Farben | `segments[]` |
| Gewinn = `win:true`, Niete = `win:false` | je Segment |
| Preistext + QR-Einlöse-URL | `segments[].prize`, `segments[].qr` |
| Overlay-Texte, Call-to-Action | `messages` |
| Sensor-Taste, Timings, Attract, Sound | `behavior` |

Nach Änderung einfach die Seite neu laden.

### Gewinnchance
Das Ergebnis ist **echt zufällig und über alle Segmente gleichverteilt**.
Gewinnchance = Anzahl `win:true`-Segmente ÷ Gesamtzahl der Segmente.
Mehr/weniger Nieten ⇒ einfach entsprechend viele Segmente anlegen.

---

## 2. In der LINK-App einbinden

1. Diesen Ordner auf einen **HTTPS-Webspace** hochladen
   (z. B. `https://gluecksrad.<domain>/kunde/`). Es ist rein statisch – kein PHP/Server nötig.
2. In revolutionSCREEN die **LINK-App** anlegen und diese URL eintragen.
3. Am besten als **Vollbild-Einzelzone** einplanen (siehe Sensor-Hinweis unten).

> Offline-tauglich: Schriftart, QR-Bibliothek und alle Skripte sind lokal
> eingebettet – es werden keine externen Dienste (Google Fonts/Analytics) geladen.

---

## 3. Bewegungssensor (QB24T) – Auslösung

Der Sensor hängt per USB am Samsung QB24T und sendet bei Bewegung eine
**Tastatureingabe (Standard: Enter / Tastencode 13)**. Die App lauscht global
auf diese Taste und startet dann die Drehung. Einstellbar über
`behavior.triggerKeyCode`.

**Eingebaute Absicherungen:**
- **Doppel-Trigger-Schutz** (`behavior.cooldownMs`): weitere Signale während
  Drehung/Ergebnis werden ignoriert – der Sensor darf ruhig mehrfach feuern.
- **Idle-Watchdog** (`behavior.idleWatchdogMs`): bleibt ein Zustand hängen,
  springt die App automatisch zurück in die Bereitschaft.
- **Attract-Modus**: im Leerlauf dreht sich das Rad langsam als Blickfang,
  plus blinkender Hinweistext (`messages.cta`).

### ⚠ Wichtig: Tastatur-Fokus im Webview
Damit das „Enter" des Sensors ankommt, muss die eingebettete Seite den
**Tastatur-Fokus** haben. In einer iframe-/Webview-Einbettung ist das nicht
immer automatisch der Fall.
- Die App holt sich beim Laden aktiv den Fokus (`window.focus()`).
- **Empfehlung:** Glücksrad als Vollbild-Einzelzone laufen lassen.
- **Am Gerät testen:** einmal Bewegung auslösen und prüfen, ob das Rad dreht.
  Falls nicht, greift der Fokus nicht durch → dann muss die Zone/Player-Konfig
  so gesetzt werden, dass Tasten an die LINK-Zone gehen.
- Zum Testen ohne Sensor: **Tippen/Klick aufs Rad** löst ebenfalls aus.

### Verzögerte Auslösung? – so eingrenzen
Die Software-Latenz (Taste → Drehung startet) ist ~5 ms (gemessen). Eine
spürbare Verzögerung liegt also fast sicher **nicht** im Code. So findest du die
Ursache am Display:

1. In `config.js` `behavior.debug: true` setzen und neu publishen.
2. Oben links erscheint ein grünes Log. Beim Auslösen des Sensors beobachten:
   - **„Taste 13 = AUSLÖSER" erscheint sofort beim Winken** → Sensor & Fokus sind
     ok. Die gefühlte Verzögerung ist dann die Dreh-Dauer (`spinDurationMs`,
     Standard 8 s) oder ein zähes Rendering → `spinDurationMs` senken (z. B. 4000)
     und/oder `attractMode: false` testen.
   - **„Taste 13" erscheint erst spät (oder erst nach mehrmaligem Winken)** → das
     „Enter" kommt spät an. Zwei mögliche Gründe:
     a) **Sensor-Hardware**: viele PIR-Melder haben eine einstellbare Nachlaufzeit/
        Verzögerung (Poti am Sensor) → am Sensor kürzer stellen.
     b) **Fokus**: Der Webview bekommt die Taste nicht sofort → Glücksrad als
        **Vollbild-Einzelzone** einplanen; ggf. Player/Zone so konfigurieren, dass
        Tastatur-Eingaben an die LINK-Zone gehen.
3. Zum Schluss `debug` wieder auf `false`.

Fokus wird bereits aktiv gehalten (beim Laden + alle 2 s nachgefasst) und die
Attract-Animation ist GPU-beschleunigt, damit sie die Eingabe nicht ausbremst.

---

## 4. Lead-Erfassung (QR bei Gewinn → Google Sheet)

Bei jedem Gewinn erscheint auf dem Bildschirm ein **QR-Code**. Der Besucher
scannt ihn mit dem Handy → auf seinem Handy öffnet sich das **Formular**
(`form.html`) mit dem gewonnenen Preis. Nach dem Absenden landet eine Zeile
(Datum, Preis, Firma, Vor-/Nachname, Strasse, PLZ, Ort, E-Mail, Telefon) in
einem **Google Sheet**. Kein eigener Server nötig.

**Einrichtung (einmalig):**
1. Neues **Google Sheet** anlegen (z. B. „Glücksrad Leads").
2. Dort **Erweiterungen → Apps Script** öffnen, den Inhalt von
   `google-apps-script.gs` (liegt in diesem Ordner) einfügen, speichern.
3. **Bereitstellen → Neue Bereitstellung → Typ „Web-App"**:
   - Ausführen als: **Ich**
   - Zugriff: **Jeder** (auch „Jeder, auch anonym")
   - Bereitstellen → die **Web-App-URL** kopieren.
4. In `config.js` unter `lead` eintragen:
   - `scriptUrl` = die kopierte Web-App-URL
   - `formUrl`  = die **öffentliche** Adresse, unter der `form.html` liegt
     (z. B. `https://gluecksrad.<domain>/form.html`) – daraus wird der QR-Code.
5. `form.html` (+ `config.js`) mit hochladen. Fertig – Testgewinn scannen,
   Zeile erscheint im Sheet.

> Hinweis: `form.html` postet über ein verstecktes iframe an Google – dadurch
> gibt es **keine CORS-Probleme**. Datum/Zeit setzt das Script serverseitig.
> Solange `scriptUrl` leer ist, zeigt das Formular einen Setup-Hinweis und der
> QR-Code wird am Rad ausgeblendet.

---

## 5. Dateien

```
index.html          Grundgerüst (Querformat: links Text, rechts Rad)
form.html           Handy-Formular, das der QR-Code öffnet (Lead-Erfassung)
config.js           >>> HIER anpassen (Branding, Segmente, Preise, Sensor, Lead)
google-apps-script.gs   ins Google Sheet einfügen (schreibt die Leads)
css/
  reset.css         CSS-Reset (Original)
  easywheel.css     Rad-Styles (Original-Plugin)
  signage.css       Layout (Querformat), Video-Hintergrund, Overlay, Attract
js/
  jquery*.js        jQuery + Easing (Original)
  jquery.easywheel.min.js   Rad-Plugin (Original)
  qrcode.min.js     QR-Erzeugung, offline (public domain)
  app.js            Steuerlogik: Sensor, Zufall, Overlay, Attract, QR/Lead
assets/
  images/oceanpilot-logo.svg · oceanpilot-mark.svg   Branding
  media/oceanpilot-promo-wide.mp4   Hintergrund-Video (Kampagne)
  media/tick.mp3    Tick-Sound
  fonts/lato-*.woff2  selbst gehostete Schrift
```

---

## 6. Technische Hinweise (für Weiterentwicklung)

- **Ergebnis-Ermittlung:** Das easyWheel-Plugin liefert in diesem Build im
  `onComplete`-Callback keine Gewinnerdaten (nur mit dem deaktivierten
  `winner.php`-Ajax-Pfad). Deshalb liest `app.js` die tatsächlich gelandete
  Slice über `instance.currentSlice` aus – das ist die Quelle der Wahrheit und
  stimmt mit der Zeiger-Markierung überein (visuell verifiziert).
- **Zufall:** Das Plugin addiert intern einen zufälligen 0–360°-Offset, die
  Landung ist dadurch gleichverteilt zufällig. `selected`/`selector` steuern die
  Landung in diesem Build **nicht** zuverlässig. Für **gewichtete**
  Wahrscheinlichkeiten müsste die Auswahl selbst übernommen und die Rad-Rotation
  gezielt gesetzt werden (Plugin-Anpassung nötig).
- Getestet headless (Playwright/Chrome): Rendering, echter Zufall
  (Gleichverteilung), Zeiger=Ergebnis, Enter-Trigger, Doppel-Trigger-Schutz,
  Overlay + QR, Attract-Rückkehr – alles grün.
