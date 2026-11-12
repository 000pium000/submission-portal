/* ============================================================
   "Loading… Please Wait"
   Multi-page version: the deadline follows the viewer across
   login.html -> form.html -> confirm.html via URL parameters,
   so no storage APIs are needed (works inside sandboxed iframes).

   Total experience: 90 seconds.
   Pages: login (drag & drop BOTH files) -> message (ask for an extension)
          -> quiz (procrastination survey) -> form (confirm) -> confirm (submit)
   Narrative: avoidance -> delay -> guilt -> deadline pressure -> rushed completion
   ============================================================ */

(function () {
  'use strict';

  // ==================== settings you can tweak ====================
  const TOTAL_SECONDS = 90;      // total countdown
  const ANXIOUS_AT = 30;         // seconds left -> pink + shaking
  const DARK_AT = 8;             // seconds left -> black + chaos + ticking + distortion
  const THOUGHT_EVERY_MS = 7000; // how often the inner voice speaks
  // Version flags (the 4 zips differ only by these two lines):
  //   standard: both false | distortion: DISTORTION true | whiteblock: WHITEBLOCK true | all: both true
  const DISTORTION_ENABLED = true; // last 8s: warp the whole page with an SVG glitch filter
  const WHITEBLOCK_ENABLED = true; // sometimes stop the user: white blur lock + ragebait message
  // ================================================================

  // ---------- state from the URL ----------
  const params = new URLSearchParams(location.search);
  let secondsLeft = Math.min(parseInt(params.get('t'), 10) || TOTAL_SECONDS, TOTAL_SECONDS);
  let avoided = parseInt(params.get('a'), 10) || 0;
  if (Number.isNaN(secondsLeft)) secondsLeft = TOTAL_SECONDS;
  if (Number.isNaN(avoided)) avoided = 0;

  // per-task progress carried in the URL so nothing is lost when going back a page.
  // s = one digit per task: 0 = not started, 1 = 'user submitted, but not me'
  const TASK_KEYS = ['login', 'message', 'quiz', 'form', 'confirm'];
  const TASK_INDEX = { login: 0, message: 1, quiz: 2, form: 3, confirm: 4 };
  let taskState = [0, 0, 0, 0, 0];
  const sParam = params.get('s') || '';
  if (sParam.length === 5) {
    for (let i = 0; i < 5; i++) taskState[i] = sParam[i] === '1' ? 1 : 0;
  }
  let messageText = params.get('m') || ''; // what the user typed to the professor
  let thoughtIdx = parseInt(params.get('n'), 10) || 0; // thought playlist position

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
    sumMessage: document.getElementById('sum-message'),
    sumQuiz: document.getElementById('sum-quiz'),
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
  // To add or change thoughts: just edit the strings in these two lists.
  // One is picked at random each time the bubble appears.
  const procrastinatingThoughts = [
    'Just one more moment…',
    "I don't want to do this now. \u00AF\\_(\u30C4)_/\u00AF",
    'Maybe later. There is still time.',
    "I'll start after checking one more thing. (\u00AC\u203F\u00AC)",
    'This can probably wait. \u00AF\\_(\u30C4)_/\u00AF',
    'I work better under pressure anyway. (\u0295\u2022\u1D25\u2022\u0294)',
    'There is still time… probably. (\u25D5\u203F\u25D5)',
    'Bro, why u do so quick? \u0295(\u00F2\u2040\u203F\u2040\u00F2)\u0295',
    'Do it at once, then it will be most time-saving… later.',
    'Chill bro, why are you that nervous? \u0295(\u2022\u1D25\u2022\u0295)',
    'Wait, let me check my phone first. \uD83D\uDCF1',
    'Five more minutes. That\u2019s the rule. \u23F3',
  ];

  // one per task: shown when the user finishes a task (the website takes no credit)
  const FINISH_MSG = {
    login: 'You uploaded, but not me. I\u2019ll press submit later. Much later. \u00AF\\_(\u30C4)_/\u00AF',
    message: 'You typed it, but not me. I\u2019ll send it later \u2014 still have time, no need to rush.',
    quiz: 'You answered, but not me. I\u2019ll grade it\u2026 eventually. (\u25D5\u203F\u25D5)',
    form: 'You confirmed, but not me. I\u2019ll do it later \u2014 trust me, no worry.',
    confirm: 'You submitted, but not me. I\u2019ll finish everything at the last moment. Watch me. \uD83E\uDEE1',
  };

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
  function say(message, holdMs) {
    if (!els.chatBubble) return;
    els.chatText.textContent = message;
    els.chatBubble.classList.remove('hidden');
    els.chatBubble.classList.remove('faded');
    if (bubbleFadeTimer) clearTimeout(bubbleFadeTimer);
    bubbleFadeTimer = setTimeout(() => els.chatBubble.classList.add('faded'), holdMs || 5000);
  }

  function updateLoading(percent, text) {
    if (!els.loadingFill) return;
    els.loadingFill.style.width = percent + '%';
    els.loadingText.textContent = text;
  }

  // carry the countdown (and the guilt) into every link
  function quizStateString() {
    const qs = document.querySelectorAll('.quiz-q');
    if (!qs.length) return '';
    let out = '';
    qs.forEach((fs) => {
      const checked = fs.querySelector('input:checked');
      out += checked ? checked.value : '-';
    });
    return out;
  }

  function currentQuery() {
    return (
      '?t=' + Math.max(secondsLeft, 0) +
      '&a=' + avoided +
      '&s=' + taskState.join('') +
      '&n=' + thoughtIdx +
      '&m=' + encodeURIComponent(messageText) +
      '&q=' + quizStateString()
    );
  }

  function rewriteLinks() {
    els.pills.forEach((pill) => {
      const href = pill.getAttribute('href');
      pill.href = href.split('?')[0] + currentQuery();
    });
  }

  function setPillState(taskKey, text, cls) {
    const pill = els.pills.find((p) => p.dataset.task === taskKey);
    if (!pill) return;
    const s = pill.querySelector('.pill-status');
    if (!s) return;
    s.textContent = text;
    s.classList.remove('halfdone', 'done');
    if (cls) s.classList.add(cls);
  }

  // third pill state: the user did the task, the website takes zero credit
  function setTaskDoneByUser(taskKey) {
    const i = TASK_INDEX[taskKey];
    if (i === undefined || taskState[i] === 1) return;
    taskState[i] = 1;
    setPillState(taskKey, 'User submitted, but not me', 'halfdone');
    rewriteLinks();
  }

  // restore per-task progress from the URL on arrival
  TASK_KEYS.forEach((key) => {
    if (taskState[TASK_INDEX[key]] === 1) setPillState(key, 'User submitted, but not me', 'halfdone');
  });

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
        s.classList.remove('halfdone');
        s.classList.add('done');
      }
    });
    if (els.sumLogin) els.sumLogin.textContent = 'Yes, eventually';
    if (els.sumMessage) els.sumMessage.textContent = 'Yes, eventually';
    if (els.sumQuiz) els.sumQuiz.textContent = 'Yes, eventually';
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

  // ---------- distortion (Version B: warp the page in the last 8 seconds) ----------
  // How it works: an SVG <filter> with feTurbulence (random noise) +
  // feDisplacementMap (shifts pixels using that noise) is applied to the
  // .canvas-layout element via CSS `filter: url(#fx-distort)`.
  // A timer jitters the displacement scale so the page "glitches";
  // occasionally it snaps back to 0 for a broken-signal flicker.
  let distortTimer = null;
  let snapTimer = null;

  function ensureDistortSvg() {
    if (document.getElementById('fx-distort-svg')) return;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'fx-distort-svg';
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:fixed;width:0;height:0;pointer-events:none';
    svg.innerHTML =
      '<filter id="fx-distort" x="-5%" y="-5%" width="110%" height="110%">' +
      '<feTurbulence id="fx-turb" type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="2" seed="7" result="noise"/>' +
      '<feDisplacementMap id="fx-disp" in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G"/>' +
      '</filter>';
    document.body.appendChild(svg);
  }

  function startDistortion() {
    if (!DISTORTION_ENABLED) return;
    ensureDistortSvg();
    document.body.classList.add('distort');
    var disp = document.getElementById('fx-disp');
    var turb = document.getElementById('fx-turb');
    if (!disp) return;
    // chaotic glitch jitter: faster, stronger, plus a random tilt/skew of the layout
    var layout = document.querySelector('.canvas-layout');
    distortTimer = setInterval(function () {
      var scale = Math.random() < 0.15 ? 0 : 6 + Math.random() * 22; // sometimes snap flat
      disp.setAttribute('scale', String(Math.round(scale)));
      if (turb && Math.random() < 0.4) {
        turb.setAttribute('seed', String(Math.floor(Math.random() * 100)));
      }
      if (layout) {
        layout.style.transform =
          'skewX(' + (Math.random() * 2.4 - 1.2).toFixed(2) + 'deg) rotate(' +
          (Math.random() * 1.4 - 0.7).toFixed(2) + 'deg)';
      }
    }, 150);
    // frequent hard flicker: fully normal for a split second, like a broken signal
    snapTimer = setInterval(function () {
      document.body.classList.add('distort-snap');
      setTimeout(function () { document.body.classList.remove('distort-snap'); }, 130);
    }, 900);
  }

  function stopDistortion() {
    if (distortTimer) clearInterval(distortTimer);
    if (snapTimer) clearInterval(snapTimer);
    distortTimer = null;
    snapTimer = null;
    document.body.classList.remove('distort');
    document.body.classList.remove('distort-snap');
    var layout = document.querySelector('.canvas-layout');
    if (layout) layout.style.transform = '';
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
    startDistortion(); // no-op unless DISTORTION_ENABLED is true
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

  // the inner voice is a playlist now: it keeps playing across pages
  // (thoughtIdx travels in the URL) and wraps around when it runs out.
  function scheduleIdleThoughts() {
    idleThoughtTimer = setInterval(() => {
      if (finished) return;
      thoughtIdx++;
      const thoughts = document.body.classList.contains('anxious') || document.body.classList.contains('deadline')
        ? anxiousThoughts
        : procrastinatingThoughts;
      say(thoughts[thoughtIdx % thoughts.length]);
      rewriteLinks();
    }, THOUGHT_EVERY_MS);
  }

  // ---------- media pop-ups: the website 'listens to music' and 'watches YouTube' ----------
  let mediaTimer = null;
  let mediaFlip = 0;

  function spawnMediaWindow(kind) {
    if (document.getElementById('fx-media')) return;
    const win = document.createElement('div');
    win.id = 'fx-media';
    win.className = 'media-win';
    if (kind === 'music') {
      win.innerHTML =
        '<div class="media-title"><span>\u266A Music</span><b>\u2014</b><b>\u25A1</b><b>\u00D7</b></div>' +
        '<div class="media-body">' +
        '<p class="media-now">\u25B6 Now playing</p>' +
        '<p class="media-track">Imagine Dragons \u2014 Bones</p>' +
        '<div class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
        '<div class="media-bar"><i></i></div>' +
        '<p class="media-note">the website is listening to music and singing \uD83C\uDFA4</p>' +
        '</div>';
      say('I-I-I got this feeling, yeah, you know \uD83D\uDDE3\uD83D\uDDE3\uD83D\uDDE3\uD83D\uDDE3 \u266A \u266A \u266A \u266A', 8000);
    } else {
      win.innerHTML =
        '<div class="media-title"><span>\u25B6 YouTube</span><b>\u2014</b><b>\u25A1</b><b>\u00D7</b></div>' +
        '<div class="media-body">' +
        '<div class="yt-box"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></div>' +
        '<p class="media-track">Procrastination Motivation \u2014 10 Hours</p>' +
        '<div class="media-bar"><i></i></div>' +
        '<p class="media-note">the website is watching YouTube video \uD83D\uDcFa</p>' +
        '</div>';
      say('Shh\u2026 the website is watching YouTube video. \uD83D\uDcFa', 8000);
    }
    win.style.top = Math.round(12 + Math.random() * 45) + '%';
    document.body.appendChild(win);
    setTimeout(() => win.classList.add('out'), 8600);
    setTimeout(() => win.remove(), 9200);
  }

  function scheduleMedia() {
    mediaTimer = setInterval(() => {
      if (finished) return;
      if (document.body.classList.contains('deadline')) return; // chaos phase is busy enough
      spawnMediaWindow(mediaFlip++ % 2 === 0 ? 'music' : 'youtube');
    }, 17000);
  }

  // ---------- the deadline: everything completes at once ----------
  function finishAtDeadline() {
    if (finished) return;
    finished = true;

    clearInterval(countdownTimer);
    clearInterval(chaosTimer);
    clearInterval(idleThoughtTimer);
    if (mediaTimer) clearInterval(mediaTimer);
    stopTicking();
    stopDistortion();

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
          btn.disabled = false;
          attemptBusy = false;

          // the viewer tried; the website avoided — count it
          avoided++;
          if (els.avoided) els.avoided.textContent = avoided;
          setTaskDoneByUser(page);
          rewriteLinks();
          say(FINISH_MSG[page] || 'There is still time.', 7000);
        }, 2200);
      }, 2200);
    }, 1800);
  }

  // ---------- task 01: drag & drop "upload", BOTH files (login page) ----------
  // final success box (also used to restore state when the user comes back)
  function renderUploadFinalState() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;
    const names = [];
    document.querySelectorAll('.file-chip').forEach((c) => {
      c.classList.add('done');
      names.push(c.dataset.name);
    });
    dropZone.classList.remove('uploading');
    dropZone.classList.add('uploaded');
    dropZone.innerHTML =
      '<div class="upload-success">' +
      '<p class="success-head">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M7.5 12.5l3 3 6-7"/></svg>' +
      '<span class="success-file"></span>' +
      '</p>' +
      '<p class="success-msg">Upload successful &mdash; but wait, don&rsquo;t submit yet. Not yet. You can do the other tasks first. I&rsquo;ll finish everything at the last moment. Trust me.</p>' +
      '</div>';
    dropZone.querySelector('.success-file').textContent = 'Upload successful \u2014 ' + names.join(' + ');
    if (els.status) {
      els.status.textContent = 'Uploaded \u2014 submission postponed';
      els.status.style.color = 'var(--color-success)';
      els.status.style.fontWeight = '600';
    }
  }

  // ---------- restore the user's previous work when they come back ----------
  function restoreMessage() {
    const input = document.getElementById('msg-input');
    if (input) {
      if (messageText) input.value = messageText;
      input.addEventListener('input', () => {
        messageText = input.value;
        rewriteLinks();
      });
    }
    if (taskState[1] === 1 && messageText) {
      const thread = document.getElementById('msg-thread');
      if (thread) {
        const draft = document.createElement('div');
        draft.className = 'msg you draft';
        const meta = document.createElement('p');
        meta.className = 'msg-meta';
        meta.textContent = 'You \u2014 Draft (not sent)';
        const body = document.createElement('p');
        body.className = 'msg-body';
        body.textContent = messageText;
        draft.appendChild(meta);
        draft.appendChild(body);
        thread.appendChild(draft);
      }
      if (els.status) els.status.textContent = 'Draft saved \u2014 I\u2019ll send it later';
    }
  }

  function restoreQuiz() {
    const q = params.get('q') || '';
    if (q) {
      document.querySelectorAll('.quiz-q').forEach((fs, i) => {
        const v = q[i];
        if (v && v !== '-') {
          const radio = fs.querySelector('input[value="' + v + '"]');
          if (radio) radio.checked = true;
        }
      });
    }
    if (taskState[2] === 1 && els.status) els.status.textContent = 'Results postponed';
  }
  function initUploadTask() {
    const dropZone = document.getElementById('drop-zone');
    if (!dropZone) return;
    const chips = Array.from(document.querySelectorAll('.file-chip'));
    const REQUIRED = chips.length; // both files
    const uploaded = new Set();
    let busy = false;

    function chipFor(name) {
      return chips.find((c) => c.dataset.name === name);
    }

    function startUpload(name) {
      if (busy) return;
      if (uploaded.has(name)) {
        say('You already uploaded that one… the other file, remember?');
        return;
      }
      if (uploaded.size >= REQUIRED) return;
      busy = true;
      ensureAudio();
      say('Uploading… one moment.');
      if (els.status) {
        els.status.textContent = 'Uploading ' + name + '…';
        els.status.style.color = '';
        els.status.style.fontWeight = '';
      }
      dropZone.classList.add('uploading');
      dropZone.innerHTML =
        '<div class="upload-progress">' +
        '<p class="upload-file"></p>' +
        '<div class="upload-bar"><div id="upload-fill"></div></div>' +
        '<p class="upload-pct" id="upload-pct">0%</p>' +
        '</div>';
      dropZone.querySelector('.upload-file').textContent = name;
      const fill = document.getElementById('upload-fill');
      const pct = document.getElementById('upload-pct');
      let p = 0;
      const iv = setInterval(() => {
        if (p < 96) p = Math.min(96, p + 2 + Math.random() * 7);
        fill.style.width = p + '%';
        pct.textContent = Math.floor(p) + '%';
        if (p >= 96) {
          clearInterval(iv);
          pct.textContent = '99%';
          updateLoading(70, 'Loading… Please Wait');
          say('Almost there… maybe I should check something first.');
          setTimeout(() => {
            fill.style.width = '100%';
            pct.textContent = '100%';
            finishUpload(name);
          }, 2600);
        }
      }, 180);
    }

    function finishUpload(name) {
      busy = false;
      uploaded.add(name);
      playTone(660, 0.12, 0.05);
      const chip = chipFor(name);
      if (chip) chip.classList.add('done');

      if (uploaded.size < REQUIRED) {
        // first of two: pretend to accept it, then ask for the other
        dropZone.classList.remove('uploading');
        dropZone.innerHTML =
          '<div class="drop-idle">' +
          '<p class="drop-part">Uploaded: <strong></strong> &mdash; 1 of 2</p>' +
          '<p class="drop-title">Now drag the other file here too</p>' +
          '<p class="drop-hint">Both files are required. Obviously.</p>' +
          '</div>';
        dropZone.querySelector('.drop-part strong').textContent = name;
        if (els.status) els.status.textContent = '1 of 2 files uploaded — keep going';
        say('One down… you can rest a bit before the second one. Or not.');
        return;
      }

      // both files in: the upload "succeeds", the submission is postponed
      renderUploadFinalState();
      avoided++;
      if (els.avoided) els.avoided.textContent = avoided;
      setTaskDoneByUser('login');
      rewriteLinks();
      say(FINISH_MSG.login, 7000);
    }

    chips.forEach((chip) => {
      chip.addEventListener('dragstart', (e) => {
        if (busy || uploaded.size >= REQUIRED) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/plain', chip.dataset.name);
        e.dataTransfer.effectAllowed = 'copy';
        chip.classList.add('dragging');
      });
      chip.addEventListener('dragend', () => chip.classList.remove('dragging'));
      // click works too \u2014 dragging is hard on some devices
      chip.addEventListener('click', () => maybeLock(() => startUpload(chip.dataset.name)));
    });

    ['dragenter', 'dragover'].forEach((ev) =>
      dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        if (!busy && uploaded.size < REQUIRED) dropZone.classList.add('hover');
      })
    );
    ['dragleave', 'drop'].forEach((ev) =>
      dropZone.addEventListener(ev, (e) => {
        e.preventDefault();
        dropZone.classList.remove('hover');
      })
    );
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      if (busy || uploaded.size >= REQUIRED) return;
      const name = e.dataTransfer.getData('text/plain') || 'assignment_final.mp4';
      maybeLock(() => startUpload(name));
    });
  }

  // ---------- task 02: message the professor (message page) ----------
  let messageBusy = false;

  function sendMessage() {
    if (messageBusy || finished) return;
    const input = document.getElementById('msg-input');
    const thread = document.getElementById('msg-thread');
    const btn = els.form.querySelector('.task-btn');
    if (!input || !thread || !btn) return;
    const text = (input.value || '').trim();
    if (!text) {
      say('Type something first… or maybe later.');
      return;
    }
    messageBusy = true;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    if (els.status) {
      els.status.textContent = 'Sending…';
      els.status.style.color = '';
      els.status.style.fontWeight = '';
    }
    updateLoading(40, 'Loading… Please Wait');
    playTone(520, 0.08, 0.03);

    setTimeout(() => {
      // the thought: it received the message, but it doesn't want to send it
      say("Hmm… I don't want to send it. I received it — but I'll send it later. Wait for me. Still have time, no need to rush.", 7000);

      const draft = document.createElement('div');
      draft.className = 'msg you draft';
      const meta = document.createElement('p');
      meta.className = 'msg-meta';
      meta.textContent = 'You — Draft (not sent)';
      const body = document.createElement('p');
      body.className = 'msg-body';
      body.textContent = text;
      draft.appendChild(meta);
      draft.appendChild(body);
      thread.appendChild(draft);

      input.value = '';
      btn.disabled = false;
      btn.textContent = 'Send';
      if (els.status) els.status.textContent = 'Draft saved — I\u2019ll send it later';
      updateLoading(20, 'Loading… Please Wait');

      avoided++;
      if (els.avoided) els.avoided.textContent = avoided;
      setTaskDoneByUser('message');
      rewriteLinks();
      messageBusy = false;
      // after the refusal, the website shrugs: you did it, not me
      setTimeout(() => {
        if (!finished) say(FINISH_MSG.message, 7000);
      }, 3000);
    }, 1600);
  }

  // ---------- task 03: the procrastination quiz (quiz page) ----------
  let quizBusy = false;

  function submitQuiz() {
    if (quizBusy || finished) return;
    quizBusy = true;
    const btn = els.form.querySelector('.task-btn');
    btn.disabled = true;
    const total = document.querySelectorAll('.quiz-q').length || 5;
    const answered = document.querySelectorAll('.quiz input:checked').length;
    if (els.status) {
      els.status.textContent = 'Grading ' + answered + ' of ' + total + ' answers…';
      els.status.style.color = '';
      els.status.style.fontWeight = '';
    }
    updateLoading(30, 'Loading… Please Wait');
    say('Hmm… grading is a lot of work.');
    playTone(520, 0.08, 0.03);

    setTimeout(() => {
      updateLoading(65, 'Almost there…');
      say("I'll grade it later. There's still time.");
      setTimeout(() => {
        randomPopup();
        if (els.status) els.status.textContent = 'Results postponed';
        updateLoading(35, 'Loading… Please Wait');
        btn.disabled = false;
        quizBusy = false;

        avoided++;
        if (els.avoided) els.avoided.textContent = avoided;
        setTaskDoneByUser('quiz');
        rewriteLinks();
        say(FINISH_MSG.quiz, 7000);
      }, 2200);
    }, 2000);
  }

  // ---------- white-block lock (Version C): the website stops the user ----------
  // When the user tries to do a task, sometimes the whole screen blurs white,
  // locks input for a few seconds, and a ragebait message tells them to slow down.
  let lockBusy = false;
  let lockCooldownUntil = 0;

  const LOCK_MESSAGES = [
    'Come on bro, chill. You won\u2019t die if you do it slower. Still have time.',
    'Nope. Procrastinate time.',
    'Relax. OK, if you can\u2019t wait\u2026 I\u2019ll let you wait.',
  ];

  function maybeLock(then) {
    if (!WHITEBLOCK_ENABLED || finished) {
      then();
      return;
    }
    const now = Date.now();
    if (lockBusy || now < lockCooldownUntil) {
      then();
      return;
    }
    if (Math.random() > 0.45) {
      then(); // most of the time the website "allows" it
      return;
    }
    lockBusy = true;
    lockCooldownUntil = now + 14000;
    ensureAudio();
    playTone(220, 0.4, 0.05);

    const lock = document.createElement('div');
    lock.id = 'white-lock';
    lock.setAttribute('role', 'alert');
    lock.innerHTML =
      '<div class="lock-card">' +
      '<p class="lock-kicker">Please wait</p>' +
      '<p class="lock-msg"></p>' +
      '<div class="lock-spinner" aria-hidden="true"><i></i><i></i><i></i></div>' +
      '</div>';
    lock.querySelector('.lock-msg').textContent = LOCK_MESSAGES[Math.floor(Math.random() * LOCK_MESSAGES.length)];
    document.body.appendChild(lock);
    setTimeout(() => {
      lock.classList.add('out');
      setTimeout(() => {
        lock.remove();
        lockBusy = false;
        then(); // released \u2014 the task proceeds
      }, 450);
    }, 3400);
  }

  // ---------- wiring ----------
  if (els.form) {
    els.form.addEventListener('submit', (e) => {
      e.preventDefault();
      ensureAudio();
      if (page === 'message') {
        maybeLock(sendMessage);
        return;
      }
      if (page === 'quiz') {
        maybeLock(submitQuiz);
        return;
      }
      if (page === 'login') {
        return; // the drag & drop upload is the task here
      }
      maybeLock(procrastinateOnce);
    });
  }

  initUploadTask();

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

    // the inner voice keeps playing where it left off (n travels in the URL);
    // only the very first arrival gets the greeting
    if (thoughtIdx === 0) {
      say('Hello. I will help you finish everything.');
    } else {
      const list0 = document.body.classList.contains('anxious') || document.body.classList.contains('deadline')
        ? anxiousThoughts
        : procrastinatingThoughts;
      say(list0[thoughtIdx % list0.length]);
    }

    // restore whatever the user already did on this page
    if (page === 'login' && taskState[0] === 1) renderUploadFinalState();
    if (page === 'message') restoreMessage();
    if (page === 'quiz') restoreQuiz();

    rewriteLinks();
    startCountdown();
    startChaos();
    scheduleIdleThoughts();
    scheduleMedia(); // music player + YouTube window pop up while "working"
    // if we landed straight into the deadline phase, startCountdown already
    // handed chaosTimer to the window-spawner and startChaos left it alone —
    // nothing more to do here
  }
})();
