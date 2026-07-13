/* =========================================================================
   MARINE-HINTERGRUND-SZENE (Canvas) – OceanPilot-Stil
   -------------------------------------------------------------------------
   Animierter Hintergrund: Radar-Sweep, Windanzeige (Kompass), Leuchtturm mit
   drehendem Strahl, Wind-Partikel + Seekarten-Gitter. Farben aus der CI, oben
   links bewusst ruhig/dunkel, damit das OceanPilot-Logo gut lesbar bleibt.

   Steuerung von aussen (js/app.js):
     MarineBG.start(canvas) – Szene starten
     MarineBG.freeze()      – einfrieren (Standbild) bei Rad-Auslösung
     MarineBG.resume()      – weiterlaufen, wenn Overlay/QR verschwindet
   Der Zeitversatz wird gemerkt, damit resume nahtlos dort weitermacht.
   ========================================================================= */
(function () {
  'use strict';

  var canvas, ctx, W = 0, H = 0, dpr = 1;
  var raf = null, running = false;
  var startTs = 0, frozenElapsed = 0, lastRender = 0;
  var particles = [];

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth  || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedParticles();
  }

  function seedParticles() {
    particles = [];
    var n = Math.max(24, Math.min(60, Math.round(W * H / 36000)));
    for (var i = 0; i < n; i++) {
      particles.push({ x: rnd(0, W), y: rnd(H * 0.05, H * 0.95),
                       len: rnd(16, 46), spd: rnd(14, 34), a: rnd(0.04, 0.12) });
    }
  }

  /* ---- Szene ---- */
  function scene(time) {
    // Hintergrund-Verlauf (marine Tiefe)
    var g = ctx.createRadialGradient(W * 0.5, H * 0.12, 0, W * 0.5, H * 0.12, Math.max(W, H) * 0.9);
    g.addColorStop(0, '#14496f'); g.addColorStop(0.5, '#0B1F3A'); g.addColorStop(1, '#07142A');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    grid();
    windParticles();
    radar(W * 0.60, H * 0.52, Math.min(W, H) * 0.34, time);   // hinter/um das Rad

    // Leuchtturm (unten links) – Strahl pendelt Richtung Logo und wieder weg
    var lhX = W * 0.13, lhY = H, lhH = H * 0.42;
    var lanternY = lhY - lhH;
    var sweep = -0.95 + Math.sin(time * 0.45) * 0.85;         // Mitte ~Richtung Logo
    lighthouse(lhX, lhY, lhH, sweep);
    windGauge(W * 0.30, H * 0.80, Math.min(W, H) * 0.07, time);

    // Leichter Ruhe-Schleier oben links (dezent – Logo ist ohnehin weiss/hell)
    var lg = ctx.createRadialGradient(W * 0.18, H * 0.26, 0, W * 0.18, H * 0.26, W * 0.40);
    lg.addColorStop(0, 'rgba(7,20,42,0.22)'); lg.addColorStop(1, 'rgba(7,20,42,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);

    // Logo-Lichtschein: heller, wenn der Leuchtturm-Strahl Richtung Logo zeigt
    var logoX = W * 0.25, logoY = H * 0.38;
    var toLogo = Math.atan2(logoY - lanternY, logoX - lhX);
    var da = Math.abs(Math.atan2(Math.sin(sweep - toLogo), Math.cos(sweep - toLogo)));
    var lit = Math.max(0, 1 - da / 0.75);
    if (lit > 0) {
      var sg = ctx.createRadialGradient(logoX, logoY, 0, logoX, logoY, W * 0.32);
      sg.addColorStop(0, 'rgba(155,228,255,' + (0.40 * lit) + ')');
      sg.addColorStop(0.6, 'rgba(150,220,255,' + (0.14 * lit) + ')');
      sg.addColorStop(1, 'rgba(150,220,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    }
  }

  function grid() {
    ctx.strokeStyle = 'rgba(88,196,240,0.05)'; ctx.lineWidth = 1;
    var step = Math.max(60, W / 22);
    ctx.beginPath();
    for (var x = 0; x <= W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (var y = 0; y <= H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }

  function windParticles() {
    var vx = Math.cos(-0.35), vy = Math.sin(-0.35);   // Wind nach rechts-oben
    ctx.lineWidth = 1.4;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += vx * p.spd * 0.016; p.y += vy * p.spd * 0.016;
      if (p.x > W + 50 || p.y < -50) { p.x = rnd(-50, W * 0.4); p.y = rnd(H * 0.4, H + 50); }
      ctx.strokeStyle = 'rgba(120,200,240,' + p.a + ')';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - vx * p.len, p.y - vy * p.len); ctx.stroke();
    }
  }

  function radar(cx, cy, R, time) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(88,196,240,0.22)'; ctx.lineWidth = 1;
    for (var i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(0, 0, R * i / 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.moveTo(0, -R); ctx.lineTo(0, R); ctx.stroke();

    var ang = (time * 0.6) % (Math.PI * 2);
    ctx.save(); ctx.rotate(ang);
    for (var k = 0; k < 22; k++) {                     // nachlaufender Sweep-Keil
      var a0 = -k * 0.05, a1 = -(k + 1) * 0.05;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a1, a0); ctx.closePath();
      ctx.fillStyle = 'rgba(88,196,240,' + (0.13 * (1 - k / 22)) + ')'; ctx.fill();
    }
    ctx.strokeStyle = 'rgba(150,225,255,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R, 0); ctx.stroke();
    ctx.restore();

    var blips = [[0.55, -0.6], [0.8, 2.1], [0.35, 3.6]];
    for (var b = 0; b < blips.length; b++) {
      var br = blips[b][0] * R, ba = blips[b][1];
      var d = Math.abs(((ang - ba) % (Math.PI * 2)));
      var pulse = Math.max(0, 1 - d * 1.4);
      ctx.fillStyle = 'rgba(150,235,255,' + (0.15 + 0.6 * pulse) + ')';
      ctx.beginPath(); ctx.arc(Math.cos(ba) * br, Math.sin(ba) * br, 3 + 3 * pulse, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function lighthouse(x, baseY, h, sweep) {
    var lanternY = baseY - h;
    ctx.save(); ctx.translate(x, lanternY); ctx.rotate(sweep);
    var bl = Math.max(W, H) * 0.75;
    var bg = ctx.createLinearGradient(0, 0, bl, 0);
    bg.addColorStop(0, 'rgba(150,220,255,0.26)'); bg.addColorStop(1, 'rgba(150,220,255,0)');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bl, -44); ctx.lineTo(bl, 44); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Turm
    ctx.save(); ctx.translate(x, baseY);
    var w = h * 0.16;
    ctx.fillStyle = 'rgba(12,31,58,0.96)';
    ctx.beginPath();
    ctx.moveTo(-w * 0.85, 0); ctx.lineTo(-w * 0.45, -h * 0.86);
    ctx.lineTo(w * 0.45, -h * 0.86); ctx.lineTo(w * 0.85, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(88,196,240,0.55)'; ctx.lineWidth = 2.5; ctx.stroke();   // Kontur cyan
    // rote/cyan Streifen
    ctx.strokeStyle = 'rgba(88,196,240,0.4)'; ctx.lineWidth = 2;
    for (var s = 1; s <= 3; s++) { var yy = -h * 0.86 * (s / 4); ctx.beginPath(); ctx.moveTo(-w * 0.72 + (w * 0.4 * s / 4) * 0, yy); ctx.lineTo(w * 0.72, yy); ctx.stroke(); }
    // Laterne mit Glühen
    var glow = ctx.createRadialGradient(0, -h, 0, 0, -h, w * 1.6);
    glow.addColorStop(0, 'rgba(150,225,255,0.85)'); glow.addColorStop(1, 'rgba(150,225,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -h, w * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(180,235,255,0.95)';
    ctx.fillRect(-w * 0.5, -h - h * 0.05, w, h * 0.16);
    ctx.fillStyle = 'rgba(12,31,58,0.98)';                  // Dach
    ctx.beginPath(); ctx.moveTo(-w * 0.62, -h - h * 0.05); ctx.lineTo(0, -h * 1.16); ctx.lineTo(w * 0.62, -h - h * 0.05); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function windGauge(cx, cy, R, time) {
    ctx.save(); ctx.translate(cx, cy);
    ctx.strokeStyle = 'rgba(88,196,240,0.30)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = 'rgba(140,200,240,0.55)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = (R * 0.32) + 'px system-ui, sans-serif';
    var dirs = ['N', 'O', 'S', 'W'];
    for (var i = 0; i < 4; i++) { var a = -Math.PI / 2 + i * Math.PI / 2; ctx.fillText(dirs[i], Math.cos(a) * R * 1.32, Math.sin(a) * R * 1.32); }

    var kn = 10 + Math.round(6 * Math.abs(Math.sin(time * 0.15)));   // kn-Wert
    ctx.fillStyle = 'rgba(180,225,255,0.72)'; ctx.font = '700 ' + (R * 0.5) + 'px system-ui, sans-serif';
    ctx.fillText(kn + ' kn', 0, R * 1.85);

    var wa = -Math.PI / 2 + Math.sin(time * 0.12) * 1.2;            // Windnadel
    ctx.save(); ctx.rotate(wa);
    ctx.fillStyle = 'rgba(150,225,255,0.8)';
    ctx.beginPath(); ctx.moveTo(0, -R * 0.8); ctx.lineTo(R * 0.18, 0); ctx.lineTo(-R * 0.18, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(88,196,240,0.38)';
    ctx.beginPath(); ctx.moveTo(0, R * 0.8); ctx.lineTo(R * 0.14, 0); ctx.lineTo(-R * 0.14, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  /* ---- Loop / Steuerung ---- */
  function loop(ts) {
    if (!running) return;
    if (!startTs) startTs = ts - frozenElapsed;
    if (ts - lastRender >= 33) {            // ~30 fps
      lastRender = ts;
      scene((ts - startTs) / 1000);
    }
    raf = requestAnimationFrame(loop);
  }

  function start(cv) {
    canvas = cv; ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    resume();
  }
  function resume() {
    if (running) return;
    running = true; startTs = 0; lastRender = 0;
    raf = requestAnimationFrame(loop);
  }
  function freeze() {
    if (!running) return;
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    frozenElapsed = (window.performance ? performance.now() : 0) - startTs;   // Zeit merken
  }

  window.MarineBG = { start: start, freeze: freeze, resume: resume,
                      isRunning: function () { return running; } };
})();
