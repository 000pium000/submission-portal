/* ============================================================
   "Loading… Please Wait"
   Multi-page version: the deadline follows the viewer across
   login.html -> form.html -> confirm.html via URL parameters,
   so no storage APIs are needed (works inside sandboxed iframes).

   Total experience: 40 seconds.
   Narrative: avoidance -> delay -> guilt -> deadline pressure -> rushed completion
   ============================================================ */

(function () {
  'use strict';

  const TOTAL_SECONDS = 40;
  const ANXIOUS_AT = 20; // pink + shaking
  const DARK_AT = 8; // black + chaos + ticking

  // ---------- state from the URL ----------
  const params = new URLSearchParams(location.search);
  let secondsLeft = Math.min(parseInt(params.get('t'), 10) || TOTAL_SECONDS, TOTAL_SECONDS);
  let avoided = parseInt(params.get('a'), 10) || 0;
  if (Number.isNaN(secondsLeft)) secondsLeft = TOTAL_SECONDS;
  if (Number.isNaN(avoided)) avoided = 0;

  const page = document.body.dataset.page; // 'start' | 'login' | 'form' | 'confirm'
  const isStart = page === 'start';

  // ---------- elements ----------
  const els = {
    startBtn: document.getElementById('start-btn'),
    form: document.getElementById('task-form'),
    status: document.getElementById('task-status'),
    avoided: document.getElementById('avoided'),
    loadingFill: document.getElementById('loading-fill'),
    loadingText: document.getElementById('loading-text'),
    chatBubble: document.getElementById('chat-bubble'),
    chatText: document.getElementById('chat-text'),
    countdown: document.getElementById('countdown'),
    countdownTime: document.getElementById('countdown-time'),
    chaosLayer: document.getElementById('chaos-layer'),
    finalScreen: document.getElementById('final-screen'),
    restartBtn: document.getElementById('restart-btn'),
    pills: Array.from(document.querySelectorAll('.pill')),
    sumLogin: document.getElementById('sum-login'),
    sumForm: document.getElementById('sum-form'),
    sumConfirm: document.getElementById('sum-confirm'),
  };

  // ---------- state ----------
  let countdownTimer = null;
  let chaosTimer = null;
  let idleThoughtTimer = null;
  let bubbleFadeTimer = null;
  let tickTimer = null;
  let finished = false;
  let attemptBusy = false;

  // ---------- the website's inner voice ----------
  const procrastinatingThoughts = [
    'Just one more moment…',
    "I don't want to do this now.",
    'Maybe later. There is still time.',
    "I'll start after checking one more thing.",
    'This can probably wait.',
    'I work better under pressure anyway.',
    'There is still time… probably.',
  ];

  const anxiousThoughts = [
    'The deadline is close.',
    'I should have started earlier.',
    'Why did I leave this until now?',
    'No. No. No.',
    'Everything is happening at once.',
  ];

  const popupMessages = [
    'Reminder: task unfinished',
    'Are you still there?',
    'New notification (1)',
    'Please wait…',
    'One more thing',
    'Update available — later',
    'Do not close this page',
    'Task postponed successfully',
    'You have unfinished tasks',
    'Loading… still loading',
  ];

  // ---------- sound (subtle, synthesized — no audio files) ----------
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        audioCtx = null;
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playTone(freq, duration, volume) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      /* audio is optional; the artwork works silently too */
    }
  }

  function startTicking() {
    stopTicking();
    tickTimer = setInterval(() => playTone(880, 0.05, 0.03), 1000);
  }

  function stopTicking() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
  }

  // ---------- helpers ----------
  function say(message) {
    if (!els.chatBubble) return;
    els.chatText.textContent = message;
    els.chatBubble.classList.remove('hidden');
    els.chatBubble.classList.remove('faded');
    if (bubbleFadeTimer) clearTimeout(bubbleFadeTimer);
    bubbleFadeTimer = setTimeout(() => els.chatBubble.classList.add('faded'), 4200);
  }

  function updateLoading(percent, text) {
    if (!els.loadingFill) return;
    els.loadingFill.style.width = percent + '%';
    els.loadingText.textContent = text;
  }

  // carry the countdown (and the guilt) into every link
  function rewriteLinks() {
    const q = '?t=' + Math.max(secondsLeft, 0) + '&a=' + avoided;
    els.pills.forEach((pill) => {
      const href = pill.getAttribute('href');
      pill.href = href.split('?')[0] + q;
    });
  }

  function randomPopup() {
    if (!els.chaosLayer) return;
    const popup = document.createElement('div');
    popup.className = 'popup';
    popup.textContent = popupMessages[Math.floor(Math.random() * popupMessages.length)];

    // desktop-only design: side rails, measured from the card edge
    popup.style.visibility = 'hidden';
    els.chaosLayer.appendChild(popup);
    const pw = popup.offsetWidth;
    const ph = popup.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const card = document.getElementById('site');
    const cardRect = card ? card.getBoundingClientRect() : { left: vw * 0.2, right: vw * 0.8 };
    const railW = Math.max(cardRect.left - 16, 8);
    const railWRight = Math.max(vw - cardRect.right - 16, 8);
    let x;
    if (Math.random() < 0.5 && railW - pw > 8) {
      x = 8 + Math.random() * (railW - pw - 8);
    } else if (railWRight - pw > 8) {
      x = cardRect.right + 8 + Math.random() * (railWRight - pw - 8);
    } else {
      // Canvas layout: rails are narrow, so fall back to anywhere over the content column
      x = cardRect.left + 8 + Math.random() * Math.max(cardRect.width - pw - 16, 8);
    }
    const y = 40 + Math.random() * Math.max(vh - ph - 80, 20);
    popup.style.left = Math.round(x) + 'px';
    popup.style.top = Math.round(y) + 'px';
    popup.style.visibility = '';
    setTimeout(() => popup.remove(), 3200);
  }

  function markTaskDone() {
    if (els.status) {
      els.status.textContent = 'Completed at the last moment';
      els.status.style.color = 'var(--color-success)';
      els.status.style.fontWeight = '600';
    }
    const btn = els.form && els.form.querySelector('.task-btn');
    if (btn) btn.disabled = true;
    els.pills.forEach((pill) => {
      const s = pill.querySelector('.pill-status');
      if (s) {
        s.textContent = 'Completed at the last moment';
        s.classList.add('done');
      }
    });
    if (els.sumLogin) els.sumLogin.textContent = 'Yes, eventually';
    if (els.sumForm) els.sumForm.textContent = 'Yes, eventually';
    if (els.sumConfirm) els.sumConfirm.textContent = 'Yes, eventually';
  }

  // ---------- loading icons: calm -> chaotic ----------
  // Two flat, monochrome spinners only (no glow, no colours):
  // a chasing-dots ring and an iOS-style 12-spoke wheel.
  // One quiet spinner while calm; a drifting few when anxious;
  // a storm of them when the deadline hits.
  let spinnerLayer = null;
  let spinnerTimer = null;

  const SPINNER_TYPES = ['dots', 'spokes'];

  const SPINNER_PHASES = {
    calm:    { interval: 0,    size: [14, 18], dur: [1.2, 1.2], life: [0, 0],     types: ['spokes'],       colors: ['#8a97a0'], opacity: 0.6 },
    anxious: { interval: 1800, size: [22, 44], dur: [0.9, 1.3], life: [3.5, 5],   types: ['dots', 'spokes'], colors: ['#2d3b45', '#5c6a75'], opacity: 0.85 },
    deadline:{ interval: 260,  size: [24, 260], dur: [0.5, 1.1], life: [2.6, 4.6], types: SPINNER_TYPES,   colors: ['#f0e9e0', '#ffffff', '#c7cdd1'], opacity: 0.92 }
  };

  function rand(min, max) { return min + Math.random() * (max - min); }

  // Spinner markup. 'dots' = ring of 12 dots, biggest/darkest first, trailing smaller & lighter.
  // 'spokes' = 12 rounded spokes with a fading opacity trail (iOS style).
  function spinnerMarkup(type) {
    var cls = type === 'dots' ? 'sp-dots' : 'sp-spokes';
    var html = '<span class="' + cls + '">';
    for (var i = 0; i < 12; i++) {
      // dots: the head is biggest/darkest, trail shrinks & fades behind it;
      // spokes: plain fading opacity trail, nothing else
      var r = -i * 30;
      var o = Math.max(0.12, 1 - i * 0.078);
      var k = (1 - i * 0.06).toFixed(2);
      html += '<i style="--r:' + r + 'deg;--o:' + o.toFixed(2) + ';--k:' + k + '"></i>';
    }
    return html + '</span>';
  }

  function buildSpinnerEl(type, cfg) {
    var wrap = document.createElement('div');
    wrap.className = 'fx-sp';
    wrap.style.left = rand(-2, 94) + '%';
    wrap.style.top = rand(2, 92) + '%';
    wrap.style.setProperty('--s', Math.round(rand(cfg.size[0], cfg.size[1])) + 'px');
    wrap.style.setProperty('--d', rand(cfg.dur[0], cfg.dur[1]).toFixed(2) + 's');
    wrap.style.setProperty('--fd', rand(cfg.life[0], cfg.life[1]).toFixed(2) + 's');
    wrap.style.setProperty('--fo', cfg.opacity);
    wrap.style.setProperty('--sp-c', cfg.colors[Math.floor(Math.random() * cfg.colors.length)]);
    wrap.innerHTML = spinnerMarkup(type);
    return wrap;
  }

  // Deadline only: a cluttered pile of fake system windows, each with a plain spinner inside
  var WIN_TEXTS = [
    'Loading data...', 'Please wait...', 'Still loading...', 'Not responding',
    'Do not close this window', 'Installing updates... 99%', 'Task postponed', 'Almost there...'
  ];

  function buildWindowEl() {
    var w = document.createElement('div');
    w.className = 'fx-win';
    var width = Math.round(rand(170, 330));
    w.style.left = rand(-3, 88) + '%';
    w.style.top = rand(3, 86) + '%';
    w.style.setProperty('--ww', width + 'px');
    w.style.setProperty('--fd', rand(3, 5.5).toFixed(2) + 's');
    w.style.setProperty('--rot', rand(-3, 3).toFixed(1) + 'deg');
    w.style.setProperty('--s', Math.round(rand(18, 26)) + 'px');
    w.style.setProperty('--sp-c', Math.random() < 0.5 ? '#2d3b45' : '#5c6a75');
    var title = ['Loading', 'Please Wait', 'Submission Portal', 'Not Responding', 'System'][Math.floor(Math.random() * 5)];
    w.innerHTML =
      '<div class="fx-win-title"><span>' + title + '</span><b>_</b><b>\u25A1</b><b>x</b></div>' +
      '<div class="fx-win-body">' + spinnerMarkup(Math.random() < 0.5 ? 'dots' : 'spokes') +
      '<span class="fx-win-text">' + WIN_TEXTS[Math.floor(Math.random() * WIN_TEXTS.length)] + '</span></div>' +
      '<div class="fx-win-bar"><i></i></div>';
    return w;
  }

  function spawnRetroWindow() {
    if (!spinnerLayer) return;
    if (spinnerLayer.querySelectorAll('.fx-win').length >= 10) return;
    var win = buildWindowEl();
    spinnerLayer.appendChild(win);
    setTimeout(function () { win.remove(); }, 5600);
  }

  function spawnSpinner(phase) {
    if (!spinnerLayer) return;
    var cap = phase === 'deadline' ? 60 : 12;
    if (spinnerLayer.children.length >= cap) return;
    var cfg = SPINNER_PHASES[phase];
    if (phase === 'deadline' && Math.random() < 0.35) {
      spawnRetroWindow();
      return;
    }
    var type = cfg.types[Math.floor(Math.random() * cfg.types.length)];
    var wrap = buildSpinnerEl(type, cfg);
    if (phase === 'calm') {
      wrap.className = 'fx-sp calm';
      wrap.style.left = '';
      wrap.style.top = '';
    } else {
      setTimeout(function () { wrap.remove(); }, Math.round(cfg.life[1] * 1000) + 200);
    }
    spinnerLayer.appendChild(wrap);
  }

  function startSpinnerPhase(phase) {
    if (!spinnerLayer) return;
    if (spinnerTimer) clearInterval(spinnerTimer);
    spinnerTimer = null;

    if (phase === 'calm') {
      spinnerLayer.innerHTML = '';
      spawnSpinner('calm');
      return;
    }
    if (phase === 'anxious') {
      var calm = spinnerLayer.querySelector('.calm');
      if (calm) calm.remove();
    }
    spawnSpinner(phase);
    if (phase === 'deadline') {
      // land in a pile straight away
      for (var n = 0; n < 12; n++) setTimeout(function () { spawnSpinner('deadline'); }, n * 60);
    }
    spinnerTimer = setInterval(function () {
      spawnSpinner(phase);
      if (phase === 'deadline') { spawnSpinner(phase); spawnSpinner(phase); }
    }, SPINNER_PHASES[phase].interval);
  }

  function spinnerBurst() {
    for (var i = 0; i < 40; i++) setTimeout(function () { spawnSpinner('deadline'); }, i * 35);
  }

  function clearSpinners() {
    if (spinnerTimer) clearInterval(spinnerTimer);
    spinnerTimer = null;
    if (spinnerLayer) spinnerLayer.innerHTML = '';
  }

  // ---------- countdown ----------
  function applyAnxiousStage() {
    document.body.classList.add('anxious');
    startSpinnerPhase('anxious');
  }

  function applyDeadlineStage() {
    document.body.classList.add('deadline');
    startSpinnerPhase('deadline');
    startTicking();
    clearInterval(chaosTimer);
    chaosTimer = setInterval(() => {
      spawnRetroWindow();
      if (Math.random() < 0.4) spawnRetroWindow();
      if (Math.random() < 0.3) randomPopup();
    }, 700);
  }

  function startCountdown() {
    if (els.countdown) {
      els.countdown.classList.remove('hidden');
      els.countdownTime.textContent = Math.max(secondsLeft, 0);
    }

    // landed mid-phase (e.g. navigated between pages during the deadline):
    // apply the current stage immediately instead of waiting for a tick
    if (secondsLeft <= DARK_AT) applyDeadlineStage();
    else if (secondsLeft <= ANXIOUS_AT) applyAnxiousStage();

    countdownTimer = setInterval(() => {
      secondsLeft--;
      if (els.countdownTime) els.countdownTime.textContent = Math.max(secondsLeft, 0);
      rewriteLinks();

      if (secondsLeft === ANXIOUS_AT) {
        say('The deadline is close.');
        playTone(440, 0.15, 0.05);
        applyAnxiousStage();
      }

      if (secondsLeft === 12) {
        say('Why did I leave this until now?');
      }

      if (secondsLeft === DARK_AT) {
        say('Everything is happening at once.');
        applyDeadlineStage();
      }

      if (secondsLeft <= 0) {
        finishAtDeadline();
      }
    }, 1000);
  }

  function startChaos() {
    // ambient toasts for the calm phase only — never overwrite the
    // deadline window-spawner that already owns chaosTimer
    if (document.body.classList.contains('deadline')) return;
    clearInterval(chaosTimer);
    chaosTimer = setInterval(randomPopup, 2200);
  }

  function scheduleIdleThoughts() {
    idleThoughtTimer = setInterval(() => {
      if (finished) return;
      const thoughts = document.body.classList.contains('anxious') || document.body.classList.contains('deadline')
        ? anxiousThoughts
        : procrastinatingThoughts;
      say(thoughts[Math.floor(Math.random() * thoughts.length)]);
    }, 9000);
  }

  // ---------- the deadline: everything completes at once ----------
  function finishAtDeadline() {
    if (finished) return;
    finished = true;

    clearInterval(countdownTimer);
    clearInterval(chaosTimer);
    clearInterval(idleThoughtTimer);
    stopTicking();

    markTaskDone();
    updateLoading(100, 'All tasks completed');

    // storm of pop-ups resolving into nothing
    const storm = setInterval(spawnRetroWindow, 130);
    setTimeout(() => clearInterval(storm), 1000);
    spinnerBurst();

    document.body.classList.remove('anxious');
    document.body.classList.remove('deadline');

    if (els.finalScreen) {
      setTimeout(() => {
        els.finalScreen.classList.remove('hidden');
        if (els.chatBubble) els.chatBubble.classList.add('hidden');
        if (els.countdown) els.countdown.classList.add('hidden');
        if (els.chaosLayer) els.chaosLayer.innerHTML = '';
        clearSpinners();
      }, 1600);
    } else {
      // safety: fall back to the start page if this script ever runs elsewhere
      setTimeout(() => (location.href = 'index.html'), 1600);
    }
  }

  // ---------- a task the website refuses to finish ----------
  function procrastinateOnce() {
    if (attemptBusy || finished) return;
    attemptBusy = true;
    const btn = els.form.querySelector('.task-btn');
    btn.disabled = true;
    els.status.textContent = 'Working on it…';
    els.status.style.color = '';
    els.status.style.fontWeight = '';

    updateLoading(15, 'Loading… Please Wait');
    say('Just one more moment…');
    playTone(520, 0.08, 0.03);

    setTimeout(() => {
      els.status.textContent = 'Still loading…';
      updateLoading(45, 'Almost there…');
      say('Maybe later. There is still time.');

      setTimeout(() => {
        randomPopup();
        els.status.textContent = 'Waiting for confirmation…';
        updateLoading(70, 'Processing…');
        say("I'll do it properly later.");

        setTimeout(() => {
          randomPopup();
          els.status.textContent = 'Postponed';
          updateLoading(35, 'Loading… Please Wait');
          say('There is still time.');
          btn.disabled = false;
          attemptBusy = false;

          // the viewer tried; the website avoided — count it
          avoided++;
          if (els.avoided) els.avoided.textContent = avoided;
          rewriteLinks();
        }, 2200);
      }, 2200);
    }, 1800);
  }

  // ---------- wiring ----------
  if (els.form) {
    els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      ensureAudio();
      procrastinateOnce();
    });
  }

  if (els.startBtn) {
    els.startBtn.addEventListener('click', () => {
      ensureAudio();
      location.href = 'login.html?t=' + TOTAL_SECONDS + '&a=0';
    });
  }

  if (els.restartBtn) {
    els.restartBtn.addEventListener('click', () => {
      location.href = 'index.html';
    });
  }

  if (els.avoided) els.avoided.textContent = avoided;

  // begin the artwork on the task pages
  if (!isStart) {
    spinnerLayer = document.createElement('div');
    spinnerLayer.id = 'spinner-layer';
    spinnerLayer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(spinnerLayer);
    startSpinnerPhase('calm');

    say('Hello. I will help you finish everything.');
    rewriteLinks();
    startCountdown();
    startChaos();
    scheduleIdleThoughts();
    // if we landed straight into the deadline phase, startCountdown already
    // handed chaosTimer to the window-spawner and startChaos left it alone —
    // nothing more to do here
  }
})();
