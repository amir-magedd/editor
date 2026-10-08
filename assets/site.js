/* Amir Maged — portfolio interactions */
(function () {
  'use strict';

  /* ---------- protection (deterrent: stops casual saving/copying) ---------- */
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('dragstart', function (e) { if (e.target.closest && e.target.closest('img,video,a')) e.preventDefault(); });
  ['copy', 'cut', 'selectstart'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (!(e.target.closest && e.target.closest('input,textarea'))) e.preventDefault(); });
  });
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase(), mod = e.ctrlKey || e.metaKey;
    var block =
      k === 'f12' ||
      (mod && (k === 'u' || k === 's' || k === 'c' || k === 'p')) ||
      (mod && e.shiftKey && (k === 'i' || k === 'j' || k === 'c' || k === 'k')) ||
      (e.metaKey && e.altKey && (k === 'i' || k === 'j' || k === 'c' || k === 'u'));
    if (block) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.querySelectorAll('video').forEach(function (v) {
    v.setAttribute('controlslist', 'nodownload noplaybackrate');
    v.setAttribute('disablepictureinpicture', '');
    v.setAttribute('disableremoteplayback', '');
  });

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var p2 = function (n) { return String(n).padStart(2, '0'); };
  var FPS = 24;
  var tc = function (sec) {
    var f = Math.max(0, Math.floor(sec * FPS + 1e-6));
    return p2(Math.floor(f / (FPS * 3600))) + ':' + p2(Math.floor(f / (FPS * 60)) % 60) + ':' + p2(Math.floor(f / FPS) % 60) + ':' + p2(f % FPS);
  };

  /* ---------- muted autoplay loops (only while on screen) ---------- */
  function tryPlay(v) { v.muted = true; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  var loops = $$('video[data-auto]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting && !document.body.classList.contains('lock')) tryPlay(e.target); else e.target.pause(); });
    }, { rootMargin: '200px' });
    loops.forEach(function (v) { io.observe(v); });
  } else loops.forEach(tryPlay);

  /* ---------- running timecode (home) ---------- */
  var tcEls = $$('[data-tc]');
  if (tcEls.length) {
    var t0 = performance.now();
    setInterval(function () {
      var s = (performance.now() - t0) / 1000;
      var txt = tc(s % 86400);
      tcEls.forEach(function (el) { el.textContent = txt; });
    }, 1000 / FPS);
  }

  /* ---------- modal helpers ---------- */
  var lastFocus = null;
  function lock(on) { document.body.classList.toggle('lock', on); }

  /* ---------- contact card ---------- */
  var cm = $('#contact-modal');
  function openContact() { if (!cm) return; lastFocus = document.activeElement; cm.hidden = false; lock(true); var b = $('.xbtn', cm); if (b) b.focus(); }
  function closeContact() { if (!cm || cm.hidden) return; cm.hidden = true; lock(false); if (lastFocus) lastFocus.focus(); }
  $$('[data-open-contact]').forEach(function (b) { b.addEventListener('click', openContact); });
  $$('[data-close-contact]').forEach(function (b) { b.addEventListener('click', closeContact); });

  /* ---------- player ---------- */
  var pl = $('#player');
  var P = { list: [], i: 0, dur: 0, drag: false, userFit: false };
  if (pl) {
    var v = $('video', pl), head = $('.p-head', pl), knob = $('.p-knob', pl), rule = $('.p-rule', pl);
    var tNow = $('[data-p-now]', pl), tDur = $('[data-p-dur]', pl), ttl = $('[data-p-title]', pl), pos = $('[data-p-pos]', pl);
    var fitSel = $('.p-fit:not(.p-q)', pl), fitLbl = $('[data-p-fitlbl]', pl);
    var qSel = $('.p-q', pl), qLbl = $('[data-p-qlbl]', pl);
    var QPX = { highres: 2880, hd2160: 2160, hd1440: 1440, hd1080: 1080, hd720: 720, large: 480, medium: 360, small: 240, tiny: 144 };
    var QN = { tiny: '144p', small: '240p', medium: '360p', large: '480p', hd720: '720p', hd1080: '1080p', hd1440: '1440p', hd2160: '2160p', highres: '4K' };
    var prevB = $('[data-p-prev]', pl), nextB = $('[data-p-next]', pl);

    // ruler ticks
    var frag = document.createDocumentFragment();
    for (var k = 0; k <= 120; k++) {
      var s = document.createElement('span'), major = k % 10 === 0, mid = k % 5 === 0;
      s.className = 'tk'; s.style.left = (k / 120 * 100) + '%';
      s.style.height = major ? '12px' : (mid ? '8px' : '5px');
      s.style.background = major ? '#8C8A86' : '#4A4A50';
      frag.appendChild(s);
    }
    rule.insertBefore(frag, rule.firstChild);

    // --- stream box (external source, driven by our own controls) ---
    var sw = document.createElement('div'); sw.className = 'p-stream'; sw.hidden = true;
    sw.innerHTML = '<div class="p-sbox"><div id="p-shost"></div><div class="p-cover"></div></div><div class="p-shield"></div>';
    pl.insertBefore(sw, v.nextSibling);
    var sbox = $('.p-sbox', sw), cover = $('.p-cover', sw), shield = $('.p-shield', sw);
    var S = { api: null, p: null, ready: false, ratio: 9 / 16, timer: null, pending: null, playing: false, started: false };
    var loadApi = function (cb) {
      if (window.YT && window.YT.Player) return cb();
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); cb(); };
      if (!document.getElementById('yt-api')) { var sc = document.createElement('script'); sc.id = 'yt-api'; sc.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(sc); }
    };
    var layout = function () {
      if (sw.hidden) return;
      var W = sw.clientWidth, H = sw.clientHeight, r = S.ratio, w, h;
      var fill = !pl.classList.contains('fit');
      if ((W / H > r) === fill) { w = W; h = W / r; } else { h = H; w = H * r; }
      // whole pixels only: a half-pixel offset makes the browser resample the video and soften it
      w = Math.round(w); h = Math.round(h);
      sbox.style.width = w + 'px'; sbox.style.height = h + 'px';
      sbox.style.left = Math.round((W - w) / 2) + 'px'; sbox.style.top = Math.round((H - h) / 2) + 'px';
      sizeFrame(w, h);
    };
    // YouTube picks the stream quality from the player's pixel size, so render the hidden player
    // large enough for full HD/4K and scale it down to fit: the viewer always gets the top stream.
    var CROP = 90;
    var sizeFrame = function (w, h) {
      var f = document.getElementById('p-shost'); if (!f) return;
      var dpr = window.devicePixelRatio || 1;
      var short = Math.min(w, h) * dpr;
      // size the hidden player so YouTube sees ~1080px on the short side: scale UP on small/vertical frames,
      // scale DOWN on big or high-DPI screens (otherwise YouTube picks a heavy 1440p/4K stream).
      // normal videos: native size, YouTube picks the stream like on youtube.com.
      // Full-HD-locked videos (H03): sized so YouTube sees exactly ~1080px on the short side.
      var tgt = QPX[S.q];                         // chosen quality (Auto = native size, YouTube decides)
      // never shrink the hidden player below the size it is shown at: a smaller player is drawn small and
      // then stretched up, which is what made 1080p look soft. Only enlarge it (then scale down) when needed.
      var k = tgt ? Math.min(4, Math.max(1, tgt / short)) : 1;
      var crop = Math.ceil(Math.max(CROP, 80 / k));          // keep YouTube's title bar (~70px inside the player) out of view at any scale
      f.style.width = Math.round(w * k) + 'px';
      f.style.height = Math.round((h + crop * 2) * k) + 'px';
      f.style.top = -crop + 'px'; f.style.left = '0px';
      f.style.transform = k === 1 ? 'none' : 'scale(' + (1 / k) + ')';
      f.style.transformOrigin = '0 0';
    };
    var maxQuality = function () { if (!QPX[S.q] || !S.p) return;
      try {
        // aim for 1080p (sharp, ~5 Mbps) — never force 1440p/4K, which needs 4-8x the bandwidth
        if (S.p.setPlaybackQuality) S.p.setPlaybackQuality(S.q);
        if (S.p.setPlaybackQualityRange) S.p.setPlaybackQualityRange(S.q, S.q);
      } catch (e) {}
    };
    window.addEventListener('resize', layout);

    var mode = 'file';
    var M = {
      t: function () { return mode === 'file' ? v.currentTime : (S.ready && S.hdOk ? S.p.getCurrentTime() || 0 : 0); },
      seek: function (t) { if (mode === 'file') v.currentTime = t; else if (S.ready) S.p.seekTo(t, true); },
      play: function () {
        if (mode === 'file') { if (!pl.classList.contains('muted')) { v.muted = false; v.volume = 1; } var pr = v.play(); if (pr && pr.catch) pr.catch(function () { setPlaying(false); }); }
        else if (S.ready) { if (!pl.classList.contains('muted') && S.hdOk) S.p.unMute(); S.p.playVideo(); }
      },
      pause: function () { if (mode === 'file') v.pause(); else if (S.ready) S.p.pauseVideo(); },
      paused: function () { return mode === 'file' ? v.paused : !S.playing; },
      mute: function (m) { if (mode === 'file') v.muted = m; else if (S.ready) { if (m) S.p.mute(); else if (S.hdOk) S.p.unMute(); } }
    };
    var setPlaying = function (on) {
      pl.classList.toggle('playing', on);
      $('[data-p-toggle]', pl).setAttribute('aria-label', on ? 'Pause' : 'Play');
    };
    var setFit = function (f) { pl.classList.toggle('fit', f === 'Fit'); fitSel.value = f; fitLbl.textContent = f; layout(); };
    var paint = function () {
      var t = M.t();
      var pct = (P.dur ? Math.min(1, t / P.dur) * 100 : 0) + '%';
      head.style.left = pct; knob.style.left = pct;
      tNow.textContent = tc(t);
      rule.setAttribute('aria-valuenow', Math.floor(t));
      rule.setAttribute('aria-valuetext', tNow.textContent);
    };
    var setDur = function (d) { if (d && isFinite(d)) { P.dur = d; tDur.textContent = tc(d); rule.setAttribute('aria-valuemax', Math.floor(d)); } };
    // bottom-left readout: chosen quality, plus what YouTube is actually streaming on Auto
    // quality menu = the exact list YouTube has for this video (Auto + e.g. 1080p / 720p / 480p / 360p ...),
    // and the readout shows what YouTube is really streaming right now
    var opt = function (val, txt) { var o = document.createElement('option'); o.value = val; o.textContent = txt; o.style.background = '#000'; return o; };
    var buildQ = function (lv) {
      var key = lv.join(','); if (key === S.qKey) return; S.qKey = key;
      qSel.textContent = ''; qSel.appendChild(opt('auto', 'Auto'));
      lv.forEach(function (x) { if (QN[x]) qSel.appendChild(opt(x, QN[x])); });
      if (S.q !== 'auto' && lv.indexOf(S.q) < 0) {        // chosen quality not in this upload: take the closest one below it
        var below = lv.filter(function (x) { return QPX[x] && QPX[x] <= QPX[S.q]; })[0];
        S.q = below || lv[lv.length - 1] || 'auto'; layout();
      }
      qSel.value = S.q;
    };
    var showQ = function () {
      var cur = '', lv = [];
      if (!S.qLive) cur = ''; else try { cur = S.p.getPlaybackQuality(); lv = (S.p.getAvailableQualityLevels() || []).filter(function (x) { return x !== 'auto' && QN[x]; }); } catch (e) {}
      if (lv.length) buildQ(lv);
      var now = QN[cur] || '';
      var a = qSel.options[0]; if (a && a.value === 'auto') { var at = 'Auto' + (now ? ' (' + now + ')' : ''); if (a.textContent !== at) a.textContent = at; }
      var txt = now ? now : (S.q === 'auto' ? 'Auto' : (QN[S.q] || S.q));
      if (txt !== S.qShown) { S.qShown = txt; qLbl.textContent = txt; }
    };
    // switch quality mid-play: resize the hidden player for the new target and reload at the same moment
    var setQuality = function (q) {
      S.q = q; P.userQ = q; S.qShown = ''; layout(); showQ();
      if (mode !== 'stream' || !S.ready || !S.want) return;
      var t = 0, was = !M.paused(); try { t = S.p.getCurrentTime() || 0; } catch (e) {}
      var opt = { videoId: S.want, startSeconds: t, suggestedQuality: QPX[q] ? q : 'default' };
      if (was) S.p.loadVideoById(opt); else S.p.cueVideoById(opt);
      if (pl.classList.contains('muted') || !S.hdOk) S.p.mute(); else S.p.unMute();
      maxQuality();
    };
    var poll = function (on) {
      clearInterval(S.timer); S.timer = null;
      if (on) S.timer = setInterval(function () { if (!S.ready) return; if (!S.hdOk) hdGate(); showQ(); if (!P.dur) setDur(S.p.getDuration()); if (!P.drag) paint(); }, 1000 / FPS);
    };
    // Minimum quality gate: the reel plays muted behind its poster until YouTube is streaming
    // 720p HD or better (or the best the upload has), then restarts from 0:00 with sound.
    var HD = ['hd1080', 'hd1440', 'hd2160', 'highres'];   // Full HD gate (only used for FHD-locked videos)
    var hdGate = function () {
      if (!S.playing) return;
      maxQuality();
      var q = '', lv = [];
      try { q = S.p.getPlaybackQuality(); lv = S.p.getAvailableQualityLevels() || []; } catch (e) {}
      var best = lv.filter(function (x) { return x !== 'auto'; })[0];
      var bestIsLow = best && HD.indexOf(best) < 0 && q === best;   // upload itself is below 1080p
      var waited = (Date.now() - S.gateT0) > 20000;                 // safety: never hang forever
      if (HD.indexOf(q) >= 0 || bestIsLow || waited) {
        S.hdOk = true;
        S.p.seekTo(0, true);
        if (!pl.classList.contains('muted')) S.p.unMute();
        cover.classList.remove('wait'); cover.classList.add('off');
      }
    };
    var gateStart = function () {
      cover.classList.remove('off');
      if (S.fhd) { S.hdOk = false; S.gateT0 = Date.now(); cover.classList.add('wait'); }
      else { S.hdOk = true; cover.classList.remove('wait'); }
    };
    var onState = function (e) {
      var st = e.data, Y = window.YT.PlayerState;
      S.playing = st === Y.PLAYING || st === Y.BUFFERING;
      if (st === Y.PLAYING || st === Y.BUFFERING || st === Y.CUED) maxQuality();
      if (st === Y.PLAYING) { S.started = true; S.qLive = true; setDur(S.p.getDuration()); if (S.hdOk) cover.classList.add('off'); }
      if (st === Y.ENDED) { cover.classList.remove('off'); S.p.seekTo(0, true); S.p.pauseVideo(); }
      setPlaying(S.playing);
    };
    var streamLoad = function (it) {
      S.ratio = it.ratio || 9 / 16; S.started = false; S.playing = false;
      cover.style.backgroundImage = it.poster ? 'url("' + it.poster + '")' : 'none';
      cover.classList.remove('off'); sw.hidden = false; layout();
      S.want = it.yt; S.active = true; S.fhd = !!it.fhd;
      S.q = S.fhd ? 'hd1080' : (P.userQ || 'auto'); S.qKey = null; S.qLive = false;
      if (!Array.prototype.some.call(qSel.options, function (o) { return o.value === S.q; })) qSel.appendChild(opt(S.q, QN[S.q] || S.q));
      qSel.value = S.q; qSel.disabled = false; S.qShown = ''; layout(); showQ();
      gateStart();
      clearTimeout(S.primeTimer);
      if (S.ready && S.primed === it.yt) { if (!pl.classList.contains('muted')) S.p.unMute(); S.p.playVideo(); }          // already buffering in HD from the hover
      else if (S.ready) {
        if (S.fhd) { S.p.mute(); S.p.loadVideoById({ videoId: it.yt, suggestedQuality: 'hd1080' }); maxQuality(); }
        else { S.p.loadVideoById(QPX[S.q] ? { videoId: it.yt, suggestedQuality: S.q } : it.yt); maxQuality(); if (pl.classList.contains('muted')) S.p.mute(); else S.p.unMute(); }
        S.p.playVideo();
      }
      else warm();
      S.primed = null;
      poll(true);
    };
    // build the hidden player ahead of time so a click starts playback right away
    var warm = function (firstId) {
      if (S.p) return;
      loadApi(function () {
        if (S.p) return;
        S.p = new window.YT.Player('p-shost', {
          videoId: S.want || firstId, host: 'https://www.youtube-nocookie.com',
          playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, rel: 0, modestbranding: 1, iv_load_policy: 3, cc_load_policy: 0, playsinline: 1, origin: location.origin },
          events: {
            onReady: function () {
              S.ready = true; layout(); maxQuality();
              if (S.active && S.want) { S.p.loadVideoById(S.want); if (S.fhd || pl.classList.contains('muted')) S.p.mute(); else S.p.unMute(); S.p.playVideo(); maxQuality(); }
            },
            onStateChange: onState
          }
        });
      });
    };
    var cue = function (id, ratio) { return;
      if (!S.ready || S.active || S.primed === id) return;
      S.primed = id; S.ratio = ratio || 9 / 16; S.hdOk = false;
      sw.hidden = false; layout();
      S.p.mute(); S.p.loadVideoById({ videoId: id, suggestedQuality: 'hd1080' }); S.p.playVideo();
      maxQuality();
      clearTimeout(S.primeTimer);
      S.primeTimer = setTimeout(function () { if (!S.active) { try { S.p.stopVideo(); } catch (e) {} S.primed = null; } }, 20000);
    };
    window.__warmStream = warm; window.__cueStream = cue;
    var streamStop = function () { poll(false); S.active = false; S.cued = null; S.primed = null; clearTimeout(S.primeTimer); if (S.ready) { try { S.p.stopVideo(); } catch (e) {} } sw.hidden = true; S.playing = false; };

    var load = function (i) {
      P.i = (i + P.list.length) % P.list.length;
      var it = P.list[P.i];
      P.dur = 0; P.userFit = false;
      ttl.textContent = it.title; pl.setAttribute('aria-label', 'Video player: ' + it.title);
      pos.textContent = P.list.length > 1 ? (P.i + 1) + ' / ' + P.list.length : '';
      tDur.textContent = tc(0); setPlaying(false);
      if (it.yt) {
        mode = 'stream'; v.pause(); v.removeAttribute('src'); v.load(); v.hidden = true;
        // Fill only when the screen shape almost matches the video; otherwise Fit, so the picture is never
        // zoomed in (zooming a 1080p frame up to fill a phone or a 16:10 screen is what looks soft)
        var vr = it.ratio || 9 / 16, sr = (pl.clientWidth || innerWidth) / (pl.clientHeight || innerHeight);
        setFit(vr >= 1 && Math.abs(sr / vr - 1) < 0.06 ? 'Fill' : 'Fit');
        streamLoad(it);
      } else {
        mode = 'file'; streamStop(); v.hidden = false; setFit('Fill'); qSel.disabled = true; qLbl.textContent = 'Source';
        v.poster = it.poster || ''; v.src = it.src; M.play();
      }
      paint();
    };
    var open = function (list, i) {
      P.list = list; lastFocus = document.activeElement;
      prevB.disabled = nextB.disabled = list.length < 2;
      loops.forEach(function (x) { x.pause(); });
      pl.hidden = false; lock(true); load(i); wake();
      $('.p-close', pl).focus();
    };
    var close = function () {
      if (pl.hidden) return;
      v.pause(); v.removeAttribute('src'); v.load(); streamStop();
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
      pl.hidden = true; lock(false); if (lastFocus) lastFocus.focus();
      loops.forEach(function (x) { var r = x.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight) tryPlay(x); });
    };
    var step = function (d) { M.pause(); M.seek(Math.min(P.dur || 0, Math.max(0, M.t() + d / FPS))); setTimeout(paint, 60); };
    var seekAt = function (x) { if (!P.dur) return; var r = rule.getBoundingClientRect(); M.seek(Math.min(1, Math.max(0, (x - r.left) / r.width)) * P.dur); paint(); };
    var toggle = function () { if (M.paused()) M.play(); else M.pause(); };

    v.addEventListener('timeupdate', function () { if (!P.drag && mode === 'file') paint(); });
    v.addEventListener('loadedmetadata', function () {
      setDur(v.duration);
      if (!P.userFit && v.videoWidth) setFit(v.videoHeight > v.videoWidth ? 'Fit' : 'Fill');
    });
    v.addEventListener('play', function () { setPlaying(true); });
    v.addEventListener('pause', function () { setPlaying(false); });
    v.addEventListener('ended', function () { setPlaying(false); });
    v.addEventListener('click', toggle);
    shield.addEventListener('click', toggle);
    $('[data-p-toggle]', pl).addEventListener('click', toggle);
    $('[data-p-back]', pl).addEventListener('click', function () { step(-1); });
    $('[data-p-fwd]', pl).addEventListener('click', function () { step(1); });
    prevB.addEventListener('click', function () { load(P.i - 1); });
    nextB.addEventListener('click', function () { load(P.i + 1); });
    $('.p-close', pl).addEventListener('click', close);
    fitSel.addEventListener('change', function () { P.userFit = true; setFit(fitSel.value); });
    qSel.addEventListener('change', function () { setQuality(qSel.value); });
    $('[data-p-mute]', pl).addEventListener('click', function () {
      var m = !pl.classList.contains('muted'); M.mute(m); pl.classList.toggle('muted', m);
      this.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
    });
    $('[data-p-fs]', pl).addEventListener('click', function () {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (pl.requestFullscreen) pl.requestFullscreen();
        else if (pl.webkitRequestFullscreen) pl.webkitRequestFullscreen();
      } catch (e) {}
    });
    document.addEventListener('fullscreenchange', function () { setTimeout(layout, 50); });
    rule.addEventListener('pointerdown', function (e) { try { rule.setPointerCapture(e.pointerId); } catch (x) {} P.drag = true; seekAt(e.clientX); });
    rule.addEventListener('pointermove', function (e) { if (P.drag) seekAt(e.clientX); });
    rule.addEventListener('pointerup', function () { P.drag = false; });
    rule.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
    });
    document.addEventListener('keydown', function (e) {
      if (pl.hidden) return;
      if (e.key === ' ' && e.target === document.body) { e.preventDefault(); toggle(); }
    });

    // auto-hide the controls after 4 s without mouse movement
    var idleT = null;
    var wake = function () {
      pl.classList.remove('idle');
      clearTimeout(idleT);
      if (!pl.hidden) idleT = setTimeout(function () { pl.classList.add('idle'); }, 4000);
    };
    ['mousemove', 'pointerdown', 'touchstart', 'keydown', 'wheel'].forEach(function (ev) {
      pl.addEventListener(ev, wake, { passive: true });
    });
    pl.addEventListener('focusin', wake);
    window.__playerWake = wake;

    // expose
    window.__openPlayer = open;
    window.__closePlayer = close;
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (pl && !pl.hidden) { if (!document.fullscreenElement) window.__closePlayer(); }
    else closeContact();
  });


  /* ---------- page animations ---------- */
  (function () {
    var root = document.documentElement;
    if (!root.classList.contains('js-anim')) return;
    var sel = '.meta, main > h1, main > section, main > div > h1, main > .secthead, main > [role=group], .tile, .card, .tl, .row, footer, .ticker, main > p, main > h1 + p';
    var els = $$(sel).filter(function (el, i, a) { return a.indexOf(el) === i; });
    els.forEach(function (el) { el.classList.add(el.classList.contains('meta') ? 'rv-x' : 'rv'); el.classList.add('rv'); });
    var onEnd = function (e) { if (e.propertyName === 'clip-path' && e.target.classList.contains('in')) e.target.classList.add('done'); };
    els.forEach(function (el) { el.addEventListener('transitionend', onEnd); });
    var batch = [], timer = null;
    var flush = function () {
      batch.sort(function (a, b) { var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return (ra.top - rb.top) || (ra.left - rb.left); });
      batch.forEach(function (el, i) { el.style.setProperty('--d', Math.min(i * 0.035, 0.25) + 's'); el.classList.add('in'); });
      batch = []; timer = null;
    };
    var start = function () {
      root.classList.add('ready');
      if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
      var io2 = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { batch.push(e.target); io2.unobserve(e.target); } });
        if (batch.length && !timer) timer = setTimeout(flush, 0);
      }, { rootMargin: '0px 0px -8% 0px' });
      els.forEach(function (el) { io2.observe(el); });
    };
    start();

  })();

  var itemOf = function (el) { return { title: el.dataset.title, src: el.dataset.src, poster: el.dataset.poster, yt: el.dataset.stream || '', ratio: parseFloat(el.dataset.ratio) || 0, fhd: el.dataset.fhd === '1' }; };

  /* ---------- reels grid ---------- */
  var reels = $$('[data-reel]');
  if (reels.length) {
    var rl = reels.map(itemOf);
    reels.forEach(function (el, i) {
      el.addEventListener('click', function () { window.__openPlayer(rl, i); });
      var ht = null;
      var hv = function () { clearTimeout(ht); ht = setTimeout(function () { if (rl[i].yt && window.__cueStream) window.__cueStream(rl[i].yt, rl[i].ratio || 9 / 16); }, 220); };
      el.addEventListener('pointerenter', hv); el.addEventListener('focus', hv);
      el.addEventListener('pointerleave', function () { clearTimeout(ht); });
    });
    if (rl[0].yt && window.__warmStream) {
      var w = function () { window.__warmStream(rl[0].yt); };
      if ('requestIdleCallback' in window) requestIdleCallback(w, { timeout: 1500 }); else setTimeout(w, 600);
    }
  }

  /* ---------- horizontal page ---------- */
  var cards = $$('[data-card]');
  if (cards.length) {
    var feat = $('#feat'), fv = $('#feat-video'), fCode = $('[data-f-code]'), fCat = $('[data-f-cat]'), fTitle = $('[data-f-title]');
    var count = $('[data-count]');
    var hl = cards.map(itemOf);
    var sel = 0;
    var show = function (i, scroll) {
      sel = i; var c = cards[i];
      cards.forEach(function (x, j) { x.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      fv.poster = c.dataset.poster; fv.src = c.dataset.src; tryPlay(fv);
      fCode.textContent = c.dataset.code + ' · 16:9'; fCat.textContent = c.dataset.cat; fTitle.textContent = c.dataset.title;
      $$('[data-f-play]').forEach(function (b) { b.setAttribute('aria-label', 'Play ' + c.dataset.title); });
      if (hl[i].yt && window.__cueStream) window.__cueStream(hl[i].yt, hl[i].ratio || 16 / 9);
      if (scroll) feat.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    };
    cards.forEach(function (c, i) { c.addEventListener('click', function () { show(i, true); }); });
    $$('[data-f-play]').forEach(function (b) { b.addEventListener('click', function () { window.__openPlayer(hl, sel); }); });
    $$('[data-f-play]').forEach(function (b) {
      var hv = function () { if (hl[sel].yt && window.__cueStream) window.__cueStream(hl[sel].yt, hl[sel].ratio || 16 / 9); };
      b.addEventListener('pointerenter', hv); b.addEventListener('focus', hv);
    });
    var firstYt = hl.filter(function (x) { return x.yt; })[0];
    if (firstYt && window.__warmStream) {
      var hw = function () { window.__warmStream(firstYt.yt); };
      if ('requestIdleCallback' in window) requestIdleCallback(hw, { timeout: 1500 }); else setTimeout(hw, 600);
    }

    var pills = $$('[data-filter]');
    var applyFilter = function (name) {
      var n = 0;
      pills.forEach(function (p) { p.setAttribute('aria-pressed', p.dataset.filter === name ? 'true' : 'false'); });
      cards.forEach(function (c) { var on = name === 'All' || c.dataset.cat === name; c.hidden = !on; if (on) n++; });
      count.textContent = n + ' clips in bin';
    };
    pills.forEach(function (p) {
      p.addEventListener('click', function () {
        applyFilter(p.dataset.filter);
        history.replaceState(null, '', p.dataset.filter === 'All' ? location.pathname : '#' + p.dataset.slug);
      });
    });
    var fromHash = function () {
      var h = location.hash.slice(1).toLowerCase();
      var m = pills.filter(function (p) { return p.dataset.slug === h; })[0];
      applyFilter(m ? m.dataset.filter : 'All');
    };
    window.addEventListener('hashchange', fromHash);
    fromHash(); show(0, false);
  }
})();
