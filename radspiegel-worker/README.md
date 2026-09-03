# Radspiegel — das Glücksrad auf Beamer und Zweitbildschirm

Kleiner Cloudflare-Dienst, der die Drehungen des Brüesch Glücksrads an weitere
Bildschirme weiterreicht. Er speichert nichts und wertet nichts aus.

| | |
|---|---|
| Adresse | `https://bruesch-radspiegel.patrick-buch3r.workers.dev` |
| Anzeige am Stand | `.../glueckrad/index.html` — sendet |
| Beamer / Zweitbild | `.../glueckrad/index.html?zuschauer=1` — empfängt |
| Läuft es? | `https://bruesch-radspiegel.patrick-buch3r.workers.dev/status?raum=bruesch` |

`status` zeigt, wie viele Anzeigen und Zuschauer gerade verbunden sind — die
schnellste Prüfung am Messestand.

## Wie es zusammenhängt

Beim Buzzer-Druck steht das Ergebnis **vor** der Drehung fest (Ausspiel-Steuerung
in `js/ausspielung.js`). Die Anzeige am Stand schickt dieses Ergebnis hier durch,
und jeder Zuschauer-Bildschirm spielt dieselbe Drehung ab. Gemessen: **31 ms**
über das Internet, **55–77 ms** vom Tastendruck bis zum Anlaufen des zweiten Rads.

Der Zuschauer-Bildschirm nimmt keine Eingaben an, zählt nichts mit und zeigt
bewusst **keinen QR-Code** — sonst liesse der sich aus der Ferne abscannen, ohne
gedreht zu haben.

> **Das Rad am Stand hängt hiervon nicht ab.** Es wird nur gesendet, nie auf eine
> Antwort gewartet. Ohne Netz dreht es unverändert weiter; dann bleibt nur der
> Beamer stehen und verbindet sich selbstständig wieder (2 s, dann wachsend bis 20 s).

## Bedienen

```bash
npx wrangler deploy     # bereitstellen
npx wrangler tail       # mitlesen, was durchläuft
```

Abschalten ohne Deploy: in `config.js` des Glücksrads `spiegel.enabled: false`.

## Aufbau

Ein Durable Object je `raum` hält die WebSocket-Verbindungen und reicht jede
Nachricht der Anzeige an alle übrigen weiter. Nachrichten von Zuschauern werden
verworfen. Die Verbindungen laufen über die Hibernation-API, überstehen also
lange Ruhephasen. Ein Ping alle 30 Sekunden hält Router davon ab, die Leitung
wegen Untätigkeit zu kappen.

Mehrere Aktionen können denselben Dienst nutzen — sie brauchen nur einen eigenen
`raum` (in `config.js` unter `spiegel.raum`).
