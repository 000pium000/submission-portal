/* ============================================================
   Submission Portal — Framer Effects Kit
   ------------------------------------------------------------
   用途：在 Framer 重建的頁面上重新掛載全部特效。
   原版特效依賴特定的 HTML id/class，Framer 匯入圖層後會遺失；
   這個腳本不依賴任何頁面結構 — 它自己建立所有覆蓋層
   （倒數徽章、內心獨白氣泡、彈出視窗風暴、變色震動、結局畫面、音效）。

   使用方法（二選一）：
   A. Framer → Project Settings → Custom Code → Add Script
      → 貼入： <script src="https://000pium000.github.io/submission-portal/framer-effects.js"></script>
      → 放在 End of <head>，套用全部頁面（或只選任務頁）。
   B. 直接把整個檔案內容貼進 Custom Code 的程式碼框。

   頁面路徑要求（Framer 頁面路徑名）：
   - 起始頁：/ （或 /home）→ 不會有特效，Begin 按鈕用 Framer 原生連結指向 /login
   - 任務頁：/login、/form、/confirm → 自動開始倒數與全部特效
   （也兼容 .html 結尾，例如 /login.html）

   說明：Framer 編輯器畫布上不會顯示效果，要用 Preview 或 Publish 後
   在瀏覽器看。音效會在第一次點擊後啟動（瀏覽器自動播放限制）。
   ============================================================ */

(function () {
  'use strict';

  // ---------- 設定 ----------
  var CONFIG = {
    totalSeconds: 40,   // 總倒數秒數
    anxiousAt: 20,      // 剩幾多秒轉粉紅 + 震動
    darkAt: 8,         // 剩幾多秒轉黑 + 混亂 + 滴答聲
    taskPages: ['login', 'form', 'confirm'] // 對應 Framer 頁面路徑
  };

  // ---------- 偵測目前頁面 ----------
  var path = location.pathname.replace(/\/+$/, '').toLowerCase();
  var page = null;
  for (var i = 0; i < CONFIG.taskPages.length; i++) {
    var p = CONFIG.taskPages[i];
    if (path === '/' + p || path === '/' + p + '.html' || path.endsWith('/' + p) || path.endsWith('/' + p + '.html')) {
      page = p;
      break;
    }
  }
  if (!page) return; // 起始頁或其他頁面：不需要特效

  // ---------- 樣式（全部自帶，不會污染 Framer 原有樣式） ----------
  var css = [
    '@keyframes fx-bubble-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}',
    '@keyframes fx-pop-appear{from{opacity:0;transform:scale(.7) rotate(-2deg)}to{opacity:1;transform:scale(1) rotate(0)}}',
    '@keyframes fx-shake{0%{transform:translate(0,0)}25%{transform:translate(-2px,1px)}50%{transform:translate(2px,-1px)}75%{transform:translate(-1px,-1px)}100%{transform:translate(1px,1px)}}',
    '.fx-hidden{display:none!important}',

    /* 覆色層（低於其他覆蓋層） */
    '#fx-tint-anxious,#fx-tint-deadline{position:fixed;inset:0;pointer-events:none;opacity:0;transition:opacity .8s ease;z-index:40}',
    '#fx-tint-anxious{background:rgba(246,227,224,.45);mix-blend-mode:multiply}',
    '#fx-tint-deadline{background:#17130f}',
    'body.fx-anxious #fx-tint-anxious{opacity:1}',
    'body.fx-deadline #fx-tint-deadline{opacity:.82}',

    /* 震動（套在 body，任何頁面結構都有效） */
    'body.fx-anxious{animation:fx-shake .22s infinite}',
    'body.fx-deadline{animation:fx-shake .12s infinite}',

    /* 彈出視窗風暴 */
    '#fx-chaos{position:fixed;inset:0;pointer-events:none;z-index:50;overflow:hidden}',
    '.fx-popup{position:absolute;padding:9px 14px;background:#fff;color:#2d3b45;border:1px solid #c7cdd1;border-left:3px solid #831135;border-radius:3px;box-shadow:0 2px 8px rgba(45,59,69,.14);font:700 12px/1.4 Lato,"Helvetica Neue",Arial,sans-serif;white-space:nowrap;animation:fx-pop-appear .25s cubic-bezier(.16,1,.3,1)}',
    'body.fx-deadline .fx-popup{background:#211c17;color:#f0e9e0;border-color:#4a4038}',

    /* 倒數徽章 */
    '#fx-countdown{position:fixed;top:74px;right:24px;display:flex;align-items:center;gap:10px;padding:8px 16px;background:#831135;color:#fff;border-radius:9999px;box-shadow:0 2px 8px rgba(45,59,69,.14);font:700 16px/1 Lato,"Helvetica Neue",Arial,sans-serif;z-index:60}',
    '#fx-countdown-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.14em;opacity:.8}',
    '#fx-countdown-time{font-size:18px;line-height:1;min-width:2ch;text-align:right}',

    /* 內心獨白氣泡 */
    '#fx-bubble{position:fixed;right:24px;bottom:24px;max-width:min(320px,70vw);background:#fff;color:#2d3b45;border:1px solid #c7cdd1;border-top:3px solid #0374b5;border-radius:4px;box-shadow:0 12px 32px rgba(23,19,15,.25);z-index:60;animation:fx-bubble-in .35s cubic-bezier(.16,1,.3,1);transition:opacity .7s ease}',
    '#fx-bubble.fx-faded{opacity:0}',
    '#fx-bubble p{padding:12px 16px;font:400 13px/1.5 Lato,"Helvetica Neue",Arial,sans-serif}',

    /* 載入進度條（固定在底部中央） */
    '#fx-loading{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);width:min(640px,80vw);z-index:60}',
    '#fx-loading-bar{width:100%;height:8px;background:#e3e8ea;border-radius:9999px;overflow:hidden}',
    '#fx-loading-fill{width:0%;height:100%;background:#0374b5;border-radius:9999px;transition:width .6s cubic-bezier(.16,1,.3,1),background .8s ease}',
    '#fx-loading-text{margin-top:8px;font:400 12px/1.4 Lato,"Helvetica Neue",Arial,sans-serif;color:#8a97a0;letter-spacing:.05em}',
    'body.fx-anxious #fx-loading-fill{background:#a13d3d}',
    'body.fx-deadline #fx-loading-bar{background:#332c25}',
    'body.fx-deadline #fx-loading-fill{background:#e05252}',
    'body.fx-deadline #fx-loading-text{color:#8f8474}',

    /* 結局畫面：浮動卡片，頁面在背後保持可見 */
    '#fx-final{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 48px));display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:42px 36px;background:#17130f;color:#f0e9e0;border-radius:6px;box-shadow:0 24px 80px rgba(0,0,0,.45);z-index:100;animation:fx-final-in .5s ease}',
    '@keyframes fx-final-in{from{opacity:0;transform:translate(-50%,-50%) scale(.92)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}',
    '#fx-final .fx-kicker{font:400 11px/1.6 Lato,Arial,sans-serif;text-transform:uppercase;letter-spacing:.18em;color:#8f8474;margin-bottom:14px}',
    '#fx-final h1{font:900 clamp(2.6rem,6vw,4rem)/1 Lato,"Helvetica Neue",Arial,sans-serif;margin-bottom:14px}',
    '#fx-final .fx-question{font:italic 400 18px/1.5 Lato,Arial,sans-serif;color:#d9cdbd;margin-bottom:26px}',
    '#fx-final .fx-reflection{font:400 14px/1.8 Lato,Arial,sans-serif;color:#8f8474;margin-bottom:32px}',
    '#fx-restart{padding:11px 30px;background:#f0e9e0;color:#17130f;border:none;border-radius:3px;font:700 14px/1 Lato,Arial,sans-serif;cursor:pointer;transition:opacity .18s,transform .18s}',
    '#fx-restart:hover{opacity:.85;transform:translateY(-1px)}',

    /* Loading icons: calm -> chaotic */
    '#fx-spinner-layer{position:fixed;inset:0;pointer-events:none;z-index:45;overflow:hidden}',
    '.fx-sp{position:absolute;animation:fx-float var(--fd,8s) linear forwards}',
    '@keyframes fx-float{0%{opacity:0;transform:translate(0,0)}15%{opacity:var(--fo,1)}85%{opacity:var(--fo,1)}100%{opacity:0;transform:translate(var(--fxr,0px),var(--fyr,-90px))}}',
    '@keyframes fx-spin{to{transform:rotate(360deg)}}',
    '@keyframes fx-breathe{0%,100%{opacity:.4;transform:scale(.94)}50%{opacity:.8;transform:scale(1)}}',
    '@keyframes fx-wave{0%,100%{height:30%}50%{height:100%}}',
    '.fx-sp.calm{position:fixed;left:28px;bottom:132px;animation:fx-breathe 3.2s ease-in-out infinite}',
    '.fx-sp .sp-ring{display:block;width:var(--s);height:var(--s);border-radius:50%;border:calc(var(--s)*0.11) solid var(--sp-track,rgba(45,59,69,.15));border-top-color:var(--sp-c,#831135);animation:fx-spin var(--d,1.5s) linear infinite}',
    '.fx-sp .sp-dots{position:relative;display:block;width:var(--s);height:var(--s);animation:fx-spin var(--d,1.5s) linear infinite}',
    '.fx-sp .sp-dots i{position:absolute;top:50%;left:50%;width:calc(var(--s)*0.15);height:calc(var(--s)*0.15);margin:calc(var(--s)*-0.075) 0 0 calc(var(--s)*-0.075);border-radius:50%;background:var(--sp-c,#831135);transform:rotate(var(--r,0deg)) translateY(calc(var(--s)*-0.4))}',
    '.fx-sp .sp-bars{display:flex;align-items:flex-end;gap:calc(var(--s)*0.14);height:var(--s)}',
    '.fx-sp .sp-bars i{width:calc(var(--s)*0.13);height:100%;border-radius:2px;background:var(--sp-c,#831135);animation:fx-wave var(--d,1.2s) ease-in-out infinite}',
    '.fx-sp .sp-ball{display:block;width:var(--s);height:var(--s);border-radius:50%;background:conic-gradient(#e05252 0 45deg,#f0a742 45deg 90deg,#4cc26b 90deg 135deg,#4c9fe0 135deg 180deg,#b48ce0 180deg 225deg,#e0c84c 225deg 270deg,#e05a9d 270deg 315deg,#6bd6c8 315deg 360deg);animation:fx-spin var(--d,.6s) linear infinite}',
    '.fx-sp .sp-hour{display:block;font-size:var(--s);line-height:1;animation:fx-spin var(--d,1.5s) linear infinite}',
    '.fx-sp.glow .sp-ring,.fx-sp.glow .sp-ball,.fx-sp.glow .sp-bars i,.fx-sp.glow .sp-dots i{box-shadow:0 0 calc(var(--s)*0.3) rgba(224,82,82,.5)}',

    '@media (prefers-reduced-motion: reduce){body.fx-anxious,body.fx-deadline{animation:none!important}.fx-sp{animation:none!important}}'
  ].join('\n');
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ---------- 建立覆蓋層 ----------
  function el(html, hidden) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    var node = d.firstChild;
    if (hidden) node.className = 'fx-hidden';
    document.body.appendChild(node);
    return node;
  }

  var tintAnxious = el('<div id="fx-tint-anxious" aria-hidden="true"></div>');
  var tintDeadline = el('<div id="fx-tint-deadline" aria-hidden="true"></div>');
  var chaosLayer = el('<div id="fx-chaos" aria-hidden="true"></div>');
  var spinnerLayer = el('<div id="fx-spinner-layer" aria-hidden="true"></div>');
  var countdown = el('<div id="fx-countdown"><span id="fx-countdown-label">Deadline</span><span id="fx-countdown-time">40</span></div>', true);
  var bubble = el('<aside id="fx-bubble" aria-live="polite"><p id="fx-bubble-text">&hellip;</p></aside>', true);
  var loading = el('<div id="fx-loading"><div id="fx-loading-bar"><div id="fx-loading-fill"></div></div><p id="fx-loading-text">Loading&hellip; Please Wait</p></div>', true);
  var finalScreen = el(
    '<div id="fx-final">' +
    '<p class="fx-kicker">All tasks completed at 00:00</p>' +
    '<h1>Done.</h1>' +
    '<p class="fx-question">But why did I wait until now?</p>' +
    '<p class="fx-reflection">The work was always possible.<br>The waiting made it feel impossible.</p>' +
    '<button id="fx-restart">Wait again</button>' +
    '</div>', true);
  var countdownTime = countdown.querySelector('#fx-countdown-time');
  var bubbleText = bubble.querySelector('#fx-bubble-text');
  var loadingFill = loading.querySelector('#fx-loading-fill');
  var loadingText = loading.querySelector('#fx-loading-text');

  // ---------- 狀態（沿用原本的 URL 參數傳遞機制） ----------
  var params = new URLSearchParams(location.search);
  var secondsLeft = Math.min(parseInt(params.get('t'), 10) || CONFIG.totalSeconds, CONFIG.totalSeconds);
  if (Number.isNaN(secondsLeft)) secondsLeft = CONFIG.totalSeconds;
  var avoided = parseInt(params.get('a'), 10) || 0;

  var countdownTimer = null;
  var chaosTimer = null;
  var idleThoughtTimer = null;
  var bubbleFadeTimer = null;
  var tickTimer = null;
  var finished = false;
  var attemptBusy = false;

  // ---------- 獨白內容（與原作一致） ----------
  var procrastinatingThoughts = [
    'Just one more moment…',
    "I don't want to do this now.",
    'Maybe later. There is still time.',
    "I'll start after checking one more thing.",
    'This can probably wait.',
    'I work better under pressure anyway.',
    'There is still time… probably.'
  ];
  var anxiousThoughts = [
    'The deadline is close.',
    'I should have started earlier.',
    'Why did I leave this until now?',
    'No. No. No.',
    'Everything is happening at once.'
  ];
  var popupMessages = [
    'Reminder: task unfinished',
    'Are you still there?',
    'New notification (1)',
    'Please wait…',
    'One more thing',
    'Update available — later',
    'Do not close this page',
    'Task postponed successfully',
    'You have unfinished tasks',
    'Loading… still loading'
  ];

  // ---------- 音效（合成，無音檔） ----------
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  document.addEventListener('pointerdown', ensureAudio, { once: false });

  function playTone(freq, duration, volume) {
    if (!audioCtx) return;
    try {
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) { /* 音效是可選的 */ }
  }
  function startTicking() {
    stopTicking();
    tickTimer = setInterval(function () { playTone(880, 0.05, 0.03); }, 1000);
  }
  function stopTicking() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
  }

  // ---------- 覆蓋層行為 ----------
  function say(message) {
    bubbleText.textContent = message;
    bubble.classList.remove('fx-hidden');
    bubble.classList.remove('fx-faded');
    if (bubbleFadeTimer) clearTimeout(bubbleFadeTimer);
    bubbleFadeTimer = setTimeout(function () { bubble.classList.add('fx-faded'); }, 4200);
  }
  function showCountdown() {
    countdown.classList.remove('fx-hidden');
    countdownTime.textContent = Math.max(secondsLeft, 0);
  }
  function updateLoading(percent, text) {
    loading.classList.remove('fx-hidden');
    loadingFill.style.width = percent + '%';
    loadingText.textContent = text;
  }
  function hideLoading() { loading.classList.add('fx-hidden'); }

  function randomPopup() {
    var popup = document.createElement('div');
    popup.className = 'fx-popup';
    popup.textContent = popupMessages[Math.floor(Math.random() * popupMessages.length)];
    popup.style.visibility = 'hidden';
    chaosLayer.appendChild(popup);
    var pw = popup.offsetWidth;
    var ph = popup.offsetHeight;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var x = 8 + Math.random() * Math.max(vw - pw - 16, 8);
    var y = 40 + Math.random() * Math.max(vh - ph - 80, 20);
    popup.style.left = Math.round(x) + 'px';
    popup.style.top = Math.round(y) + 'px';
    popup.style.visibility = '';
    setTimeout(function () { popup.remove(); }, 3200);
  }

  // ---------- Loading icons: calm -> chaotic ----------
  var spinnerTimer = null;
  var SPINNER_TYPES = ['ring', 'dots', 'bars', 'ball', 'hour'];

  var SPINNER_PHASES = {
    calm:    { interval: 0,    size: [18, 26], dur: [2.8, 3.8], types: ['ring'],                 color: '#831135', track: 'rgba(131,17,53,.14)', opacity: 0.55, glow: false, driftY: [-30, -50] },
    anxious: { interval: 1500, size: [20, 42], dur: [1.2, 2.2], types: ['ring', 'dots', 'hour'], color: '#a13d3d', track: 'rgba(161,61,61,.16)', opacity: 0.8,  glow: false, driftY: [-140, -60] },
    deadline:{ interval: 300,  size: [22, 96], dur: [0.25, 0.7], types: SPINNER_TYPES,          color: '#e05252', track: 'rgba(224,82,82,.2)',  opacity: 1,    glow: true,  driftY: [-240, 240] }
  };

  function rand(min, max) { return min + Math.random() * (max - min); }

  function buildSpinnerEl(type, cfg) {
    var wrap = document.createElement('div');
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

    var dots = wrap.querySelectorAll('.sp-dots i');
    for (var di = 0; di < dots.length; di++) dots[di].style.setProperty('--r', di * 45 + 'deg');
    var bars = wrap.querySelectorAll('.sp-bars i');
    for (var bi = 0; bi < bars.length; bi++) bars[bi].style.animationDelay = bi * 0.12 + 's';
    return wrap;
  }

  function spawnSpinner(phase) {
    if (!spinnerLayer) return;
    var cap = phase === 'deadline' ? 46 : 14;
    if (spinnerLayer.children.length >= cap) return;
    var cfg = SPINNER_PHASES[phase];
    var type = cfg.types[Math.floor(Math.random() * cfg.types.length)];
    var wrap = buildSpinnerEl(type, cfg);
    if (phase === 'calm') {
      wrap.className = 'fx-sp calm';
      wrap.style.left = '';
      wrap.style.top = '';
    } else {
      setTimeout(function () { wrap.remove(); }, Math.round(rand(3200, 5200)));
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
    spinnerTimer = setInterval(function () { spawnSpinner(phase); }, SPINNER_PHASES[phase].interval);
  }

  function spinnerBurst() {
    for (var i = 0; i < 26; i++) {
      (function (delay) {
        setTimeout(function () { spawnSpinner('deadline'); }, delay);
      })(i * 45);
    }
  }

  function clearSpinners() {
    if (spinnerLayer) spinnerLayer.innerHTML = '';
  }

  // ---------- 跨頁連結改寫（把倒數與「逃避次數」帶到下一頁） ----------
  function rewriteLinks() {
    var q = '?t=' + Math.max(secondsLeft, 0) + '&a=' + avoided;
    document.querySelectorAll('a[href]').forEach(function (a) {
      var href = a.getAttribute('href') || '';
      // 只改指向三個任務頁的內部連結
      if (CONFIG.taskPages.some(function (p) {
        return href === '/' + p || href === '/' + p + '.html' || href.endsWith('/' + p) || href.endsWith('/' + p + '.html');
      })) {
        a.setAttribute('href', href.split('?')[0] + q);
      }
    });
  }

  // ---------- 倒數主流程 ----------
  function applyAnxiousStage() {
    document.body.classList.add('fx-anxious');
    startSpinnerPhase('anxious');
  }

  function applyDeadlineStage() {
    document.body.classList.add('fx-deadline');
    startSpinnerPhase('deadline');
    startTicking();
    clearInterval(chaosTimer);
    chaosTimer = setInterval(function () {
      randomPopup();
      if (Math.random() < 0.4) randomPopup();
    }, 700);
  }

  function startCountdown() {
    showCountdown();

    // landed mid-phase (e.g. navigated between pages during the deadline):
    // apply the current stage immediately instead of waiting for a tick
    if (secondsLeft <= CONFIG.darkAt) applyDeadlineStage();
    else if (secondsLeft <= CONFIG.anxiousAt) applyAnxiousStage();

    countdownTimer = setInterval(function () {
      secondsLeft--;
      countdownTime.textContent = Math.max(secondsLeft, 0);
      rewriteLinks();

      if (secondsLeft === CONFIG.anxiousAt) {
        say('The deadline is close.');
        playTone(440, 0.15, 0.05);
        applyAnxiousStage();
      }
      if (secondsLeft === 12) say('Why did I leave this until now?');
      if (secondsLeft === CONFIG.darkAt) {
        say('Everything is happening at once.');
        applyDeadlineStage();
      }
      if (secondsLeft <= 0) finishAtDeadline();
    }, 1000);
  }

  function startChaos() {
    chaosTimer = setInterval(randomPopup, 2200);
  }

  function scheduleIdleThoughts() {
    idleThoughtTimer = setInterval(function () {
      if (finished) return;
      var thoughts = (document.body.classList.contains('fx-anxious') || document.body.classList.contains('fx-deadline'))
        ? anxiousThoughts : procrastinatingThoughts;
      say(thoughts[Math.floor(Math.random() * thoughts.length)]);
    }, 9000);
  }

  // ---------- 死線：全部一次完成 ----------
  function finishAtDeadline() {
    if (finished) return;
    finished = true;

    clearInterval(countdownTimer);
    clearInterval(chaosTimer);
    clearInterval(idleThoughtTimer);
    stopTicking();

    updateLoading(100, 'All tasks completed');

    var storm = setInterval(randomPopup, 120);
    setTimeout(function () { clearInterval(storm); }, 900);
    spinnerBurst();

    document.body.classList.remove('fx-anxious');
    document.body.classList.remove('fx-deadline');

    setTimeout(function () {
      finalScreen.classList.remove('fx-hidden');
      bubble.classList.add('fx-hidden');
      countdown.classList.add('fx-hidden');
      hideLoading();
      clearSpinners();
    }, 1600);
  }

  // ---------- 表單：一個永遠做不完的任務 ----------
  function procrastinateOnce(statusEl) {
    if (attemptBusy || finished) return;
    attemptBusy = true;
    if (statusEl) { statusEl.textContent = 'Working on it…'; statusEl.style.color = ''; }

    updateLoading(15, 'Loading… Please Wait');
    say('Just one more moment…');
    playTone(520, 0.08, 0.03);

    setTimeout(function () {
      if (statusEl) statusEl.textContent = 'Still loading…';
      updateLoading(45, 'Almost there…');
      say('Maybe later. There is still time.');

      setTimeout(function () {
        randomPopup();
        if (statusEl) statusEl.textContent = 'Waiting for confirmation…';
        updateLoading(70, 'Processing…');
        say("I'll do it properly later.");

        setTimeout(function () {
          randomPopup();
          if (statusEl) statusEl.textContent = 'Postponed';
          updateLoading(35, 'Loading… Please Wait');
          say('There is still time.');
          attemptBusy = false;
          avoided++;
          rewriteLinks();
        }, 2200);
      }, 2200);
    }, 1800);
  }

  // 頁面上任何 form 提交都會觸發「拖延」；狀態文字可用 data-fx-status 標記
  document.addEventListener('submit', function (e) {
    e.preventDefault();
    ensureAudio();
    var statusEl = document.querySelector('[data-fx-status]');
    procrastinateOnce(statusEl);
  });

  // ---------- 結局按鈕 ----------
  finalScreen.querySelector('#fx-restart').addEventListener('click', function () {
    location.href = '/';
  });

  // ---------- 啟動 ----------
  say('Hello. I will help you finish everything.');
  rewriteLinks();
  startCountdown();
  startChaos();
  scheduleIdleThoughts();
  startSpinnerPhase('calm');
})();
