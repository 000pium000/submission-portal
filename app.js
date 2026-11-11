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
  // A single quiet spinner while calm; a drifting few when anxious;
  // a storm of glowing, spinning icons when the deadline hits.
  let spinnerLayer = null;
  let spinnerTimer = null;

  const SPINNER_TYPES = ['ring', 'dots', 'bars', 'ball', 'hour'];

  const SPINNER_PHASES = {
    calm:    { interval: 0,    size: [18, 26], dur: [2.8, 3.8], types: ['ring'],                 color: '#831135', track: 'rgba(131,17,53,.14)', opacity: 0.55, glow: false, driftY: [-30, -50] },
    anxious: { interval: 1500, size: [20, 42], dur: [1.2, 2.2], types: ['ring', 'dots', 'hour'], color: '#a13d3d', track: 'rgba(161,61,61,.16)', opacity: 0.8,  glow: false, driftY: [-140, -60] },
    deadline:{ interval: 300,  size: [22, 96], dur: [0.25, 0.7], types: SPINNER_TYPES,          color: '#e05252', track: 'rgba(224,82,82,.2)',  opacity: 1,    glow: true,  driftY: [-240, 240] }
  };

  function rand(min, max) { return min + Math.random() * (max - min); }

  function buildSpinnerEl(type, cfg) {
    const wrap = document.createElement('div');
    wrap.className = 'fx-sp' + (cfg.glow ? ' glow' : '');
    wrap.style.left = rand(4, 92) + '%';
    wrap.style.top = rand(8, 86) + '%';
    wrap.style.setProperty('--s', Math.round(rand(cfg.size[0], cfg.size[1])) + 'px');
    wrap.style.setProperty('--d', rand(cfg.dur[0], cfg.dur[1]).toFixed(2) + 's');
    wrap.style.setProperty('--fd', rand(5, 9).toFixed(2) + 's');
    wrap.style.setProperty('--fo', cfg.opacity);
    wrap.style.setProperty('--fxr', Math.round(rand(-160, 160)) + 'px');
    wrap.style.setProperty('--fyr', Math.round(rand(cfg.driftY[0], cfg.driftY[1])) + 'px');
    wrap.style.setProperty('--sp-c', cfg.color);
    wrap.style.setProperty('--sp-track', cfg.track);

    if (type === 'ring') wrap.innerHTML = '<span class="sp-ring"></span>';
    else if (type === 'dots') wrap.innerHTML = '<span class="sp-dots">' + '<i></i>'.repeat(8) + '</span>';
    else if (type === 'bars') wrap.innerHTML = '<span class="sp-bars">' + '<i></i>'.repeat(5) + '</span>';
    else if (type === 'ball') wrap.innerHTML = '<span class="sp-ball"></span>';
    else wrap.innerHTML = '<span class="sp-hour">\u23F3</span>';

    if (type === 'dots') {
      wrap.querySelectorAll('.sp-dots i').forEach((d, i) => d.style.setProperty('--r', i * 45 + 'deg'));
    }
    if (type === 'bars') {
      wrap.querySelectorAll('.sp-bars i').forEach((b, i) => b.style.animationDelay = i * 0.12 + 's');
    }
    return wrap;
  }

  function spawnSpinner(phase) {
    if (!spinnerLayer) return;
    const cap = phase === 'deadline' ? 46 : 14;
    if (spinnerLayer.children.length >= cap) return;
    const cfg = SPINNER_PHASES[phase];
    const type = cfg.types[Math.floor(Math.random() * cfg.types.length)];
    const wrap = buildSpinnerEl(type, cfg);
    if (phase === 'calm') {
      wrap.className = 'fx-sp calm';
      wrap.style.left = '';
      wrap.style.top = '';
    } else {
      setTimeout(() => wrap.remove(), Math.round(rand(3200, 5200)));
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
      const calm = spinnerLayer.querySelector('.calm');
      if (calm) calm.remove();
    }
    spawnSpinner(phase);
    spinnerTimer = setInterval(() => spawnSpinner(phase), SPINNER_PHASES[phase].interval);
  }

  function spinnerBurst() {
    for (let i = 0; i < 26; i++) setTimeout(() => spawnSpinner('deadline'), i * 45);
  }

  function clearSpinners() {
    if (spinnerLayer) spinnerLayer.innerHTML = '';
  }

  // ---------- countdown ----------
  function startCountdown() {
    if (els.countdown) {
      els.countdown.classList.remove('hidden');
      els.countdownTime.textContent = Math.max(secondsLeft, 0);
    }

    countdownTimer = setInterval(() => {
      secondsLeft--;
      if (els.countdownTime) els.countdownTime.textContent = Math.max(secondsLeft, 0);
      rewriteLinks();

      if (secondsLeft === ANXIOUS_AT) {
        document.body.classList.add('anxious');
        say('The deadline is close.');
        playTone(440, 0.15, 0.05);
        startSpinnerPhase('anxious');
      }

      if (secondsLeft === 12) {
        say('Why did I leave this until now?');
      }

      if (secondsLeft === DARK_AT) {
        document.body.classList.add('deadline');
        say('Everything is happening at once.');
        startTicking();
        startSpinnerPhase('deadline');
        clearInterval(chaosTimer);
        chaosTimer = setInterval(() => {
          randomPopup();
          if (Math.random() < 0.4) randomPopup();
        }, 700);
      }

      if (secondsLeft <= 0) {
        finishAtDeadline();
      }
    }, 1000);
  }

  function startChaos() {
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
    const storm = setInterval(randomPopup, 120);
    setTimeout(() => clearInterval(storm), 900);
    spinnerBurst();

    document.body.classList.remove('anxious');
    document.body.classList.remove('deadline');

    if (els.finalScreen) {
      setTimeout(() => {
        els.finalScreen.classList.remove('hidden');
        if (els.chatBubble) els.chatBubble.classList.add('hidden');
        if (els.countdown) els.countdown.classList.add('hidden');
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
  }
})();
