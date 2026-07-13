/* =========================================================================
   GLÜCKSRAD – STEUERLOGIK (Signage)
   -------------------------------------------------------------------------
   - Bewegungssensor-Trigger (Tastencode aus config) mit Cooldown/Debounce
   - Echter Zufall über easyWheel (selector:false + random:true)
   - Gewinn-/Niete-Overlay inkl. optionalem QR-Code
   - Attract-Modus (langsames Leerlauf-Drehen) + Idle-Watchdog
   Alle Einstellungen kommen aus config.js – hier nichts hartkodieren.
   ========================================================================= */
(function () {
  'use strict';
  var $   = window.jQuery;
  var CFG = window.GLUECKSRAD_CONFIG;

  // Zustandsmaschine: 'ready' (Leerlauf/Attract) -> 'spinning' -> 'result' -> 'ready'
  var state = 'ready';
  var locked = false;            // Doppel-Auslöse-Schutz während Dreh/Ergebnis
  var cooldownTimer = null;
  var overlayTimer  = null;
  var watchdogTimer = null;
  var countdownTimer = null;

  var tick = document.getElementById('tick');
  var wheelInst = null;          // Referenz auf die easyWheel-Instanz (für currentSlice)

  /* --- Glücksrad-Dreh-Geräusch (Web Audio, offline, ohne Sound-Datei) -----
     Synthetisiert eine „Ratsche": kurze Peg-Klicks, die – wie bei einem echten
     Rad – gegen Ende immer langsamer und leiser werden (Verlangsamung). Wird
     beim Dreh-Start für die gesamte Dreh-Dauer im Voraus getaktet. */
  var _ac = null;
  function audioCtx() {
    if (!_ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { try { _ac = new AC(); } catch (e) { _ac = null; } }
    }
    if (_ac && _ac.state === 'suspended') { try { _ac.resume(); } catch (e) {} }
    return _ac;
  }
  function pegClick(ctx, when, vol) {
    // kurzer, holziger Klick = gefiltertes Rauschen mit schnellem Abfall
    var dur = 0.028;
    var n = Math.max(1, Math.ceil(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) { var e = 1 - i / n; d[i] = (Math.random() * 2 - 1) * e * e; }
    var src = ctx.createBufferSource(); src.buffer = buf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 1.1;
    var g = ctx.createGain(); g.gain.value = vol;
    src.connect(bp); bp.connect(g); g.connect(ctx.destination);
    try { src.start(when); } catch (e) {}
  }
  // Umkehrfunktion der Rad-Easing (easyWheel == easeOutQuart): Fortschritt p (0..1)
  // -> Zeitanteil x (0..1).  p = 1-(1-x)^4  =>  x = 1-(1-p)^(1/4)
  function easeOutQuartInv(p) { return 1 - Math.pow(1 - p, 0.25); }

  // Glücksrad-Dreh-Geräusch: taktet die Peg-Klicks im Voraus entlang DERSELBEN
  // Kurve, die das Rad dreht (easyWheel == easeOutQuart). Klicks liegen in gleichen
  // Winkelschritten (= echte Feld-Übergänge) und werden dadurch – wie das Rad –
  // gegen Ende von selbst langsamer.
  //  - Am Anfang (sehr schnelle Drehung) auf minGap gedrosselt -> kein Gebrassel.
  //  - Ende bei P_CAP (~0.997): ab da bewegt sich das Rad nur noch <~6°/s = optisch
  //    stillstehend; die restliche Auslaufzeit bis onComplete ist unsichtbares
  //    Kriechen und bekommt bewusst keinen Klick mehr (sonst „klickt nach Stopp").
  // ACHTUNG: gilt für easing 'easyWheel'/'easeOutQuart' (siehe initWheel).
  function playWheelSpinSound(durMs) {
    if (!CFG.behavior || !CFG.behavior.sound) return;
    var ctx = audioCtx(); if (!ctx) return;
    var D = Math.max(0.3, durMs / 1000);
    var t0 = ctx.currentTime;                 // Rad-Animation startet praktisch jetzt
    var M = 240;                              // feine Fortschritts-Schritte (Winkel)
    var MIN_GAP = 0.045;                       // min. Abstand zweier Klicks (Anti-Gebrassel)
    var P_CAP = 0.997;                         // Klicks bis hierhin -> optischer Stillstand
    var last = -1;
    for (var j = 1; j <= M; j++) {
      var p = (j / M) * P_CAP;                 // 0 .. P_CAP in feinen Winkelschritten
      var t = easeOutQuartInv(p) * D;          // Zeitpunkt auf der echten Rad-Kurve
      if (last < 0 || (t - last) >= MIN_GAP) { // Start drosseln, Ende von selbst dünn
        pegClick(ctx, t0 + t, 0.32 * (1 - 0.5 * p));   // gegen Ende leiser
        last = t;
      }
    }
  }

  /* --- Debug-Log am Bildschirm (nur wenn behavior.debug === true) --------
     Zeigt jede Taste + Reaktion mit Zeitstempel -> damit sichtbar ist, ob
     das Sensor-"Enter" spät ankommt (Fokus/Sensor) oder sofort (dann Rendering). */
  var dbgBox = null, lastKeyT = 0;
  function now() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function dbg(msg) {
    if (!CFG.behavior || !CFG.behavior.debug) return;
    if (!dbgBox) {
      dbgBox = document.createElement('div');
      dbgBox.id = 'debug-log';
      document.body.appendChild(dbgBox);
    }
    var t = now();
    var gap = lastKeyT ? (' (+' + Math.round(t - lastKeyT) + 'ms seit letzter Taste)') : '';
    var line = document.createElement('div');
    line.textContent = new Date().toLocaleTimeString() + '  ' + msg + gap;
    dbgBox.insertBefore(line, dbgBox.firstChild);
    while (dbgBox.childNodes.length > 14) dbgBox.removeChild(dbgBox.lastChild);
  }

  /* --- Branding aus config auf die Seite anwenden ----------------------- */
  function applyBranding() {
    var b = CFG.brand;
    document.getElementById('brand-logo').src        = b.logo;
    document.getElementById('brand-title').innerHTML = b.title;
    document.getElementById('brand-subtitle').innerHTML = b.subtitle;
    document.getElementById('cta-hint').textContent  = CFG.messages.cta || '';
    var root = document.documentElement.style;
    root.setProperty('--bg',     b.background);
    root.setProperty('--fg',     b.textColor);
    root.setProperty('--accent', b.accentColor);

    // Hintergrund: animierte Szene hat Vorrang, sonst Video, sonst nur Farbe
    var canvasEl = document.getElementById('bg-canvas');
    var vid = document.getElementById('bg-video');
    if (b.backgroundScene && window.MarineBG) {
      if (vid) vid.style.display = 'none';
      if (canvasEl) { canvasEl.style.display = 'block'; window.MarineBG.start(canvasEl); }
    } else if (b.backgroundVideo && vid) {
      if (canvasEl) canvasEl.style.display = 'none';
      vid.muted = true;                      // Autoplay nur stumm erlaubt
      vid.src = b.backgroundVideo;
      var pr = vid.play();
      if (pr && pr.catch) pr.catch(function () {});
    } else {
      if (canvasEl) canvasEl.style.display = 'none';
      if (vid) vid.style.display = 'none';   // nur Farbe/Verlauf
    }
  }

  /* --- Hintergrund einfrieren / weiterlaufen ---------------------------- */
  function bgFreeze() {                        // bei Rad-Auslösung -> Standbild
    if (CFG.brand.backgroundScene && window.MarineBG) window.MarineBG.freeze();
    var v = document.getElementById('bg-video');
    if (v && CFG.brand.backgroundVideo) { try { v.pause(); } catch (e) {} }
  }
  function bgResume() {                        // wenn Overlay/QR verschwindet
    if (CFG.brand.backgroundScene && window.MarineBG) window.MarineBG.resume();
    var v = document.getElementById('bg-video');
    if (v && CFG.brand.backgroundVideo) { try { v.play(); } catch (e) {} }
  }

  /* --- easyWheel initialisieren ----------------------------------------- */
  function initWheel() {
    $('.easywheel').easyWheel({
      items: CFG.segments.map(function (s) {
        return { id: s.id, name: s.name, color: s.color, win: s.win, message: '' };
      }),
      random:   true,     // keine Sofort-Wiederholung
      selector: false,    // <- ECHTER ZUFALL: Plugin nutzt intern getRandomInt()
      selected: false,
      duration: CFG.behavior.spinDurationMs,
      rotates:  4,
      frame:    1,
      easing:   'easyWheel',
      centerImage:  CFG.brand.centerImage,
      rotateCenter: false,
      type:     'spin',
      width:    CFG.layout.wheelSize,
      fontSize: 30, textOffset: 0, letterSpacing: 1, textLine: 'v', textArc: 0,
      shadowOpacity: 1, sliceLineWidth: 1, outerLineWidth: 3,
      centerWidth: 18, centerLineWidth: 5, centerImageWidth: 12,
      textColor: '#fff', markerColor: CFG.brand.markerColor || '#404649', centerLineColor: '#fff',
      centerBackground: CFG.brand.centerBackground || '#fff', sliceLineColor: '#fff', outerLineColor: '#fff',
      shadow: '#000', selectedSliceColor: CFG.brand.accentColor,
      button: '.spin-to-win',
      // Dreh-Geräusch übernimmt playWheelSpinSound (vorab getaktet, exakt entlang
      // der Rad-Kurve). Kein Einzel-Klick pro onStep -> sonst doppelt.
      onStep: function () {},
      onComplete: function () { onSpinComplete(); }
    });
    // Instanz merken – das Plugin legt sie als .easyWheel aufs Element
    wheelInst = document.querySelector('.easywheel').easyWheel;
  }

  /* --- Attract-Modus (langsames Leerlauf-Drehen) ------------------------ */
  function enterAttract() {
    if (!CFG.behavior.attractMode) return;
    // Inline-Transform des Plugins löschen, damit die CSS-Animation sauber startet
    $('.easywheel').find('.eWheel').css('transform', '');
    document.body.classList.add('attract');
  }
  function exitAttract() {
    document.body.classList.remove('attract');
    // laufende Animation stoppen, damit das Plugin die Rotation übernimmt
    $('.easywheel').find('.eWheel').css('transform', '');
  }

  /* --- Auslöser (Bewegungssensor / Tap) --------------------------------- */
  function trigger(src) {
    if (locked || state !== 'ready') {          // nur aus Bereitschaft, kein Doppel-Trigger
      dbg('IGNORIERT (' + (src || '?') + ') – state=' + state + ' locked=' + locked);
      return;
    }
    dbg('▶ DREHUNG START (' + (src || '?') + ')');
    locked = true;
    state  = 'spinning';
    hideOverlay();
    exitAttract();
    bgFreeze();                                 // Hintergrund einfrieren (Standbild)
    playWheelSpinSound(CFG.behavior.spinDurationMs);  // Dreh-Geräusch, synchron zur Rad-Kurve
    // Fallback-Cooldown: löst die Sperre, falls onComplete ausbleibt
    clearTimeout(cooldownTimer);
    cooldownTimer = setTimeout(returnToReady, CFG.behavior.cooldownMs);
    armWatchdog();
    document.getElementById('spin').click();    // -> easyWheel start()
  }

  /* --- Ergebnis anzeigen ------------------------------------------------ */
  function onSpinComplete() {
    state = 'result';
    // Tatsächlich gelandete Slice aus der Instanz lesen (Quelle der Wahrheit).
    // (Das Plugin füllt onComplete-Argumente in diesem Build nicht, daher currentSlice.)
    var idx = (wheelInst && typeof wheelInst.currentSlice === 'number') ? wheelInst.currentSlice : -1;
    var seg = CFG.segments[idx] || {};
    var won = !!seg.win;
    var m   = CFG.messages;

    var ov = document.getElementById('overlay');
    ov.classList.remove('win', 'lose');
    ov.classList.add(won ? 'win' : 'lose');

    document.getElementById('overlay-title').textContent = won ? m.winTitle : m.loseTitle;
    document.getElementById('overlay-text').textContent  = won ? m.winText  : m.loseText;
    document.getElementById('overlay-prize').innerHTML   = won && seg.prize ? seg.prize : '';
    // Optionaler Hinweistext unter dem Preis (z. B. Verlosungs-Bedingungen beim Hauptpreis)
    document.getElementById('overlay-note').textContent  = won && seg.note ? seg.note : '';

    // QR-Code bei Gewinn: fester Segment-Link ODER Lead-Formular (Preis + ID)
    var qrBox  = document.getElementById('overlay-qr');
    var qrHint = document.getElementById('overlay-qrhint');
    qrBox.innerHTML = '';
    qrHint.textContent = '';
    var qrTarget = null;
    if (won) {
      if (seg.qr) {
        qrTarget = seg.qr;                                   // fester Link je Segment (Vorrang)
      } else if (CFG.lead && CFG.lead.enabled && CFG.lead.formUrl &&
                 CFG.lead.formUrl.indexOf('DEINE-DOMAIN') === -1) {
        // Formular-URL mit Preis + eindeutiger Spin-ID für den QR bauen
        var prize  = seg.prize || (seg.name || '').replace(/<[^>]+>/g, ' ').trim();
        var spinId = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
        qrTarget = CFG.lead.formUrl
                 + (CFG.lead.formUrl.indexOf('?') < 0 ? '?' : '&')
                 + 'prize=' + encodeURIComponent(prize)
                 + '&id='   + encodeURIComponent(spinId);
      }
    }
    if (qrTarget) {
      try {
        var qr = qrcode(0, 'M');
        qr.addData(qrTarget);
        qr.make();
        qrBox.innerHTML = qr.createImgTag(6, 8);
        qrHint.textContent = m.qrHint || '';
      } catch (e) { qrHint.textContent = ''; }
    }

    ov.classList.add('visible');
    ov.setAttribute('aria-hidden', 'false');

    // Fallback-Cooldown wird nicht mehr gebraucht (Ergebnis erreicht) -> stoppen,
    // sonst würde er das Overlay vorzeitig schliessen.
    clearTimeout(cooldownTimer);
    startCountdown(CFG.behavior.overlayAutoCloseMs);
  }

  /* --- Countdown im Overlay (Zahl + schrumpfender Balken) --------------- */
  function startCountdown(ms) {
    var total  = Math.max(1, Math.round(ms / 1000));
    var textEl = document.getElementById('cd-text');
    var fillEl = document.getElementById('cd-fill');
    var tmpl   = (CFG.messages && CFG.messages.countdown) || 'Noch {s} Sekunden';
    // Balken von 100% -> 0% über die Gesamtzeit (linear)
    if (fillEl) {
      fillEl.style.transition = 'none';
      fillEl.style.width = '100%';
      void fillEl.offsetWidth;                 // Reflow erzwingen
      fillEl.style.transition = 'width ' + ms + 'ms linear';
      fillEl.style.width = '0%';
    }
    var remaining = total;
    function render() {
      if (textEl) textEl.textContent = tmpl.replace('{s}', remaining);
    }
    render();
    clearInterval(countdownTimer);
    countdownTimer = setInterval(function () {
      remaining--;
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        returnToReady();
        return;
      }
      render();
    }, 1000);
  }

  function hideOverlay() {
    var ov = document.getElementById('overlay');
    ov.classList.remove('visible');
    ov.setAttribute('aria-hidden', 'true');
  }

  /* --- Zurück in Bereitschaft ------------------------------------------- */
  function returnToReady() {
    clearTimeout(cooldownTimer);
    clearTimeout(overlayTimer);
    clearTimeout(watchdogTimer);
    clearInterval(countdownTimer);
    hideOverlay();
    state  = 'ready';
    locked = false;
    enterAttract();
    bgResume();                                 // Hintergrund läuft wieder (QR weg)
  }

  // Notbremse: bleibt ein Zustand länger als idleWatchdogMs hängen -> Reset
  function armWatchdog() {
    clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(function () {
      if (state !== 'ready') returnToReady();
    }, CFG.behavior.idleWatchdogMs);
  }

  /* --- Fokus sichern (wichtig im LINK-App/iframe) ------------------------
     Ohne Tastatur-Fokus kommt das Sensor-"Enter" nicht an -> Fokus aktiv holen
     und regelmässig nachfassen. */
  function grabFocus() {
    try {
      if (document.body && document.activeElement !== document.body) document.body.focus();
      window.focus();
    } catch (e) {}
  }

  /* --- Eingaben ---------------------------------------------------------- */
  function onKey(e) {
    var code = e.which || e.keyCode;
    // Gehaltene Taste erzeugt Auto-Wiederholung -> ignorieren
    if (e.repeat) { dbg('Taste ' + code + ' (Auto-Repeat, ignoriert)'); return; }
    dbg('Taste ' + code + (code === CFG.behavior.triggerKeyCode ? ' = AUSLÖSER' : ''));
    lastKeyT = now();
    if (code === CFG.behavior.triggerKeyCode) {
      if (e.preventDefault) e.preventDefault();
      trigger('Taste ' + code);
    }
  }

  function bindInputs() {
    // Nativ, Capture-Phase, auf window UND document -> früh und robust,
    // auch wenn der Fokus in einem verschachtelten Element/iframe sitzt.
    window.addEventListener('keydown', onKey, true);
    // Fallback: manche HID-Geräte liefern nur keypress
    window.addEventListener('keypress', function (e) {
      if ((e.which || e.keyCode) === CFG.behavior.triggerKeyCode && state === 'ready' && !locked) {
        onKey(e);
      }
    }, true);
    // Tap/Klick irgendwo -> auslösen (Touch-Display / Test) + Fokus holen
    document.addEventListener('click', function () { grabFocus(); trigger('Tap/Klick'); }, true);
  }

  /* --- Start ------------------------------------------------------------- */
  $(function () {
    applyBranding();
    initWheel();
    if (document.body) document.body.tabIndex = -1;   // Body fokussierbar machen
    bindInputs();
    grabFocus();
    setInterval(grabFocus, 2000);                     // Fokus periodisch nachfassen
    document.addEventListener('visibilitychange', function () { if (!document.hidden) grabFocus(); });
    dbg('Bereit. Auslöser-Taste = Code ' + CFG.behavior.triggerKeyCode);
    enterAttract();
  });

})();
