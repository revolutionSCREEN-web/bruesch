/* =========================================================================
   RADSPIEGEL  ·  Brüesch Glücksrad
   -------------------------------------------------------------------------
   Ein Weiterreicher, mehr nicht: Das Anzeigegerät am Stand schickt bei jedem
   Buzzer-Druck eine kurze Nachricht («drehe auf Feld 3»), und jeder
   verbundene Zuschauer-Bildschirm bekommt sie sofort. Damit läuft auf dem
   Beamer dieselbe Drehung wie am Stand.

   Es wird NICHTS gespeichert und nichts ausgewertet. Fällt der Dienst oder
   das Netz aus, dreht das Rad am Stand unverändert weiter – nur der Beamer
   bleibt dann stehen.

   Adressen:
     wss://<worker>/kanal?raum=bruesch&rolle=display     (das Rad am Stand)
     wss://<worker>/kanal?raum=bruesch&rolle=zuschauer   (Beamer)
     https://<worker>/status?raum=bruesch                (wer ist verbunden)
   ========================================================================= */

export class RadKanal {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Kleine Auskunftsseite – praktisch zum Prüfen am Messestand.
    if (url.pathname.endsWith('/status')) {
      const alle = this.state.getWebSockets();
      let display = 0, zuschauer = 0;
      for (const ws of alle) {
        const rolle = this.rolleVon(ws);
        if (rolle === 'display') display++; else zuschauer++;
      }
      return Response.json({
        raum: url.searchParams.get('raum') || 'bruesch',
        display, zuschauer, verbunden: alle.length
      }, { headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Hier spricht der Radspiegel. Verbindung nur per WebSocket.', {
        status: 426, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }

    const paar   = new WebSocketPair();
    const client = paar[0], server = paar[1];
    const rolle  = url.searchParams.get('rolle') === 'display' ? 'display' : 'zuschauer';

    // Hibernation: Die Verbindung überlebt, auch wenn der Dienst zwischendurch
    // schlafen gelegt wird – wichtig bei langen Ruhephasen am Messestand.
    this.state.acceptWebSocket(server, [rolle]);

    return new Response(null, { status: 101, webSocket: client });
  }

  rolleVon(ws) {
    const tags = this.state.getTags(ws);
    return (tags && tags.length) ? tags[0] : 'zuschauer';
  }

  /* Nachricht vom Stand -> an alle Zuschauer weiterreichen.
     Zuschauer dürfen nichts senden; käme trotzdem etwas, wird es verworfen. */
  webSocketMessage(ws, nachricht) {
    if (this.rolleVon(ws) !== 'display') return;
    if (typeof nachricht !== 'string' || nachricht.length > 2000) return;
    for (const ziel of this.state.getWebSockets()) {
      if (ziel === ws) continue;
      try { ziel.send(nachricht); } catch (e) { /* Verbindung weg – egal */ }
    }
  }

  webSocketClose(ws, code, grund, sauber) {
    try { ws.close(code, grund); } catch (e) {}
  }

  webSocketError(ws) {
    try { ws.close(1011, 'Fehler'); } catch (e) {}
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/' ) {
      return new Response(
        'Radspiegel läuft. Verbindung: /kanal?raum=bruesch&rolle=zuschauer',
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    // Ein Raum = ein Glücksrad. Mehrere Aktionen können denselben Dienst nutzen.
    const raum = (url.searchParams.get('raum') || 'bruesch').slice(0, 60);
    const id   = env.KANAL.idFromName(raum);
    return env.KANAL.get(id).fetch(request);
  }
};
