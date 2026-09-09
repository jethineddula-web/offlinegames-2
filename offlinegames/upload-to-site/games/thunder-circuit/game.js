/* =====================================================================
   THUNDER CIRCUIT — Stock Car Racing Simulation
   Single-file build for offlinegames.art
   ===================================================================== */
'use strict';

/* ---------------- AD CONFIGURATION (yours) ---------------- */
var AD_CLIENT       = "ca-pub-4203857211510947";
var AD_SLOT_BANNER  = "7417753724";
// Mobile-app (AdMob) unit ids — used when running inside your Android/iOS wrapper
var ADMOB_BANNER       = "ca-app-pub-4203857211510947/8086182570";
var ADMOB_INTERSTITIAL = "ca-app-pub-4203857211510947/3025427580";
var ADMOB_REWARDED     = "ca-app-pub-4203857211510947/3025427580"; // swap when you create a rewarded unit

/* ---------------- platform detection ---------------- */
var UA = navigator.userAgent || '';
var IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
var IS_APP = !!(window.cordova || window.Capacitor || window.AndroidBridge || window.TCNative ||
                /wv\)|; wv|Median|GoNative|WebViewApp|TWA/i.test(UA) ||
                (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
                navigator.standalone === true);
var PLATFORM = IS_APP ? 'app' : 'web';
var IS_MOBILE = IS_TOUCH && Math.min(screen.width, screen.height) < 900;

/* ---------------- safe persistent store ---------------- */
var Store = (function () {
  var mem = {}, ok = false;
  try { var k='__tc'; localStorage.setItem(k,'1'); localStorage.removeItem(k); ok=true; } catch(e){ ok=false; }
  return {
    get: function (k, d) {
      try { var v = ok ? localStorage.getItem('tc_'+k) : mem[k]; return v==null?d:JSON.parse(v); }
      catch(e){ return d; }
    },
    set: function (k, v) {
      try { var s = JSON.stringify(v); if(ok) localStorage.setItem('tc_'+k,s); else mem[k]=s; } catch(e){}
    }
  };
})();

/* ---------------- save data ---------------- */
var Save = {
  coins:   Store.get('coins', 500),
  xp:      Store.get('xp', 0),
  best:    Store.get('best', {}),
  done:    Store.get('done', {}),
  upgrades:Store.get('upg', {engine:0,tyres:0,brakes:0,tank:0,armor:0,gearbox:0}),
  paint:   Store.get('paint', 0),
  num:     Store.get('num', 7),
  cons:    Store.get('cons', {repair:1,fuel:1,boost:1}),
  settings:Store.get('set', {music:true,sfx:true,quality:(IS_MOBILE?1:2),cam:1,units:'kmh',invert:false,assist:true}),
  flush: function(){
    Store.set('coins',this.coins); Store.set('xp',this.xp); Store.set('best',this.best);
    Store.set('done',this.done); Store.set('upg',this.upgrades); Store.set('paint',this.paint);
    Store.set('num',this.num); Store.set('cons',this.cons); Store.set('set',this.settings);
  }
};
function level(){ return 1 + Math.floor(Save.xp/1000); }
function addCoins(n){ Save.coins = Math.max(0, Save.coins + n); Save.flush(); refreshCoins(); }
function refreshCoins(){
  var a=document.getElementById('coinsMenu'), b=document.getElementById('coinsShop'), l=document.getElementById('lvlMenu');
  if(a) a.textContent = Save.coins; if(b) b.textContent = Save.coins; if(l) l.textContent = level();
}

/* =====================================================================
   ADS  — AdSense on web, AdMob bridge in app
   ===================================================================== */
var Ads = (function () {
  var interShown = 0, lastInter = 0;

  function nativeCall(name, args){
    try{
      if (window.TCNative && typeof window.TCNative[name] === 'function'){ window.TCNative[name](JSON.stringify(args||{})); return true; }
      if (window.AndroidBridge && typeof window.AndroidBridge[name] === 'function'){ window.AndroidBridge[name](JSON.stringify(args||{})); return true; }
      if (window.admob){ // cordova-plugin-admob-free style
        if(name==='showBanner'){ window.admob.banner.config({id:ADMOB_BANNER,isTesting:false,autoShow:true}); window.admob.banner.prepare(); return true; }
        if(name==='showInterstitial'){ window.admob.interstitial.config({id:ADMOB_INTERSTITIAL,isTesting:false,autoShow:true}); window.admob.interstitial.prepare(); return true; }
        if(name==='showRewarded'){ window.admob.rewardvideo.config({id:ADMOB_REWARDED,isTesting:false,autoShow:true}); window.admob.rewardvideo.prepare(); return true; }
      }
      if (window.AdMob && window.AdMob.showBannerAd && name==='showBanner'){ window.AdMob.showBannerAd({adId:ADMOB_BANNER,position:'BOTTOM_CENTER'}); return true; }
      if (window.AdMob && window.AdMob.showInterstitial && name==='showInterstitial'){ window.AdMob.showInterstitial({adId:ADMOB_INTERSTITIAL}); return true; }
      if (window.AdMob && window.AdMob.showRewardVideoAd && name==='showRewarded'){ window.AdMob.showRewardVideoAd({adId:ADMOB_REWARDED}); return true; }
    }catch(e){}
    return false;
  }

  function pushAdsense(container, format){
    if (!container) return;
    container.innerHTML = '';
    var lab = document.createElement('div'); lab.className='adlabel'; lab.textContent='Advertisement';
    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.style.width = '100%';
    ins.setAttribute('data-ad-client', AD_CLIENT);
    ins.setAttribute('data-ad-slot', AD_SLOT_BANNER);
    ins.setAttribute('data-ad-format', format || 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');
    container.appendChild(lab); container.appendChild(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
  }

  return {
    /* Banner: bottom of screen on app / phone, top strip on desktop menus only */
    showBanner: function () {
      if (IS_APP) { nativeCall('showBanner'); return; }
      var el = document.getElementById('adBottom');
      if (!el) return;
      el.classList.remove('hide');
      if (!el.dataset.filled) { pushAdsense(el, 'horizontal'); el.dataset.filled = '1'; }
    },
    hideBanner: function () {
      if (IS_APP) { nativeCall('hideBanner'); return; }
      var el = document.getElementById('adBottom'); if (el) el.classList.add('hide');
    },
    /* Interstitial after a race finishes (throttled) */
    interstitial: function (done) {
      var now = Date.now();
      interShown++;
      if (now - lastInter < 45000) { if (done) done(); return; }
      lastInter = now;
      if (IS_APP && nativeCall('showInterstitial')) { setTimeout(done || function(){}, 300); return; }
      var box = document.getElementById('adInter');
      var slot = document.getElementById('adInterSlot');
      var skip = document.getElementById('adSkip');
      var close = document.getElementById('adClose');
      box.style.display = 'flex';
      pushAdsense(slot, 'rectangle');
      var t = 5; skip.textContent = 'Continuing in ' + t + '…'; close.classList.add('hide');
      var iv = setInterval(function () {
        t--; skip.textContent = t > 0 ? 'Continuing in ' + t + '…' : 'You can close this ad';
        if (t <= 0) { clearInterval(iv); close.classList.remove('hide'); }
      }, 1000);
      close.onclick = function () { box.style.display = 'none'; clearInterval(iv); if (done) done(); };
    },
    /* Rewarded — grants a hint / repair */
    rewarded: function (onReward) {
      if (IS_APP) {
        window.tcOnRewarded = function () { onReward(true); };
        if (nativeCall('showRewarded')) return;
      }
      var box = document.getElementById('adInter'), slot = document.getElementById('adInterSlot');
      var skip = document.getElementById('adSkip'), close = document.getElementById('adClose');
      box.style.display = 'flex'; pushAdsense(slot, 'rectangle');
      var t = 6, granted = false; close.classList.add('hide');
      skip.textContent = 'Reward unlocks in ' + t + '…';
      var iv = setInterval(function () {
        t--; if (t > 0) skip.textContent = 'Reward unlocks in ' + t + '…';
        else { clearInterval(iv); granted = true; skip.textContent = '✔ Reward unlocked'; close.classList.remove('hide'); }
      }, 1000);
      close.onclick = function () { box.style.display = 'none'; clearInterval(iv); onReward(granted); };
    }
  };
})();
window.tcRewardGranted = function(){ if(window.tcOnRewarded) window.tcOnRewarded(); };

/* =====================================================================
   AUDIO — fully procedural (menu music, engine, crowd, tyres, crashes)
   ===================================================================== */
var Audio2 = (function () {
  var ctx = null, master = null, musicGain = null, sfxGain = null, started = false;
  var engine = null, crowd = null, skid = null, wind = null, musicTimer = null, musicStep = 0;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = Save.settings.music ? 0.34 : 0; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = Save.settings.sfx ? 0.85 : 0; sfxGain.connect(master);
    return ctx;
  }
  function noiseBuffer(sec) {
    var n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    var last = 0;
    for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
    return b;
  }
  /* ---- engine: harmonic stack + intake noise ---- */
  function buildEngine() {
    var out = ctx.createGain(); out.gain.value = 0; out.connect(sfxGain);
    var shaper = ctx.createWaveShaper();
    var curve = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) { var x = i / 512 - 1; curve[i] = Math.tanh(x * 2.4); }
    shaper.curve = curve; shaper.connect(out);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 1.2; lp.connect(shaper);
    var oscs = [], gains = [], mults = [0.5, 1, 1.5, 2, 3, 4], amps = [0.5, 1, 0.45, 0.34, 0.16, 0.09];
    for (var j = 0; j < mults.length; j++) {
      var o = ctx.createOscillator(); o.type = j % 2 ? 'sawtooth' : 'square';
      var g = ctx.createGain(); g.gain.value = amps[j] * 0.16;
      o.connect(g); g.connect(lp); o.start(); oscs.push(o); gains.push(g);
    }
    var ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(2); ns.loop = true;
    var nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 900; nf.Q.value = 0.7;
    var ng = ctx.createGain(); ng.gain.value = 0.05;
    ns.connect(nf); nf.connect(ng); ng.connect(lp); ns.start();
    return { out: out, oscs: oscs, mults: mults, lp: lp, ng: ng, nf: nf };
  }
  function buildLoopNoise(freq, q, vol, type) {
    var s = ctx.createBufferSource(); s.buffer = noiseBuffer(2.5); s.loop = true;
    var f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    var g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(sfxGain); s.start();
    return { g: g, f: f, base: vol };
  }
  /* ---- menu / race music ---- */
  var SCALE = [0, 3, 5, 7, 10, 12, 15];
  var PROG = [0, 0, -4, -4, -2, -2, 3, 3];
  function tone(freq, t, dur, type, vol, dest) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(dest || musicGain); o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(t, kind) {
    if (kind === 'k') {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.25);
    } else {
      var s = ctx.createBufferSource(); s.buffer = noiseBuffer(0.25);
      var f = ctx.createBiquadFilter(); f.type = kind === 's' ? 'bandpass' : 'highpass';
      f.frequency.value = kind === 's' ? 1700 : 7000; f.Q.value = 0.8;
      var g = ctx.createGain(); g.gain.setValueAtTime(kind === 's' ? 0.3 : 0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 's' ? 0.16 : 0.05));
      s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); s.stop(t + 0.3);
    }
  }
  function schedule() {
    if (!ctx) return;
    var bpm = 132, spb = 60 / bpm, bar = spb * 4, t0 = ctx.currentTime + 0.06;
    var root = 55 * Math.pow(2, PROG[musicStep % PROG.length] / 12);
    for (var b = 0; b < 4; b++) {
      var tb = t0 + b * spb;
      drum(tb, 'k'); if (b % 2 === 1) drum(tb, 's');
      drum(tb + spb * 0.5, 'h'); drum(tb + spb * 0.25, 'h');
      tone(root, tb, spb * 0.9, 'sawtooth', 0.16);
      tone(root, tb + spb * 0.5, spb * 0.4, 'sawtooth', 0.1);
    }
    for (var i = 0; i < 8; i++) {
      var n = SCALE[(i * 3 + musicStep) % SCALE.length];
      tone(root * 4 * Math.pow(2, n / 12), t0 + i * spb * 0.5, 0.28, 'square', 0.055);
    }
    tone(root * 2, t0, bar, 'triangle', 0.05);
    tone(root * 2 * Math.pow(2, 7 / 12), t0, bar, 'triangle', 0.04);
    musicStep++;
  }
  return {
    unlock: function () {
      if (started) { if (ctx && ctx.state === 'suspended') ctx.resume(); return; }
      if (!ensure()) return;
      started = true;
      engine = buildEngine();
      crowd = buildLoopNoise(620, 0.45, 0.16, 'bandpass');
      skid = buildLoopNoise(1500, 4.5, 0.3, 'bandpass');
      wind = buildLoopNoise(430, 0.35, 0.14, 'lowpass');
      if (ctx.state === 'suspended') ctx.resume();
    },
    music: function (on) {
      if (!ctx) return;
      if (on && Save.settings.music) { if (!musicTimer) { schedule(); musicTimer = setInterval(schedule, (60 / 132) * 4 * 1000); } }
      else { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
    },
    setMusic: function (v) { if (musicGain) musicGain.gain.value = v ? 0.34 : 0; },
    setSfx: function (v) { if (sfxGain) sfxGain.gain.value = v ? 0.85 : 0; },
    engine: function (rpm01, load, speed01, inCar) {
      if (!engine) return;
      var f = 34 + rpm01 * 168;
      var now = ctx.currentTime;
      for (var i = 0; i < engine.oscs.length; i++) {
        engine.oscs[i].frequency.setTargetAtTime(f * engine.mults[i], now, 0.03);
      }
      engine.lp.frequency.setTargetAtTime(500 + rpm01 * 3600 + load * 900, now, 0.05);
      engine.ng.gain.setTargetAtTime(0.02 + load * 0.09, now, 0.05);
      engine.out.gain.setTargetAtTime((inCar ? 0.5 : 0.3) * (0.25 + 0.75 * (0.25 + load * 0.75)), now, 0.05);
      if (wind) wind.g.gain.setTargetAtTime(speed01 * 0.16, now, 0.15);
    },
    crowd: function (v) { if (crowd) crowd.g.gain.setTargetAtTime(v * 0.2, ctx.currentTime, 0.4); },
    skid: function (v) {
      if (!skid) return;
      skid.g.gain.setTargetAtTime(v * 0.22, ctx.currentTime, 0.05);
      skid.f.frequency.setTargetAtTime(1100 + v * 1400, ctx.currentTime, 0.1);
    },
    crash: function (power) {
      if (!ctx) return;
      var t = ctx.currentTime;
      var s = ctx.createBufferSource(); s.buffer = noiseBuffer(0.9);
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3600, t);
      f.frequency.exponentialRampToValueAtTime(160, t + 0.5);
      var g = ctx.createGain(); g.gain.setValueAtTime(Math.min(1, power) * 0.85, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t); s.stop(t + 0.8);
      var o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.35);
      og.gain.setValueAtTime(Math.min(1, power) * 0.6, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(og); og.connect(sfxGain); o.start(t); o.stop(t + 0.5);
    },
    beep: function (hi) {
      if (!ctx) return;
      tone(hi ? 880 : 440, ctx.currentTime, hi ? 0.5 : 0.22, 'square', 0.22, sfxGain);
    },
    whoosh: function () {
      if (!ctx) return;
      var t = ctx.currentTime;
      var s = ctx.createBufferSource(); s.buffer = noiseBuffer(0.6);
      var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
      f.frequency.setValueAtTime(400, t); f.frequency.linearRampToValueAtTime(2200, t + 0.25);
      var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.1); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t); s.stop(t + 0.5);
    },
    ui: function () { if (ctx) tone(660, ctx.currentTime, 0.08, 'square', 0.12, sfxGain); }
  };
})();

/* =====================================================================
   TRACK DATABASE — 30 circuits
   ===================================================================== */
var TRACKS = [
 {n:"Daybreak Oval",        c:"United States", f:"USA", shape:"oval",     env:"plains",   tod:"sunrise", seed:11, laps:7,  diff:0},
 {n:"Metro Speedway",       c:"United States", f:"USA", shape:"trioval",  env:"city",     tod:"day",     seed:23, laps:7,  diff:0},
 {n:"Sunset Superspeedway", c:"United States", f:"USA", shape:"super",    env:"desert",   tod:"sunset",  seed:37, laps:6,  diff:1},
 {n:"Silverpine Raceway",   c:"Canada",        f:"CAN", shape:"road",     env:"forest",   tod:"day",     seed:41, laps:6,  diff:1},
 {n:"Harbour Lights",       c:"United Kingdom",f:"GBR", shape:"street",   env:"city",     tod:"night",   seed:53, laps:7,  diff:1},
 {n:"Alpen Ring",           c:"Switzerland",   f:"SUI", shape:"road",     env:"mountain", tod:"day",     seed:67, laps:6,  diff:1},
 {n:"Sahara Dunes",         c:"Morocco",       f:"MAR", shape:"oval",     env:"desert",   tod:"sunset",  seed:71, laps:7,  diff:1},
 {n:"Neon Tokyo Loop",      c:"Japan",         f:"JPN", shape:"street",   env:"city",     tod:"night",   seed:83, laps:7,  diff:2},
 {n:"Copacabana Circuit",   c:"Brazil",        f:"BRA", shape:"road",     env:"coast",    tod:"sunset",  seed:97, laps:6,  diff:1},
 {n:"Outback Mile",         c:"Australia",     f:"AUS", shape:"oval",     env:"outback",  tod:"day",     seed:103,laps:7,  diff:1},
 {n:"Monsoon Valley",       c:"India",         f:"IND", shape:"road",     env:"hills",    tod:"overcast",seed:109,laps:6,  diff:1},
 {n:"Nordic Fjord",         c:"Norway",        f:"NOR", shape:"road",     env:"coast",    tod:"sunrise", seed:113,laps:6,  diff:2},
 {n:"Dragon Gorge",         c:"China",         f:"CHN", shape:"road",     env:"mountain", tod:"day",     seed:127,laps:6,  diff:2},
 {n:"Savanna Speedway",     c:"Kenya",         f:"KEN", shape:"oval",     env:"savanna",  tod:"sunset",  seed:131,laps:7,  diff:1},
 {n:"Alpine Night Ring",    c:"Austria",       f:"AUT", shape:"road",     env:"mountain", tod:"night",   seed:137,laps:6,  diff:2},
 {n:"Golden Coast Tri-Oval",c:"United States", f:"USA", shape:"trioval",  env:"coast",    tod:"sunset",  seed:139,laps:7,  diff:1},
 {n:"Pampas Sprint",        c:"Argentina",     f:"ARG", shape:"oval",     env:"plains",   tod:"day",     seed:149,laps:7,  diff:1},
 {n:"Iberian Plateau",      c:"Spain",         f:"ESP", shape:"road",     env:"arid",     tod:"day",     seed:151,laps:6,  diff:1},
 {n:"Bavarian Ring",        c:"Germany",       f:"GER", shape:"road",     env:"forest",   tod:"overcast",seed:157,laps:6,  diff:2},
 {n:"Emerald Isle Loop",    c:"Ireland",       f:"IRL", shape:"road",     env:"hills",    tod:"day",     seed:163,laps:6,  diff:1},
 {n:"Desert Mirage Bowl",   c:"UAE",           f:"UAE", shape:"super",    env:"city",     tod:"night",   seed:167,laps:6,  diff:2},
 {n:"Cape Point Circuit",   c:"South Africa",  f:"RSA", shape:"road",     env:"coast",    tod:"day",     seed:173,laps:6,  diff:2},
 {n:"Volcano Rim",          c:"Iceland",       f:"ISL", shape:"road",     env:"volcanic", tod:"sunrise", seed:179,laps:6,  diff:2},
 {n:"Bosphorus Dash",       c:"Turkey",        f:"TUR", shape:"street",   env:"city",     tod:"sunset",  seed:181,laps:7,  diff:2},
 {n:"Siberian Frost Oval",  c:"Russia",        f:"RUS", shape:"oval",     env:"snow",     tod:"overcast",seed:191,laps:7,  diff:2},
 {n:"Andes Skyline",        c:"Peru",          f:"PER", shape:"road",     env:"mountain", tod:"day",     seed:193,laps:6,  diff:2},
 {n:"Bayou Bullring",       c:"United States", f:"USA", shape:"short",    env:"swamp",    tod:"night",   seed:197,laps:10, diff:2},
 {n:"Riviera Grand",        c:"France",        f:"FRA", shape:"street",   env:"coast",    tod:"sunset",  seed:199,laps:7,  diff:2},
 {n:"Lion City Night Loop", c:"Singapore",     f:"SGP", shape:"street",   env:"city",     tod:"night",   seed:211,laps:7,  diff:2},
 {n:"Champions Superdome",  c:"World Final",   f:"WLD", shape:"super",    env:"city",     tod:"sunset",  seed:223,laps:6,  diff:2}
];

/* ---------------- environment palettes ---------------- */
var ENV = {
  plains:  {ground:0x4d6b34, ground2:0x60803f, grass:0x5c7d3a, trees:0.55, rocks:.1, city:0,   mount:.25, snow:0},
  desert:  {ground:0xc2a06a, ground2:0xd8bb84, grass:0xb59156, trees:0.06, rocks:.7, city:0,   mount:.5,  snow:0},
  forest:  {ground:0x35502a, ground2:0x2c4423, grass:0x3d5c2f, trees:1.0,  rocks:.25,city:0,   mount:.35, snow:0},
  city:    {ground:0x4a4f57, ground2:0x3c4149, grass:0x54606a, trees:0.15, rocks:.05,city:1,   mount:.05, snow:0},
  mountain:{ground:0x50663f, ground2:0x455a37, grass:0x55704a, trees:0.7,  rocks:.6, city:0,   mount:1,   snow:.3},
  coast:   {ground:0x6f7f52, ground2:0xc9bd8d, grass:0x77894f, trees:0.35, rocks:.3, city:.25, mount:.15, snow:0},
  outback: {ground:0xa8703f, ground2:0xbd8a4e, grass:0x9c6b3c, trees:0.12, rocks:.55,city:0,   mount:.3,  snow:0},
  hills:   {ground:0x4e7238, ground2:0x5d8442, grass:0x54793c, trees:0.6,  rocks:.3, city:.08, mount:.55, snow:0},
  savanna: {ground:0x9d8a45, ground2:0xb09b53, grass:0x94823f, trees:0.3,  rocks:.25,city:0,   mount:.25, snow:0},
  arid:    {ground:0x9a7c4e, ground2:0xab8b5a, grass:0x8d7247, trees:0.15, rocks:.5, city:.05, mount:.4,  snow:0},
  volcanic:{ground:0x3b3735, ground2:0x2d2a29, grass:0x46504a, trees:0.05, rocks:.9, city:0,   mount:.7,  snow:.1},
  snow:    {ground:0xdfe8f2, ground2:0xc9d6e4, grass:0xe6eef7, trees:0.35, rocks:.2, city:0,   mount:.6,  snow:1},
  swamp:   {ground:0x3a4a30, ground2:0x2f3d28, grass:0x415433, trees:0.75, rocks:.15,city:0,   mount:.05, snow:0}
};
var TOD = {
  sunrise: {sky1:0x1b2b52, sky2:0xff9a52, sun:0xffd9a0, sunEl:0.10, sunAz:2.2, amb:0.44, dir:0.95, fog:0xd9a76e, fogD:0.00048, night:0},
  day:     {sky1:0x2f6fd0, sky2:0xa8cff0, sun:0xffffff, sunEl:0.72, sunAz:1.0, amb:0.60, dir:1.20, fog:0xbcd3ea, fogD:0.00030, night:0},
  sunset:  {sky1:0x241a45, sky2:0xff6b2a, sun:0xffc06a, sunEl:0.07, sunAz:5.1, amb:0.42, dir:1.05, fog:0xe08a4a, fogD:0.00052, night:0},
  night:   {sky1:0x03060f, sky2:0x0d1a35, sun:0x8ea8d8, sunEl:0.35, sunAz:3.4, amb:0.26, dir:0.28, fog:0x070c18, fogD:0.00082, night:1},
  overcast:{sky1:0x59636f, sky2:0x99a4b0, sun:0xd7dee6, sunEl:0.55, sunAz:1.8, amb:0.64, dir:0.52, fog:0x8d99a6, fogD:0.00070, night:0}
};

/* ---------------- deterministic RNG ---------------- */
function RNG(seed){ var s = seed >>> 0 || 1; return function(){ s ^= s<<13; s>>>=0; s ^= s>>17; s ^= s<<5; s>>>=0; return s/4294967296; }; }

/* ---------------- track geometry generator ---------------- */
function buildCentreline(t){
  var rnd = RNG(t.seed), pts = [], i, N;
  var a, b, ph = [rnd()*6.28, rnd()*6.28, rnd()*6.28, rnd()*6.28];
  if (t.shape === 'oval')       { a=425; b=275; N=40; }
  else if (t.shape === 'super') { a=545; b=345; N=44; }
  else if (t.shape === 'short') { a=275; b=195; N=36; }
  else if (t.shape === 'trioval'){a=445; b=290; N=42; }
  else                          { a=272; b=272; N=64; }

  for (i=0;i<N;i++){
    var th = i/N*Math.PI*2, x, z, r;
    if (t.shape==='road'){
      r = 1 + 0.22*Math.sin(3*th+ph[0]) + 0.12*Math.sin(5*th+ph[1]) + 0.06*Math.sin(7*th+ph[2]) + 0.03*Math.sin(11*th+ph[3]);
      x = Math.cos(th)*a*r; z = Math.sin(th)*b*r;
    } else if (t.shape==='street'){
      r = 1 + 0.18*Math.sin(2*th+ph[0]) + 0.11*Math.sin(4*th+ph[1]) + 0.07*Math.sin(6*th+ph[2]);
      var sq = 1/Math.max(Math.abs(Math.cos(th)),Math.abs(Math.sin(th)));
      r *= (1 + (sq-1)*0.13);
      x = Math.cos(th)*a*r; z = Math.sin(th)*b*r;
    } else if (t.shape==='trioval'){
      var bulge = 1 + 0.13*Math.exp(-Math.pow(((th+Math.PI/2)%(Math.PI*2))-Math.PI/2,2)*3.0);
      x = Math.cos(th)*a*bulge; z = Math.sin(th)*b;
    } else {
      x = Math.cos(th)*a; z = Math.sin(th)*b;
    }
    pts.push(new THREE.Vector3(x, 0, z));
  }
  return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
}

function trackWidth(t){
  if (t.shape==='super') return 28;
  if (t.shape==='oval')  return 25;
  if (t.shape==='trioval')return 26;
  if (t.shape==='short') return 23;
  if (t.shape==='street')return 22;
  return 26;
}
function trackBank(t){
  if (t.shape==='super') return 0.42;
  if (t.shape==='oval')  return 0.32;
  if (t.shape==='trioval')return 0.34;
  if (t.shape==='short') return 0.22;
  if (t.shape==='street')return 0.02;
  return 0.06;
}

/* ---------------- canvas texture helpers ---------------- */
function cvs(w,h){ var c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
function tex(c, rx, ry){
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (rx) t.repeat.set(rx, ry||1);
  t.anisotropy = 4;
  return t;
}
var SPONSORS = ["VOLT FUEL","REDLINE TYRES","APEX BANK","NOVA COLA","TITAN TOOLS","ZENITH OIL","HYPERDRIVE",
  "SKYLINE MOTORS","IRONCLAD PARTS","BLUEWAVE TECH","MACH-9 ENERGY","GRIDLOCK GEAR","AURORA WHEELS",
  "PISTON KING","OCTANE PLUS","VERTEX AERO","STORMFRONT","CARBON CO.","OFFLINEGAMES.ART","THUNDER CIRCUIT"];
var SPONSOR_COLORS = [0xe23b3b,0x2f7de0,0x27a25b,0xf0a020,0x8b4fe0,0xe0508c,0x18b6c6,0xd9d9d9];

function billboardTexture(i){
  var c = cvs(512,256), g = c.getContext('2d');
  var col = SPONSOR_COLORS[i % SPONSOR_COLORS.length];
  var hex = '#'+('000000'+col.toString(16)).slice(-6);
  var grad = g.createLinearGradient(0,0,512,256);
  grad.addColorStop(0,hex); grad.addColorStop(1,'#111820');
  g.fillStyle = grad; g.fillRect(0,0,512,256);
  g.fillStyle='rgba(255,255,255,.12)';
  for(var k=0;k<7;k++) g.fillRect(0, 20+k*34, 512, 6);
  g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle';
  var name = SPONSORS[i % SPONSORS.length];
  g.font = 'bold '+(name.length>14?42:56)+'px Arial Black, Arial';
  g.fillText(name, 256, 118);
  g.font = 'bold 22px Arial'; g.fillStyle='rgba(255,255,255,.75)';
  g.fillText('OFFICIAL PARTNER OF THUNDER CIRCUIT', 256, 190);
  g.strokeStyle='rgba(255,255,255,.4)'; g.lineWidth=8; g.strokeRect(4,4,504,248);
  return tex(c);
}
function asphaltTexture(){
  var c = cvs(256,256), g = c.getContext('2d');
  g.fillStyle='#4e535b'; g.fillRect(0,0,256,256);
  for(var i=0;i<9000;i++){
    var v = 58 + Math.random()*44;
    g.fillStyle='rgba('+(v|0)+','+((v+2)|0)+','+((v+6)|0)+',.55)';
    g.fillRect(Math.random()*256, Math.random()*256, 2, 2);
  }
  g.strokeStyle='rgba(34,36,40,.30)'; g.lineWidth=2;
  for(var j=0;j<12;j++){ g.beginPath(); g.moveTo(Math.random()*256,0); g.lineTo(Math.random()*256,256); g.stroke(); }
  return tex(c, 5, 26);
}
function windowTexture(night){
  var c = cvs(128,256), g = c.getContext('2d');
  g.fillStyle = night ? '#0b1018' : '#5f6a78'; g.fillRect(0,0,128,256);
  for(var y=6;y<250;y+=14) for(var x=6;x<120;x+=14){
    var lit = Math.random() < (night?0.42:0.16);
    if(night) g.fillStyle = lit ? ['#ffe9a8','#fff3cf','#a8d4ff','#ffd07a'][(Math.random()*4)|0] : '#131a26';
    else g.fillStyle = lit ? '#9fb6cc' : '#39424f';
    g.fillRect(x,y,9,9);
  }
  return tex(c);
}
function crowdTexture(){
  var c = cvs(256,128), g = c.getContext('2d');
  g.fillStyle='#1a2030'; g.fillRect(0,0,256,128);
  var cols=['#e8534a','#4a86e8','#f2c14e','#57c07f','#f0f0f0','#8e5ce0','#e88a3c','#2a3550'];
  for(var i=0;i<1400;i++){
    g.fillStyle = cols[(Math.random()*cols.length)|0];
    var x=Math.random()*256, y=Math.random()*128;
    g.fillRect(x,y,3,3); g.fillRect(x,y+3,3,4);
  }
  g.fillStyle='rgba(0,0,0,.28)';
  for(var r=0;r<10;r++) g.fillRect(0, r*13+10, 256, 2);
  return tex(c);
}
/* ================= LIVERY ARTWORK ================= */
function shade(hex, k){
  var c=new THREE.Color(hex);
  return '#'+new THREE.Color(Math.min(1,c.r*k),Math.min(1,c.g*k),Math.min(1,c.b*k)).getHexString();
}
var CONTINGENCY=[['#e8342a','SUNOCO'],['#1b4fa0','MAHLE'],['#f2b21c','EDELBROCK'],['#0f9b52','MOOG'],
                 ['#111820','WIX'],['#c8102e','XFINITY'],['#f4f6f8','FEATHERLITE'],['#2b6cb0','OMP']];
/* one flank of the car. flip=true mirrors the LAYOUT (nose to the left) but keeps text upright. */
function drawFlank(g, W, H, cfg, flip){
  function X(u){ return flip ? W-u*W : u*W; }
  var base=cfg.base, acc=cfg.acc, num=String(cfg.num);
  g.fillStyle=base; g.fillRect(0,0,W,H);
  // lower sweep in the accent colour
  g.fillStyle=acc; g.beginPath();
  g.moveTo(X(0),H); g.lineTo(X(1),H); g.lineTo(X(1),H*0.34); g.lineTo(X(0),H*0.62); g.closePath(); g.fill();
  // white separator
  g.fillStyle='rgba(255,255,255,.94)'; g.beginPath();
  g.moveTo(X(0),H*0.66); g.lineTo(X(1),H*0.38); g.lineTo(X(1),H*0.30); g.lineTo(X(0),H*0.58); g.closePath(); g.fill();
  // thin pinstripe
  g.strokeStyle=shade(cfg.accHex,0.55); g.lineWidth=H*0.018; g.beginPath();
  g.moveTo(X(0),H*0.70); g.lineTo(X(1),H*0.42); g.stroke();
  // door number roundel
  var cx=X(0.50), cy=H*0.44;
  g.save(); g.translate(cx,cy); if(flip) g.scale(-1,1);
  g.fillStyle='rgba(255,255,255,.96)';
  g.beginPath(); g.ellipse(0,0,H*0.40,H*0.40,0,0,6.3); g.fill();
  g.strokeStyle=acc; g.lineWidth=H*0.05; g.stroke();
  g.fillStyle=acc; g.textAlign='center'; g.textBaseline='middle';
  g.font='900 '+Math.round(H*0.56)+'px Arial Black, Arial';
  g.fillText(num,0,H*0.02);
  g.restore();
  // sponsor wordmark on the quarter panel
  g.save(); g.translate(X(0.255),H*0.40); if(flip) g.scale(-1,1);
  g.fillStyle='#ffffff'; g.textAlign='center'; g.textBaseline='middle';
  var nm=cfg.sponsor, fs=Math.round(H*0.30*Math.min(1,11/nm.length));
  g.font='900 '+fs+'px Arial Black, Arial';
  g.strokeStyle='rgba(0,0,0,.45)'; g.lineWidth=fs*0.10; g.strokeText(nm,0,0); g.fillText(nm,0,0);
  g.restore();
  // secondary sponsor on the front fender
  g.save(); g.translate(X(0.775),H*0.33); if(flip) g.scale(-1,1);
  g.fillStyle='rgba(255,255,255,.92)'; g.textAlign='center'; g.textBaseline='middle';
  g.font='900 '+Math.round(H*0.20)+'px Arial Black, Arial';
  g.fillText(cfg.sponsor2,0,0);
  g.restore();
  // contingency decal strip along the bottom of the front fender
  for(var i=0;i<CONTINGENCY.length;i++){
    var u=0.60+i*0.045, bx=X(u), bw=W*0.038, bh=H*0.115;
    g.save(); g.translate(bx,H*0.80); if(flip) g.scale(-1,1);
    g.fillStyle=CONTINGENCY[i][0]; g.fillRect(-bw/2,-bh/2,bw,bh);
    g.strokeStyle='rgba(0,0,0,.35)'; g.lineWidth=1.5; g.strokeRect(-bw/2,-bh/2,bw,bh);
    g.fillStyle=CONTINGENCY[i][0]==='#f4f6f8'?'#111':'#fff';
    g.font='700 '+Math.round(bh*0.34)+'px Arial'; g.textAlign='center'; g.textBaseline='middle';
    g.fillText(CONTINGENCY[i][1].slice(0,7),0,0);
    g.restore();
  }
  // manufacturer + tyre supplier text
  g.save(); g.translate(X(0.93),H*0.60); if(flip) g.scale(-1,1);
  g.fillStyle='rgba(255,255,255,.85)'; g.font='700 '+Math.round(H*0.11)+'px Arial'; g.textAlign='center';
  g.fillText('THUNDER V8', 0, 0); g.restore();
  // panel shading so flat colour reads as bodywork
  var sh=g.createLinearGradient(0,0,0,H);
  sh.addColorStop(0,'rgba(255,255,255,.16)'); sh.addColorStop(.45,'rgba(255,255,255,0)');
  sh.addColorStop(1,'rgba(0,0,0,.30)');
  g.fillStyle=sh; g.fillRect(0,0,W,H);
}
function flankTexture(cfg, flip){
  var c=cvs(1024,256); drawFlank(c.getContext('2d'),1024,256,cfg,flip); return tex(c);
}
function roofTexture(cfg){
  var c=cvs(256,256), g=c.getContext('2d');
  g.fillStyle=cfg.base; g.fillRect(0,0,256,256);
  g.fillStyle=cfg.acc; g.fillRect(0,196,256,60);
  g.save(); g.translate(128,110); g.rotate(-Math.PI/2);
  g.fillStyle='rgba(255,255,255,.96)'; g.textAlign='center'; g.textBaseline='middle';
  g.font='900 150px Arial Black, Arial';
  g.strokeStyle=cfg.acc; g.lineWidth=13; g.strokeText(String(cfg.num),0,0); g.fillText(String(cfg.num),0,0);
  g.restore();
  return tex(c);
}
function hoodTexture(cfg){
  var c=cvs(512,256), g=c.getContext('2d');
  g.fillStyle=cfg.base; g.fillRect(0,0,512,256);
  g.fillStyle=cfg.acc; g.beginPath(); g.moveTo(0,256); g.lineTo(512,256); g.lineTo(512,150); g.lineTo(0,196); g.closePath(); g.fill();
  g.fillStyle='rgba(255,255,255,.95)'; g.textAlign='center'; g.textBaseline='middle';
  var nm=cfg.sponsor; g.font='900 '+Math.round(78*Math.min(1,10/nm.length))+'px Arial Black, Arial';
  g.strokeStyle='rgba(0,0,0,.4)'; g.lineWidth=7; g.strokeText(nm,256,104); g.fillText(nm,256,104);
  g.fillStyle='rgba(255,255,255,.7)'; g.font='700 26px Arial'; g.fillText('THUNDER CIRCUIT SERIES',256,225);
  return tex(c);
}
function bannerTexture(cfg){
  var c=cvs(512,64), g=c.getContext('2d');
  g.fillStyle=cfg.acc; g.fillRect(0,0,512,64);
  g.fillStyle='#fff'; g.font='900 40px Arial Black, Arial'; g.textAlign='center'; g.textBaseline='middle';
  g.fillText(cfg.driver.toUpperCase(),256,34);
  return tex(c);
}
function tyreTexture(){
  var c=cvs(256,256), g=c.getContext('2d');
  g.fillStyle='#15181d'; g.fillRect(0,0,256,256);
  g.beginPath(); g.arc(128,128,126,0,6.3); g.fillStyle='#1b1f26'; g.fill();
  g.strokeStyle='#f0d24a'; g.lineWidth=3;
  g.beginPath(); g.arc(128,128,104,0,6.3); g.stroke();
  g.save(); g.translate(128,128); g.fillStyle='#f0d24a';
  g.font='700 16px Arial'; g.textAlign='center'; g.textBaseline='middle';
  var s='RACE EAGLE • THUNDER SPEC • ';
  for(var i=0;i<s.length;i++){
    g.save(); g.rotate(i/s.length*6.2832); g.translate(0,-92); g.fillText(s[i],0,0); g.restore();
  }
  g.restore();
  g.beginPath(); g.arc(128,128,74,0,6.3); g.fillStyle='#2a2f38'; g.fill();
  return tex(c);
}
var _envTex=null;
function envTexture(){
  if(_envTex) return _envTex;
  var c=cvs(512,256), g=c.getContext('2d');
  var sky=g.createLinearGradient(0,0,0,128);
  sky.addColorStop(0,'#dfe9f6'); sky.addColorStop(1,'#8fb2d8');
  g.fillStyle=sky; g.fillRect(0,0,512,128);
  var gr=g.createLinearGradient(0,128,0,256);
  gr.addColorStop(0,'#5a6070'); gr.addColorStop(1,'#22262e');
  g.fillStyle=gr; g.fillRect(0,128,512,128);
  g.fillStyle='rgba(255,255,255,.55)';
  for(var i=0;i<26;i++) g.fillRect(Math.random()*512, 10+Math.random()*70, 40+Math.random()*90, 5+Math.random()*12);
  _envTex=new THREE.CanvasTexture(c);
  _envTex.mapping=THREE.EquirectangularReflectionMapping;
  return _envTex;
}
function skyMaterial(tod){
  var t = TOD[tod];
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite:false,
    uniforms:{
      c1:{value:new THREE.Color(t.sky1)}, c2:{value:new THREE.Color(t.sky2)},
      sunc:{value:new THREE.Color(t.sun)}, sunv:{value:new THREE.Vector3(0,1,0)}, night:{value:t.night}
    },
    vertexShader:'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:[
      'uniform vec3 c1,c2,sunc,sunv; uniform float night; varying vec3 vP;',
      'float hash(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453); }',
      'void main(){',
      ' float h = clamp(vP.y*1.15+0.06,0.0,1.0);',
      ' vec3 col = mix(c2, c1, pow(h,0.62));',
      ' float d = max(dot(vP, normalize(sunv)),0.0);',
      ' col += sunc * pow(d, 220.0) * 2.4;',
      ' col += sunc * pow(d, 7.0) * 0.30;',
      ' col += sunc * pow(d, 1.6) * 0.09;',
      ' if(night>0.5){ float s = hash(floor(vP*260.0)); if(s>0.9975 && vP.y>0.02) col += vec3(1.0)*(s-0.9975)*380.0; }',
      ' gl_FragColor = vec4(col,1.0);',
      '}'].join('\n')
  });
}

/* =====================================================================
   WORLD / TRACK BUILDER
   ===================================================================== */
var SAMPLES = 1000;
var Track = {
  data:null, curve:null, pts:[], fwd:[], rgt:[], bs:[], elev:[], cum:[], length:0,
  half:12, halfR:12, bank:0.3, pitA:0.90, pitB:0.06, pitW:19, group:null,

  build: function (t) {
    this.data = t;
    this.curve = buildCentreline(t);
    this.half = trackWidth(t)/2;
    this.bank = trackBank(t);
    var road = (t.shape==='road'||t.shape==='street');
    var hilly = road && (t.env==='mountain'||t.env==='hills'||t.env==='coast'||t.env==='volcanic');
    var i, n = SAMPLES, rnd = RNG(t.seed*7+3);
    var eph = [rnd()*6.28, rnd()*6.28, rnd()*6.28];
    this.pts=[]; this.fwd=[]; this.rgt=[]; this.bs=[]; this.elev=[]; this.cum=[0];
    var up = new THREE.Vector3(0,1,0);
    for (i=0;i<n;i++){
      var u = i/n;
      var p = this.curve.getPointAt(u);
      var f = this.curve.getTangentAt(u).normalize();
      var e = 0;
      if (hilly) e = 7*Math.sin(u*Math.PI*2*2+eph[0]) + 3.6*Math.sin(u*Math.PI*2*3+eph[1]) + 1.8*Math.sin(u*Math.PI*2*5+eph[2]);
      else if (road) e = 3.0*Math.sin(u*Math.PI*2*2+eph[0]) + 1.6*Math.sin(u*Math.PI*2*3+eph[1]);
      this.elev.push(e);
      p.y = e;
      this.pts.push(p);
      this.fwd.push(f);
      this.rgt.push(new THREE.Vector3().crossVectors(f, up).normalize());
    }
    for (i=0;i<n;i++){
      var a=this.pts[i], b=this.pts[(i+1)%n];
      this.cum.push(this.cum[i] + a.distanceTo(b));
    }
    this.length = this.cum[n];
    // signed curvature -> banking sign
    for (i=0;i<n;i++){
      var f0=this.fwd[(i-3+n)%n], f1=this.fwd[(i+3)%n];
      var d = new THREE.Vector3().subVectors(f1,f0);
      var s = d.dot(this.rgt[i]) / 0.28;
      this.bs.push(Math.max(-1,Math.min(1,s)));
    }
    // smooth banking
    var sm=[];
    for(i=0;i<n;i++){ var acc=0; for(var k=-14;k<=14;k++) acc+=this.bs[(i+k+n)%n]; sm.push(acc/29); }
    this.bs = sm;
    // pit apron widths
    // which side is the outside of the circuit? (stands + catch fence live there)
    var cx=0, cz=0;
    for(i=0;i<n;i++){ cx+=this.pts[i].x; cz+=this.pts[i].z; }
    cx/=n; cz/=n;
    var vote=0;
    for(i=0;i<n;i++) vote += ((this.pts[i].x-cx)*this.rgt[i].x + (this.pts[i].z-cz)*this.rgt[i].z) > 0 ? 1 : -1;
    this.outward = vote>=0 ? 1 : -1;

    this.halfR = [];
    for(i=0;i<n;i++){ this.halfR.push(this.half + this.pitExtra(i/n)); }
    return this;
  },
  pitExtra: function(u){
    // smooth window across the start/finish straight
    var d = u; if (d > 0.5) d -= 1;              // -0.5 .. 0.5
    var a = -0.13, b = 0.10;
    if (d < a-0.05 || d > b+0.05) return 0;
    var w = 1;
    if (d < a) w = (d-(a-0.05))/0.05;
    else if (d > b) w = 1-(d-b)/0.05;
    return Math.max(0, Math.min(1,w)) * this.pitW;
  },
  inPitWindow: function(u){ return this.pitExtra(u) > this.pitW*0.85; },
  bankHeight: function(i, lat){
    // banking now RAISES the outside instead of sinking it - the surface is always >= elev.
    // lat beyond the racing surface (the pit apron) is held flat at the outer-edge height.
    var hw = this.half;
    var u = Math.max(-1, Math.min(1, lat/hw));
    var K = this.bank*hw*0.62;
    return 0.5*K*(1 - this.bs[i]*u);
  },
  surfaceY: function(i, lat){ return this.elev[i] + this.bankHeight(i, lat); },
  /* interpolated between samples - discrete steps were what made the camera judder */
  smoothY: function(loc, lat){
    var n=SAMPLES, i=loc.idx, i2=(i+1)%n, seg=this.length/n;
    var f=Math.max(0, Math.min(1, (loc.lon||0)/seg));
    var y1=this.surfaceY(i,lat), y2=this.surfaceY(i2,lat);
    return y1 + (y2-y1)*f;
  },
  smoothBs: function(loc){
    var n=SAMPLES, i=loc.idx, i2=(i+1)%n, seg=this.length/n;
    var f=Math.max(0, Math.min(1, (loc.lon||0)/seg));
    return this.bs[i] + (this.bs[i2]-this.bs[i])*f;
  },

  /* nearest sample search with cache */
  locate: function(x, z, cache){
    var n=SAMPLES, best=-1, bd=1e18, i, s = (cache&&cache.idx!=null)?cache.idx:-1;
    if (s>=0){
      for(var k=-26;k<=26;k++){
        i=(s+k+n)%n; var p=this.pts[i]; var dx=p.x-x, dz=p.z-z; var d=dx*dx+dz*dz;
        if(d<bd){bd=d;best=i;}
      }
      if (bd < 90*90){ return this.frameAt(best, x, z, bd); }
    }
    for(i=0;i<n;i+=2){ var q=this.pts[i]; var ax=q.x-x, az=q.z-z; var dd=ax*ax+az*az; if(dd<bd){bd=dd;best=i;} }
    for(var j=-3;j<=3;j++){ i=(best+j+n)%n; var r=this.pts[i]; var bx=r.x-x, bz=r.z-z; var d2=bx*bx+bz*bz; if(d2<bd){bd=d2;best=i;} }
    return this.frameAt(best, x, z, bd);
  },
  frameAt: function(i, x, z){
    var p=this.pts[i], r=this.rgt[i], f=this.fwd[i];
    var dx=x-p.x, dz=z-p.z;
    var lat = dx*r.x + dz*r.z;
    var lon = dx*f.x + dz*f.z;
    var u = (this.cum[i] + lon) / this.length;
    u = u - Math.floor(u);
    return {idx:i, lat:lat, lon:lon, u:u};
  },
  point: function(u, lat){
    u = u - Math.floor(u);
    var fi = u*SAMPLES, i = Math.floor(fi)%SAMPLES;
    var p = this.pts[i], r = this.rgt[i];
    return new THREE.Vector3(p.x + r.x*lat, this.surfaceY(i, lat)+0.05, p.z + r.z*lat);
  },
  idxOf: function(u){ u=u-Math.floor(u); return Math.floor(u*SAMPLES)%SAMPLES; },
  /* curvature magnitude ahead — used by AI + camera */
  curvature: function(i, span){
    span = span||10;
    var n=SAMPLES, a=this.fwd[i], b=this.fwd[(i+span)%n];
    return Math.acos(Math.max(-1,Math.min(1,a.dot(b)))) / (span/SAMPLES*this.length);
  }
};

/* ---------------- three.js core ---------------- */
var renderer, scene, cam, sun, hemi, worldGroup, skyMesh, sunSprite;
var canvas = document.getElementById('c');

function initRenderer(){
  renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:!IS_MOBILE, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, IS_MOBILE?1.5:2));
  var v0=viewSize(); renderer.setSize(v0.w, v0.h);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = false;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(64, v0.w/v0.h, 0.15, 9000);
  window.addEventListener('resize', onResize);
}
function onResize(){
  checkOrientation();
  var v = viewSize();
  var r = document.documentElement.style;
  r.setProperty('--vw', v.w+'px');
  r.setProperty('--vh', v.h+'px');
  document.body.classList.toggle('compact', IS_TOUCH && v.h < 560);
  if(!renderer) return;
  renderer.setSize(v.w, v.h);
  cam.aspect = v.w/v.h; cam.updateProjectionMatrix();
}

/* ---------------- build the visual world ---------------- */
var QUAL = function(){ return Save.settings.quality; };

function buildWorld(t){
  if (worldGroup){ scene.remove(worldGroup); disposeGroup(worldGroup); }
  crowdMats.length=0; startLights.length=0;
  worldGroup = new THREE.Group(); scene.add(worldGroup);
  var tod = TOD[t.tod], env = ENV[t.env], q = QUAL();
  var n = SAMPLES;

  /* sky */
  var sunDir = new THREE.Vector3(Math.cos(tod.sunAz)*Math.cos(tod.sunEl*Math.PI/2), Math.sin(tod.sunEl*Math.PI/2), Math.sin(tod.sunAz)*Math.cos(tod.sunEl*Math.PI/2)).normalize();
  var skyMat = skyMaterial(t.tod);
  skyMat.uniforms.sunv.value.copy(sunDir);
  skyMesh = new THREE.Mesh(new THREE.SphereGeometry(4200, 24, 16), skyMat);
  skyMesh.frustumCulled = false; worldGroup.add(skyMesh);

  scene.fog = new THREE.FogExp2(tod.fog, tod.fogD);

  hemi = new THREE.HemisphereLight(tod.sky2, env.ground, tod.amb);
  worldGroup.add(hemi);
  sun = new THREE.DirectionalLight(tod.sun, tod.dir);
  sun.position.copy(sunDir).multiplyScalar(900); worldGroup.add(sun);
  worldGroup.add(new THREE.AmbientLight(0xffffff, tod.night?0.16:0.13));

  /* sun disc */
  var sc = cvs(128,128), sg = sc.getContext('2d');
  var rg = sg.createRadialGradient(64,64,2,64,64,64);
  rg.addColorStop(0,'rgba(255,255,255,1)'); rg.addColorStop(.25,'rgba(255,238,190,.9)');
  rg.addColorStop(1,'rgba(255,180,90,0)');
  sg.fillStyle=rg; sg.fillRect(0,0,128,128);
  sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({map:tex(sc), transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}));
  sunSprite.scale.set(560,560,1);
  sunSprite.position.copy(sunDir).multiplyScalar(3200);
  if(!tod.night) worldGroup.add(sunSprite);

  /* ground - a height field that hugs the circuit so it can never bury the road */
  worldGroup.add(nm(buildGround(t, env, tod),'GROUND'));
  worldGroup.add(nm(buildVerges(env, t.tod),'VERGE'));

  /* ============ ROAD ============ */
  /* Three vertices per station: the two edges of the racing surface plus the
     outer edge of the pit apron. Without the middle one the mesh interpolates
     straight across the apron while the physics surface goes flat past the
     racing edge - up to half a metre of mismatch on the pit straight. */
  var posA=[], uvA=[], idxA=[];
  var i, p, r, hl, hm, hr;
  for(i=0;i<=n;i++){
    var ii=i%n; p=Track.pts[ii]; r=Track.rgt[ii];
    hl = -Track.half; hm = Track.half; hr = Track.halfR[ii];
    var v = Track.cum[ii]/14;
    posA.push(p.x + r.x*hl, Track.surfaceY(ii,hl), p.z + r.z*hl);
    posA.push(p.x + r.x*hm, Track.surfaceY(ii,hm), p.z + r.z*hm);
    posA.push(p.x + r.x*hr, Track.surfaceY(ii,hr), p.z + r.z*hr);
    uvA.push(0, v, 1, v, 1 + (hr-hm)/(hm*2), v);
  }
  for(i=0;i<n;i++){
    var a=i*3, b=a+1, c2=a+2, d=a+3, e=a+4, f2=a+5;
    idxA.push(a,d,b, b,d,e);      // racing surface
    idxA.push(b,e,c2, c2,e,f2);   // pit apron
  }
  var rg2 = new THREE.BufferGeometry();
  rg2.setAttribute('position', new THREE.Float32BufferAttribute(posA,3));
  rg2.setAttribute('uv', new THREE.Float32BufferAttribute(uvA,2));
  rg2.setIndex(idxA); rg2.computeVertexNormals();
  var roadMat = new THREE.MeshLambertMaterial({map:asphaltTexture()});
  var roadMesh = new THREE.Mesh(rg2, roadMat); roadMesh.name='ROAD'; worldGroup.add(roadMesh);

  /* lane markings + rumble strips */
  worldGroup.add(nm(stripe(-Track.half+0.70, 0.60, 0xffffff, 0.10),'stripeL'));
  worldGroup.add(nm(stripe( Track.half-0.70, 0.60, 0xffe14d, 0.10),'stripeR'));
  worldGroup.add(nm(rumble(-Track.half+0.05, 1.5),'rumbleL'));
  worldGroup.add(nm(rumble( Track.half-0.05, 1.5),'rumbleR'));
  worldGroup.add(nm(startLine(),'startline'));
  worldGroup.add(nm(buildPitComplex(),'PITCOMPLEX'));

  /* ============ WALLS ============ */
  worldGroup.add(nm(wall(-1, t),'wallL'));
  worldGroup.add(nm(wall( 1, t),'wallR'));

  /* ============ SCENERY ============ */
  buildGrandstands(t, env, tod);
  buildCatchFence(t);
  buildBillboards(t);
  buildStartGantry();
  if (q>0) buildScenery(t, env, tod);
  if (q>0 && env.city>0) buildCity(t, env, tod);
  if (tod.night) buildTrackLights(t);
  if (env.mount>0) buildMountains(t, env, tod);
  buildClouds(t, tod);
}
function nm(o,n){ o.name=n; if(o.children) o.children.forEach(function(c){ if(!c.name) c.name=n; }); return o; }
function disposeGroup(g){
  g.traverse(function(o){
    if(o.geometry) o.geometry.dispose();
    if(o.material){ var m = Array.isArray(o.material)?o.material:[o.material];
      m.forEach(function(x){ if(x.map) x.map.dispose(); x.dispose(); }); }
  });
}
var Terrain = { h: function(){ return 0; } };
function makeTerrainSampler(t, env){
  var K=360, tx=new Float32Array(K), tz=new Float32Array(K), te=new Float32Array(K);
  for(var k=0;k<K;k++){
    var si=Math.floor(k*SAMPLES/K);
    tx[k]=Track.pts[si].x; tz[k]=Track.pts[si].z; te[k]=Track.elev[si];
  }
  var rnd=RNG(t.seed*53+17), ph=[rnd()*6.28, rnd()*6.28, rnd()*6.28];
  var relief=(env.mount>0.4?26:(env.mount>0.15?13:5));
  var ti=new Int32Array(K);
  for(var k2=0;k2<K;k2++) ti[k2]=Math.floor(k2*SAMPLES/K);
  return function(x,z){
    var bd=1e18, nearI=0;
    for(var q=0;q<K;q++){
      var dx=tx[q]-x, dz=tz[q]-z, d2=dx*dx+dz*dz;
      if(d2<bd){ bd=d2; nearI=ti[q]; }
    }
    // The ground is simply the ROAD SURFACE offset downward, held flat past the
    // barriers. Because the road is linear across its width, a grid cell spanning
    // it interpolates the same linear function - so the grass can never rise
    // through the tarmac no matter how coarse the grid, and there is no shelf.
    var p=Track.pts[nearI], r=Track.rgt[nearI];
    var lat=(x-p.x)*r.x + (z-p.z)*r.z;
    var c = lat>=0 ? (Track.halfR[nearI]+0.6) : -(Track.half+0.6);
    var latC = lat>=0 ? Math.min(lat, c) : Math.max(lat, c);
    var nearH = Track.surfaceY(nearI, latC) - 2.60;
    var d=Math.sqrt(bd), edge=Math.abs(c);
    var blend=Math.max(0, Math.min(1, (d-(edge+45))/420));
    var roll=(Math.sin(x/230+ph[0])*Math.sin(z/265+ph[1])+0.45*Math.sin(x/97+ph[2]))*relief;
    return nearH + blend*roll;
  };
}
function buildVerges(env, tod){
  var g=new THREE.Group(), n=SAMPLES, W=30;
  [-1,1].forEach(function(side){
    var pos=[], uv=[], idx=[], cnt=0;
    for(var i=0;i<n;i++){
      var i2=(i+1)%n;
      function edge(j){ return side>0 ? (Track.halfR[j]+0.6) : -(Track.half+0.6); }
      var l1=edge(i), l2=edge(i2);
      var p1=Track.pts[i], r1=Track.rgt[i], p2=Track.pts[i2], r2=Track.rgt[i2];
      var o1=l1+side*W, o2=l2+side*W;
      var ix1=p1.x+r1.x*l1, iz1=p1.z+r1.z*l1, ox1=p1.x+r1.x*o1, oz1=p1.z+r1.z*o1;
      var ix2=p2.x+r2.x*l2, iz2=p2.z+r2.z*l2, ox2=p2.x+r2.x*o2, oz2=p2.z+r2.z*o2;
      // inner edge meets the road exactly; outer edge meets the terrain exactly
      var yi1=Track.surfaceY(i,l1)-0.12,  yo1=Terrain.h(ox1,oz1);
      var yi2=Track.surfaceY(i2,l2)-0.12, yo2=Terrain.h(ox2,oz2);
      pos.push(ix1,yi1,iz1, ox1,yo1,oz1, ix2,yi2,iz2, ox2,yo2,oz2);
      var v1=Track.cum[i]/26, v2=Track.cum[i2]/26;
      uv.push(v1,0, v1,1.4, v2,0, v2,1.4);
      var b=cnt*4;
      if(side>0) idx.push(b,b+2,b+1, b+1,b+2,b+3);
      else       idx.push(b,b+1,b+2, b+1,b+3,b+2);
      cnt++;
    }
    var geo=new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(idx); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({map:groundTexture(env,tod), side:THREE.DoubleSide})));
  });
  return g;
}
function buildGround(t, env, tod){
  Terrain.h = makeTerrainSampler(t, env);          // always current for this circuit
  var SIZE=7200, SEG=(QUAL()>0?168:112);    // finer grid so it can follow the circuit
  var geo=new THREE.PlaneGeometry(SIZE,SIZE,SEG,SEG);
  var pos=geo.attributes.position.array;
  var H=Terrain.h;
  for(var v=0;v<pos.length;v+=3){
    pos[v+2] = H(pos[v], -pos[v+1]);         // plane is XY: local +y is world -z, local z is height
  }
  geo.computeVertexNormals();
  var g=new THREE.Mesh(geo, new THREE.MeshLambertMaterial({map:groundTexture(env,t.tod)}));
  g.rotation.x=-Math.PI/2;
  return g;
}
function groundTexture(env,tod){
  var c=cvs(256,256), g=c.getContext('2d');
  var A=new THREE.Color(env.ground), B=new THREE.Color(env.ground2);
  g.fillStyle='#'+A.getHexString(); g.fillRect(0,0,256,256);
  // broad, very low-contrast variation
  for(var i=0;i<40;i++){
    var m=Math.random();
    g.fillStyle='rgba('+Math.round(255*(A.r+(B.r-A.r)*m))+','+Math.round(255*(A.g+(B.g-A.g)*m))+','+
                Math.round(255*(A.b+(B.b-A.b)*m))+',0.14)';
    g.beginPath(); g.ellipse(Math.random()*256,Math.random()*256, 30+Math.random()*70, 26+Math.random()*60, Math.random()*3,0,6.3); g.fill();
  }
  // fine speckle so it reads as ground, not plastic
  var img=g.getImageData(0,0,256,256), d=img.data;
  for(var p=0;p<d.length;p+=4){
    var n=(Math.random()-0.5)*26;
    d[p]=Math.max(0,Math.min(255,d[p]+n));
    d[p+1]=Math.max(0,Math.min(255,d[p+1]+n));
    d[p+2]=Math.max(0,Math.min(255,d[p+2]+n));
  }
  g.putImageData(img,0,0);
  return tex(c, 300, 300);
}
function stripe(lat, w, color, y, dashed){
  var pos=[], idx=[], n=SAMPLES, cnt=0;
  for(var i=0;i<n;i++){
    if(dashed && (i%16)>8) continue;
    var i2=(i+1)%n;
    var p1=Track.pts[i], r1=Track.rgt[i], p2=Track.pts[i2], r2=Track.rgt[i2];
    var y1=Track.surfaceY(i,lat)+y, y2=Track.surfaceY(i2,lat)+y;
    pos.push(p1.x+r1.x*(lat-w),y1,p1.z+r1.z*(lat-w));
    pos.push(p1.x+r1.x*(lat+w),y1,p1.z+r1.z*(lat+w));
    pos.push(p2.x+r2.x*(lat-w),y2,p2.z+r2.z*(lat-w));
    pos.push(p2.x+r2.x*(lat+w),y2,p2.z+r2.z*(lat+w));
    var b=cnt*4; idx.push(b,b+2,b+1, b+1,b+2,b+3); cnt++;
  }
  var geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.setIndex(idx);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:color, side:THREE.DoubleSide}));
}
function rumble(lat, w){
  var pos=[], idx=[], col=[], n=SAMPLES, cnt=0;
  var cA=new THREE.Color(0xd83c30), cB=new THREE.Color(0xf2f2f2);
  for(var i=0;i<n;i++){
    var i2=(i+1)%n, c=((i/4)|0)%2?cA:cB;
    var p1=Track.pts[i], r1=Track.rgt[i], p2=Track.pts[i2], r2=Track.rgt[i2];
    var s = lat<0?-1:1;
    var l0 = lat, l1 = lat + s*w;
    var y1a=Track.surfaceY(i,l0)+0.05, y1b=Track.surfaceY(i,l1)+0.16;
    var y2a=Track.surfaceY(i2,l0)+0.05, y2b=Track.surfaceY(i2,l1)+0.16;
    pos.push(p1.x+r1.x*l0,y1a,p1.z+r1.z*l0, p1.x+r1.x*l1,y1b,p1.z+r1.z*l1,
             p2.x+r2.x*l0,y2a,p2.z+r2.z*l0, p2.x+r2.x*l1,y2b,p2.z+r2.z*l1);
    for(var k=0;k<4;k++) col.push(c.r,c.g,c.b);
    var b=cnt*4; idx.push(b,b+2,b+1, b+1,b+2,b+3); cnt++;
  }
  var geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({vertexColors:true, side:THREE.DoubleSide}));
}
function roadDecal(uStart, samples, latC, halfW, texture, yOff, flipV){
  var pos=[], uv=[], idx=[], n=SAMPLES, i0=Track.idxOf(uStart), cnt=0;
  for(var k=0;k<samples;k++){
    var i=(i0+k)%n, i2=(i0+k+1)%n;
    var p1=Track.pts[i], r1=Track.rgt[i], p2=Track.pts[i2], r2=Track.rgt[i2];
    var a=latC-halfW, b=latC+halfW;
    pos.push(p1.x+r1.x*a, Track.surfaceY(i,a)+yOff,  p1.z+r1.z*a,
             p1.x+r1.x*b, Track.surfaceY(i,b)+yOff,  p1.z+r1.z*b,
             p2.x+r2.x*a, Track.surfaceY(i2,a)+yOff, p2.z+r2.z*a,
             p2.x+r2.x*b, Track.surfaceY(i2,b)+yOff, p2.z+r2.z*b);
    var v1=k/samples, v2=(k+1)/samples;
    if(flipV){ v1=1-v1; v2=1-v2; }
    uv.push(0,v1, 1,v1, 0,v2, 1,v2);
    var q=cnt*4; idx.push(q,q+2,q+1, q+1,q+2,q+3); cnt++;
  }
  var g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({map:texture, transparent:true, side:THREE.DoubleSide}));
}
function startLine(){
  var c=cvs(256,64), g=c.getContext('2d');
  for(var y=0;y<64;y+=16) for(var x=0;x<256;x+=16){ g.fillStyle=(((x/16)+(y/16))%2)?'#ffffff':'#12161c'; g.fillRect(x,y,16,16); }
  var segs = Math.max(2, Math.round(5/(Track.length/SAMPLES)));
  return roadDecal(0, segs, 0, Track.half, tex(c,4,1), 0.10, false);
}
function pitStallU(k){ return ((0.878 + k*(20/Math.max(900,Track.length))) % 1 + 1) % 1; }
function buildPitComplex(){
  var g=new THREE.Group();
  var N=14;
  var LANE=Track.half+5, STALL=Track.half+11, WALLL=Track.half+15.2, GAR=Track.half+23;
  var concrete=new THREE.MeshLambertMaterial({color:0xb9c0c9});
  var dark    =new THREE.MeshLambertMaterial({color:0x2b323d});
  var steel   =new THREE.MeshLambertMaterial({color:0x8d959f});

  /* --- painted pit road + stall boxes --- */
  for(var k=0;k<N;k++){
    var u=pitStallU(k), i=Track.idxOf(u), p=Track.pts[i], r=Track.rgt[i], f=Track.fwd[i];
    var yaw=-Math.atan2(f.z,f.x)+Math.PI/2;
    var mine=(k===6);
    var bc=cvs(128,256), bg=bc.getContext('2d');
    bg.fillStyle=mine?'#f5c53a':'#e9edf2'; bg.fillRect(0,0,128,256);
    bg.fillStyle=mine?'#2b2000':'#1d232d'; bg.fillRect(8,8,112,240);
    bg.fillStyle=mine?'#f5c53a':'#dfe5ec'; bg.font='900 74px Arial Black, Arial';
    bg.textAlign='center'; bg.textBaseline='middle';
    bg.save(); bg.translate(64,128); bg.rotate(-Math.PI/2);
    bg.fillText(mine?String(Save.num):String(11+k*5),0,0); bg.restore();
    if(mine){ bg.fillStyle='#f5c53a'; bg.font='900 22px Arial'; 
              bg.save(); bg.translate(64,214); bg.rotate(-Math.PI/2); bg.fillText('YOUR BOX',0,0); bg.restore(); }
    var segs2 = Math.max(2, Math.round(15/(Track.length/SAMPLES)));
    var box = roadDecal(u, segs2, STALL, 3.5, tex(bc), 0.10, false);
    box.material.opacity=0.92; g.add(box);

    /* --- equipment beside each stall --- */
    var eq=new THREE.Group();
    for(var t2=0;t2<4;t2++){
      var ty=new THREE.Mesh(new THREE.CylinderGeometry(0.47,0.47,0.38,14), new THREE.MeshLambertMaterial({color:0x1b1f26}));
      ty.position.set(0, 0.2+t2*0.40, 0); eq.add(ty);
    }
    var cart=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.9,0.7), new THREE.MeshLambertMaterial({color:0xd0453c}));
    cart.position.set(2.2,0.45,0); eq.add(cart);
    var bottle=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,1.2,10), new THREE.MeshLambertMaterial({color:0x2f7de0}));
    bottle.position.set(3.4,0.6,0); eq.add(bottle);
    var eqLat=STALL+3.4;
    eq.position.set(p.x+r.x*eqLat, Track.surfaceY(i,eqLat), p.z+r.z*eqLat);
    eq.rotation.y=Math.atan2(-r.x,-r.z); g.add(eq);
  }

  /* --- pit wall with sponsor panels + timing stands --- */
  for(var w=0;w<N+2;w++){
    var uw=pitStallU(w-1), iw=Track.idxOf(uw), pw=Track.pts[iw], rw=Track.rgt[iw], fw2=Track.fwd[iw];
    var seg=new THREE.Group();
    var wallM=new THREE.Mesh(new THREE.BoxGeometry(20.4,1.15,0.45), concrete);
    wallM.position.y=0.575; seg.add(wallM);
    var pan=new THREE.Mesh(new THREE.PlaneGeometry(19.4,0.85), new THREE.MeshBasicMaterial({map:billboardTexture(w+2)}));
    pan.position.set(0,0.60,-0.24); pan.rotation.y=Math.PI; seg.add(pan);
    if(w%3===0){
      var stand=new THREE.Mesh(new THREE.BoxGeometry(4.2,2.6,2.4), dark);
      stand.position.set(0,2.45,1.2); seg.add(stand);
      var scr=new THREE.Mesh(new THREE.PlaneGeometry(3.6,1.6), new THREE.MeshBasicMaterial({color:0x0e1626}));
      scr.position.set(0,2.7,-0.05); scr.rotation.y=Math.PI; seg.add(scr);
    }
    seg.position.set(pw.x+rw.x*WALLL, Track.surfaceY(iw,WALLL), pw.z+rw.z*WALLL);
    seg.rotation.y=-Math.atan2(fw2.z,fw2.x)+Math.PI/2;
    g.add(seg);
  }

  /* --- the garages / sheds behind the pit wall --- */
  var doorC=cvs(256,256), dg=doorC.getContext('2d');
  dg.fillStyle='#c9d1da'; dg.fillRect(0,0,256,256);
  for(var yy=0;yy<256;yy+=14){ dg.fillStyle='#aeb8c4'; dg.fillRect(0,yy,256,3); }
  dg.fillStyle='#8f99a6'; dg.fillRect(0,0,256,18);
  var doorT=tex(doorC);
  for(var s2=0;s2<N;s2++){
    var us=pitStallU(s2), is=Track.idxOf(us), ps=Track.pts[is], rs=Track.rgt[is], fs=Track.fwd[is];
    var sh=new THREE.Group();
    var shell=new THREE.Mesh(new THREE.BoxGeometry(19,6.2,11), new THREE.MeshLambertMaterial({color:0xdfe4ea}));
    shell.position.y=3.1; sh.add(shell);
    var door=new THREE.Mesh(new THREE.PlaneGeometry(12,4.4), new THREE.MeshLambertMaterial({map:doorT}));
    door.position.set(0,2.3,-5.52); door.rotation.y=Math.PI; sh.add(door);
    // number board over the door
    var nb=cvs(256,64), ng2=nb.getContext('2d');
    ng2.fillStyle='#141b26'; ng2.fillRect(0,0,256,64);
    ng2.fillStyle=(s2===6)?'#f5c53a':'#e8edf5'; ng2.font='900 42px Arial Black, Arial';
    ng2.textAlign='center'; ng2.textBaseline='middle';
    ng2.fillText((s2===6?('#'+Save.num+'  YOUR GARAGE'):('GARAGE '+(s2+1))),128,34);
    var board=new THREE.Mesh(new THREE.PlaneGeometry(12,1.5), new THREE.MeshBasicMaterial({map:tex(nb)}));
    board.position.set(0,5.3,-5.55); board.rotation.y=Math.PI; sh.add(board);
    // canopy
    var can=new THREE.Mesh(new THREE.BoxGeometry(19.6,0.35,4.2), new THREE.MeshLambertMaterial({color:0x39424f}));
    can.position.set(0,6.0,-7.4); sh.add(can);
    for(var cp=-1;cp<=1;cp+=2){
      var post=new THREE.Mesh(new THREE.BoxGeometry(0.3,6,0.3), steel);
      post.position.set(cp*8.6,3,-9.2); sh.add(post);
    }
    sh.position.set(ps.x+rs.x*GAR, Track.surfaceY(is,GAR*0.4), ps.z+rs.z*GAR);
    sh.rotation.y=-Math.atan2(fs.z,fs.x)+Math.PI/2;
    g.add(sh);
  }

  /* --- PIT ENTRY / EXIT signage --- */
  function sign(u, label, colour){
    var i2=Track.idxOf(u), p2=Track.pts[i2], r2=Track.rgt[i2], f2=Track.fwd[i2];
    var sc=cvs(512,128), sg=sc.getContext('2d');
    sg.fillStyle=colour; sg.fillRect(0,0,512,128);
    sg.fillStyle='#ffffff'; sg.font='900 62px Arial Black, Arial';
    sg.textAlign='center'; sg.textBaseline='middle'; sg.fillText(label,256,66);
    var grp=new THREE.Group();
    var pl=new THREE.Mesh(new THREE.PlaneGeometry(9,2.25), new THREE.MeshBasicMaterial({map:tex(sc),side:THREE.DoubleSide}));
    pl.position.y=5.4; grp.add(pl);
    for(var q=-1;q<=1;q+=2){
      var po=new THREE.Mesh(new THREE.BoxGeometry(0.28,4.4,0.28), steel);
      po.position.set(q*4.1,2.2,0); grp.add(po);
    }
    var lat2=Track.half+3.0;
    grp.position.set(p2.x+r2.x*lat2, Track.surfaceY(i2,lat2), p2.z+r2.z*lat2);
    grp.rotation.y=Math.atan2(-f2.x,-f2.z);
    g.add(grp);
  }
  sign(0.845,'PIT ENTRY →','#1f7a3d');
  sign(0.862,'SPEED LIMIT 60','#c8992a');
  sign(0.030,'PIT EXIT','#1f7a3d');

  /* --- painted pit entry lane --- */
  var lp=[], li=[], cnt=0;
  for(var n2=0;n2<SAMPLES;n2++){
    var un=n2/SAMPLES; if(Track.pitExtra(un)<0.5) continue;
    var n3=(n2+1)%SAMPLES;
    var pa=Track.pts[n2], ra=Track.rgt[n2], pb=Track.pts[n3], rb=Track.rgt[n3];
    var la=Track.half+2.0, lb=Track.half+2.0;
    lp.push(pa.x+ra.x*(la-0.25), Track.surfaceY(n2,la)+0.09, pa.z+ra.z*(la-0.25),
            pa.x+ra.x*(la+0.25), Track.surfaceY(n2,la)+0.09, pa.z+ra.z*(la+0.25),
            pb.x+rb.x*(lb-0.25), Track.surfaceY(n3,lb)+0.09, pb.z+rb.z*(lb-0.25),
            pb.x+rb.x*(lb+0.25), Track.surfaceY(n3,lb)+0.09, pb.z+rb.z*(lb+0.25));
    var bq=cnt*4; li.push(bq,bq+2,bq+1, bq+1,bq+2,bq+3); cnt++;
  }
  if(cnt){
    var lg=new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp,3)); lg.setIndex(li);
    g.add(new THREE.Mesh(lg, new THREE.MeshBasicMaterial({color:0x3ec8ff, side:THREE.DoubleSide})));
  }
  return g;
}

/* ================= PIT CREW ================= */
var SKIN=[0xf2cfa8,0xe0b184,0xc08a56,0x9a663c,0x7a4a28,0x5a3418];
function limb(len, rTop, rBot, mat){
  var m=new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 8), mat);
  m.position.y=-len/2; return m;
}
function makeCrewman(cfg){
  var suit =new THREE.MeshLambertMaterial({color:cfg.suit});
  var trim =new THREE.MeshLambertMaterial({color:cfg.trim});
  var glove=new THREE.MeshLambertMaterial({color:0x14181f});
  var boot =new THREE.MeshLambertMaterial({color:0x0e1116});
  var skin =new THREE.MeshLambertMaterial({color:cfg.skin});
  var hel  =new THREE.MeshPhongMaterial({color:cfg.helmet, shininess:110, specular:0xffffff});
  var vis  =new THREE.MeshPhongMaterial({color:0x0b0f16, shininess:180, specular:0xaabbcc,
                                         transparent:true, opacity:0.86});
  var g=new THREE.Group();
  var body=new THREE.Group(); g.add(body);

  /* legs with knees */
  var legs={};
  [['l',-1],['r',1]].forEach(function(sd){
    var hip=new THREE.Group(); hip.position.set(sd[1]*0.105, 0.92, 0);
    hip.add(limb(0.44,0.085,0.072,suit));
    var knee=new THREE.Group(); knee.position.y=-0.44;
    knee.add(limb(0.42,0.070,0.058,suit));
    var kp=new THREE.Mesh(new THREE.SphereGeometry(0.075,8,6), trim); kp.position.y=0.01; kp.scale.z=0.75; knee.add(kp);
    var bt=new THREE.Mesh(new THREE.BoxGeometry(0.125,0.095,0.265), boot);
    bt.position.set(0,-0.44,0.045); knee.add(bt);
    hip.add(knee); body.add(hip);
    legs[sd[0]]={hip:hip, knee:knee};
  });

  /* hips + torso */
  var hips=new THREE.Mesh(new THREE.CylinderGeometry(0.165,0.155,0.20,10), suit);
  hips.position.y=1.00; hips.scale.z=0.74; body.add(hips);
  var belt=new THREE.Mesh(new THREE.CylinderGeometry(0.168,0.168,0.055,10), trim);
  belt.position.y=1.075; belt.scale.z=0.76; body.add(belt);
  var torso=new THREE.Mesh(new THREE.CylinderGeometry(0.205,0.163,0.42,10), suit);
  torso.position.y=1.30; torso.scale.z=0.70; body.add(torso);
  var collar=new THREE.Mesh(new THREE.CylinderGeometry(0.115,0.155,0.10,10), trim);
  collar.position.y=1.545; collar.scale.z=0.78; body.add(collar);
  // shoulder caps
  [-1,1].forEach(function(sx){
    var sh=new THREE.Mesh(new THREE.SphereGeometry(0.098,10,8), suit);
    sh.position.set(sx*0.205,1.475,0); sh.scale.z=0.82; body.add(sh);
  });
  // number patch on the back
  var pc=cvs(64,64), pg=pc.getContext('2d');
  pg.fillStyle='#'+new THREE.Color(cfg.trim).getHexString(); pg.fillRect(0,0,64,64);
  pg.fillStyle='#ffffff'; pg.font='900 44px Arial Black, Arial';
  pg.textAlign='center'; pg.textBaseline='middle'; pg.fillText(String(cfg.num||7),32,36);
  var patch=new THREE.Mesh(new THREE.PlaneGeometry(0.19,0.19), new THREE.MeshBasicMaterial({map:tex(pc)}));
  patch.position.set(0,1.32,-0.152); patch.rotation.y=Math.PI; body.add(patch);

  /* head + helmet */
  var headG=new THREE.Group(); headG.position.y=1.585; body.add(headG);
  var neck=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.062,0.08,8), skin);
  neck.position.y=-0.015; headG.add(neck);
  var head=new THREE.Mesh(new THREE.SphereGeometry(0.105,12,10), skin);
  head.position.y=0.085; head.scale.set(0.92,1.06,0.95); headG.add(head);
  var helmet=new THREE.Mesh(new THREE.SphereGeometry(0.142,14,12), hel);
  helmet.position.y=0.092; helmet.scale.set(1,1.02,1.04); headG.add(helmet);
  var stripe=new THREE.Mesh(new THREE.SphereGeometry(0.144,14,12), new THREE.MeshPhongMaterial({color:cfg.trim,shininess:100}));
  stripe.position.y=0.092; stripe.scale.set(0.28,1.03,1.05); headG.add(stripe);
  var visor=new THREE.Mesh(new THREE.SphereGeometry(0.148,14,10,-0.95,1.90,0.75,0.62), vis);
  visor.position.y=0.088; headG.add(visor);

  /* arms with elbows */
  var arms={};
  [['l',-1],['r',1]].forEach(function(sd){
    var sh=new THREE.Group(); sh.position.set(sd[1]*0.215, 1.455, 0);
    sh.add(limb(0.30,0.072,0.060,suit));
    var el=new THREE.Group(); el.position.y=-0.30;
    el.add(limb(0.28,0.058,0.050,suit));
    var cuff=new THREE.Mesh(new THREE.CylinderGeometry(0.062,0.062,0.05,8), trim);
    cuff.position.y=-0.245; el.add(cuff);
    var hand=new THREE.Group(); hand.position.y=-0.285; el.add(hand);
    var gl=new THREE.Mesh(new THREE.BoxGeometry(0.085,0.115,0.075), glove); hand.add(gl);
    sh.add(el); body.add(sh);
    arms[sd[0]]={sh:sh, el:el, hand:hand};
  });

  /* the tool this one carries */
  var prop=null;
  if (cfg.prop==='gun'){
    prop=new THREE.Group();
    var gb=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.048,0.26,10), new THREE.MeshPhongMaterial({color:0xd8dde4,shininess:120}));
    gb.rotation.x=Math.PI/2; prop.add(gb);
    var sock=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.15,8), new THREE.MeshPhongMaterial({color:0x2b3038,shininess:80}));
    sock.rotation.x=Math.PI/2; sock.position.z=0.19; prop.add(sock);
    var grip=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.14,0.06), new THREE.MeshLambertMaterial({color:0xd0453c}));
    grip.position.set(0,-0.10,-0.05); prop.add(grip);
    var hose=new THREE.Mesh(new THREE.CylinderGeometry(0.022,0.022,0.5,6), new THREE.MeshLambertMaterial({color:0x1b1f26}));
    hose.rotation.x=0.5; hose.position.set(0,-0.16,-0.30); prop.add(hose);
    prop.userData.socket=sock;
    arms.r.hand.add(prop); prop.position.set(0,-0.06,0.10);
  } else if (cfg.prop==='wheel'){
    prop=new THREE.Group();
    var tw=new THREE.Mesh(new THREE.CylinderGeometry(0.47,0.47,0.38,16), new THREE.MeshLambertMaterial({color:0x1b1f26}));
    tw.rotation.x=Math.PI/2; prop.add(tw);
    var rm2=new THREE.Mesh(new THREE.CylinderGeometry(0.29,0.29,0.40,12), new THREE.MeshPhongMaterial({color:0xd0d6de,shininess:150}));
    rm2.rotation.x=Math.PI/2; prop.add(rm2);
    body.add(prop); prop.position.set(0.34,0.95,0.30);
  } else if (cfg.prop==='jack'){
    prop=new THREE.Group();
    var jb=new THREE.Mesh(new THREE.BoxGeometry(0.30,0.13,0.72), new THREE.MeshLambertMaterial({color:0xd0453c}));
    prop.add(jb);
    var handle=new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,1.30,8), new THREE.MeshPhongMaterial({color:0xb8bfc8,shininess:120}));
    handle.rotation.x=-1.05; handle.position.set(0,0.42,-0.62); prop.add(handle);
    var wheelL=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.05,10), new THREE.MeshLambertMaterial({color:0x22272f}));
    wheelL.rotation.z=Math.PI/2; wheelL.position.set(0.16,-0.07,0.28); prop.add(wheelL);
    var wheelR=wheelL.clone(); wheelR.position.x=-0.16; prop.add(wheelR);
    body.add(prop); prop.position.set(0,0.14,0.55);
  } else if (cfg.prop==='fuel'){
    prop=new THREE.Group();
    var can=new THREE.Mesh(new THREE.BoxGeometry(0.36,0.66,0.34), new THREE.MeshLambertMaterial({color:0xc23a2f}));
    prop.add(can);
    var cap=new THREE.Mesh(new THREE.CylinderGeometry(0.07,0.07,0.10,8), new THREE.MeshLambertMaterial({color:0x2b3038}));
    cap.position.y=0.36; prop.add(cap);
    var spout=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,0.5,8), new THREE.MeshLambertMaterial({color:0x3a4350}));
    spout.rotation.x=1.15; spout.position.set(0,0.18,0.30); prop.add(spout);
    var strap=new THREE.Mesh(new THREE.BoxGeometry(0.38,0.06,0.36), new THREE.MeshLambertMaterial({color:0x2b3038}));
    strap.position.y=0.12; prop.add(strap);
    body.add(prop); prop.position.set(0.30,1.00,0.34);
  }

  g.userData={body:body, legs:legs, arms:arms, head:headG, prop:prop};
  return g;
}
var PitCrew = {
  group:null, men:[], chief:null, active:false, spare:null,
  build:function(){
    if(this.group) scene.remove(this.group);
    this.group=new THREE.Group(); this.group.visible=false; scene.add(this.group);
    this.men=[];
    var paint=PAINTS[Save.paint].c;
    var team=new THREE.Color(paint).getHex();
    var roles=[
      {k:'tyreF', off:[ 1.62, 1.55], prop:'gun',   crouch:0.44, helmet:0xf2f4f7},
      {k:'tyreR', off:[ 1.62,-1.55], prop:'gun',   crouch:0.44, helmet:0xf2f4f7},
      {k:'carry', off:[ 2.30, 0.55], prop:'wheel', crouch:0.16, helmet:0xf2c53a},
      {k:'jack',  off:[ 1.55,-0.20], prop:'jack',  crouch:0.10, helmet:0xd0453c},
      {k:'fuel',  off:[ 0.75,-3.00], prop:'fuel',  crouch:0.00, helmet:0xd0453c}
    ];
    for(var i=0;i<roles.length;i++){
      var m=makeCrewman({suit:team, trim:0x11161f, helmet:roles[i].helmet,
                         skin:SKIN[(i*2+1)%SKIN.length], prop:roles[i].prop, num:Save.num});
      m.userData.role=roles[i];
      this.group.add(m); this.men.push(m);
    }
    this.spare=new THREE.Group();
    var st=new THREE.Mesh(new THREE.CylinderGeometry(0.47,0.47,0.38,16), new THREE.MeshLambertMaterial({color:0x1b1f26}));
    st.rotation.z=Math.PI/2; this.spare.add(st);
    this.group.add(this.spare);
  },
  start:function(){
    if(this.active) return;                    // already out over the wall
    if(!this.group) this.build();
    this.group.visible=true; this.active=true;
  },
  stop:function(car){
    this.active=false;
    if(this.group) this.group.visible=false;
    if(car){ car.pitLift=0; PitCrew.resetWheels(car); }
  },
  resetWheels:function(car){
    var ws=car.mesh.userData.wheels, base=car.mesh.userData.wheelBase;
    if(!ws||!base) return;
    for(var i=0;i<4;i++){ ws[i].position.set(base[i][0],base[i][1],base[i][2]); ws[i].visible=true; }
  },
  update:function(dt, car, p){
    if(!this.active||!this.group) return;
    var fx=Math.sin(car.h), fz=Math.cos(car.h), rx=-fz, rz=fx;
    var bx=car.x, by=car.y, bz=car.z;
    var io = p<0.15 ? p/0.15 : (p>0.85 ? (1-p)/0.15 : 1);
    io = Math.max(0, Math.min(1, io));
    var running = (p<0.15 || p>0.85);
    var t=performance.now()*0.001;
    for(var i=0;i<this.men.length;i++){
      var m=this.men[i], R=m.userData.role, U=m.userData;
      var ox=R.off[0]*io + 5.6*(1-io), oz=R.off[1]*io;
      m.position.set(bx + rx*ox + fx*oz, by, bz + rz*ox + fz*oz);
      m.rotation.y=Math.atan2(-rx,-rz);
      if(running){
        var w=t*11;
        U.body.position.y=Math.abs(Math.sin(w))*0.045;
        U.body.rotation.x=0.16;
        U.legs.l.hip.rotation.x=Math.sin(w)*0.95;  U.legs.l.knee.rotation.x=-Math.max(0,Math.sin(w+1.4))*1.15;
        U.legs.r.hip.rotation.x=-Math.sin(w)*0.95; U.legs.r.knee.rotation.x=-Math.max(0,Math.sin(w+1.4+Math.PI))*1.15;
        U.arms.l.sh.rotation.x=-Math.sin(w)*0.85;  U.arms.l.el.rotation.x=-0.95;
        U.arms.r.sh.rotation.x= Math.sin(w)*0.85;  U.arms.r.el.rotation.x=-0.95;
        U.head.rotation.x=-0.10;
      } else {
        // down on the job
        U.body.position.y=-R.crouch;
        U.body.rotation.x=R.crouch>0.3?0.52:(R.crouch>0.05?0.28:0.10);
        U.legs.l.hip.rotation.x=R.crouch>0.3?-0.95:-0.30; U.legs.l.knee.rotation.x=R.crouch>0.3?1.45:0.5;
        U.legs.r.hip.rotation.x=R.crouch>0.3?-0.55:-0.15; U.legs.r.knee.rotation.x=R.crouch>0.3?1.05:0.3;
        U.head.rotation.x=0.30;
        if(R.prop==='gun'){
          var spin=(p>0.26&&p<0.62)?1:0;
          U.arms.l.sh.rotation.x=-1.15; U.arms.l.el.rotation.x=-0.55;
          U.arms.r.sh.rotation.x=-1.30+Math.sin(t*20)*0.05*spin; U.arms.r.el.rotation.x=-0.45;
          if(U.prop&&U.prop.userData.socket) U.prop.userData.socket.rotation.y+=spin*dt*45;
        } else if(R.prop==='jack'){
          var pump=Math.sin(t*7)*0.30;
          U.arms.l.sh.rotation.x=-0.85+pump; U.arms.l.el.rotation.x=-0.65;
          U.arms.r.sh.rotation.x=-0.85+pump; U.arms.r.el.rotation.x=-0.65;
        } else if(R.prop==='fuel'){
          U.arms.l.sh.rotation.x=-2.05; U.arms.l.el.rotation.x=-0.35;
          U.arms.r.sh.rotation.x=-1.85; U.arms.r.el.rotation.x=-0.55;
          U.body.rotation.x=-0.12;
        } else {
          var lift=(p>0.30&&p<0.60)?-1.55:-0.70;
          U.arms.l.sh.rotation.x=lift; U.arms.l.el.rotation.x=-0.40;
          U.arms.r.sh.rotation.x=lift; U.arms.r.el.rotation.x=-0.40;
        }
      }
    }
    // jack lifts the car
    var lift=(p>0.22 && p<0.78)?0.13:0;
    car.pitLift += (lift-car.pitLift)*Math.min(1, dt*7);
    // wheels come off and go back on
    var ws=car.mesh.userData.wheels, wb=car.mesh.userData.wheelBase;
    if(ws&&wb){
      var off=(p>0.26 && p<0.62);
      var chg=[0,2];
      for(var q=0;q<chg.length;q++){
        var w2=ws[chg[q]], b2=wb[chg[q]];
        if(off){ w2.position.set(b2[0]-0.55, b2[1]-0.10, b2[2]); w2.visible=!(p>0.36&&p<0.50); }
        else   { w2.position.set(b2[0],b2[1],b2[2]); w2.visible=true; }
      }
      this.spare.visible=(p>0.30&&p<0.58);
      this.spare.position.set(bx+rx*2.30, by+0.47, bz+rz*2.30);
    }
  }
};
function wall(side, t){
  var grp=new THREE.Group(), n=SAMPLES, H=3.4;
  var pos=[], idx=[], uv=[], cnt=0;
  for(var i=0;i<n;i++){
    var i2=(i+1)%n;
    var lat1 = side<0 ? -Track.half-0.2 : Track.halfR[i]+0.2;
    var lat2 = side<0 ? -Track.half-0.2 : Track.halfR[i2]+0.2;
    var p1=Track.pts[i], r1=Track.rgt[i], p2=Track.pts[i2], r2=Track.rgt[i2];
    var y1=Track.surfaceY(i,lat1)-2.2, y2=Track.surfaceY(i2,lat2)-2.2;   // skirt below the verge
    pos.push(p1.x+r1.x*lat1, y1,       p1.z+r1.z*lat1,
             p1.x+r1.x*lat1, y1+H+2.2, p1.z+r1.z*lat1,
             p2.x+r2.x*lat2, y2,       p2.z+r2.z*lat2,
             p2.x+r2.x*lat2, y2+H+2.2, p2.z+r2.z*lat2);
    var v1=Track.cum[i]/26, v2=Track.cum[i2]/26;
    uv.push(v1,-0.6, v1,1, v2,-0.6, v2,1);
    var b=cnt*4;
    if(side<0) idx.push(b,b+1,b+2, b+1,b+3,b+2);
    else       idx.push(b,b+2,b+1, b+1,b+2,b+3);
    cnt++;
  }
  var geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(idx); geo.computeVertexNormals();
  grp.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({map:wallTexture(), side:THREE.DoubleSide})));
  return grp;
}
function wallTexture(){
  var c=cvs(512,128), g=c.getContext('2d');
  g.fillStyle='#e9edf2'; g.fillRect(0,0,512,128);
  g.fillStyle='#d3d9e0'; g.fillRect(0,0,512,16); g.fillRect(0,112,512,16);
  var names=["VOLT FUEL","REDLINE","APEX BANK","NOVA COLA","ZENITH OIL","TITAN","MACH-9","OFFLINEGAMES.ART"];
  for(var i=0;i<4;i++){
    var col=SPONSOR_COLORS[i%SPONSOR_COLORS.length];
    g.fillStyle='#'+('000000'+col.toString(16)).slice(-6);
    g.fillRect(i*128+4, 20, 120, 88);
    g.fillStyle='#fff'; g.textAlign='center'; g.textBaseline='middle'; g.font='bold 17px Arial Black, Arial';
    g.fillText(names[i%names.length], i*128+64, 64);
  }
  return tex(c, 46, 1);
}

/* ---------------- trackside placement safety ---------------- */
/* A straight box placed alongside a CURVED circuit can cut across the road
   further round. Reject any position whose footprint comes near the track. */
function boxClearOfTrack(i, lat, len, depth, front, clearance){
  var p=Track.pts[i], r=Track.rgt[i], f=Track.fwd[i];
  var sgn = lat>=0 ? 1 : -1;
  var cx=p.x+r.x*lat, cz=p.z+r.z*lat;
  var ax=f.x, az=f.z;              // along the track
  var bx=-r.x*sgn, bz=-r.z*sgn;    // toward the track
  var reach=(len/2+depth+clearance+10); reach*=reach;
  for(var j=0;j<SAMPLES;j+=2){
    var q=Track.pts[j];
    var vx=q.x-cx, vz=q.z-cz;
    if(vx*vx+vz*vz > reach) continue;
    var a=vx*ax+vz*az, b=vx*bx+vz*bz;
    var da=Math.max(Math.abs(a)-len/2, 0);
    var db=Math.max(Math.max(-depth-b, b-front), 0);
    if(da*da+db*db < clearance*clearance) return false;
  }
  return true;
}
/* pick positions around the lap that are clear, spread as evenly as possible */
function clearPositions(count, latFn, len, depth, front, clearance){
  var cand=[], TRY=150;
  for(var k=0;k<TRY;k++){
    var u=k/TRY, i=Track.idxOf(u);
    if(boxClearOfTrack(i, latFn(i), len, depth, front, clearance)) cand.push({u:u,i:i});
  }
  if(!cand.length) return [];
  var out=[], step=cand.length/count;
  for(var m=0;m<count;m++) out.push(cand[Math.min(cand.length-1, Math.floor(m*step))]);
  var seen={}, uniq=[];
  out.forEach(function(c){ if(!seen[c.i]){ seen[c.i]=1; uniq.push(c); } });
  return uniq;
}

/* ---------------- grandstands & living crowd ---------------- */
var crowdMats = [];
function crowdShaderMaterial(night){
  return new THREE.ShaderMaterial({
    uniforms:{ map:{value:crowdTexture()}, time:{value:0}, night:{value:night?1:0} },
    vertexShader:'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader:[
      'uniform sampler2D map; uniform float time; uniform float night; varying vec2 vUv;',
      'float h1(float n){ return fract(sin(n*12.9898)*43758.5453); }',
      'void main(){',
      '  float col = floor(vUv.x*420.0);',
      '  float ph  = h1(col)*6.2832;',
      // every spectator bobs on their own beat
      '  float bob = sin(time*5.5 + ph)*0.0075;',
      // and a mexican wave rolls along the stand
      '  float wave = sin(vUv.x*7.0 - time*1.6);',
      '  bob += max(0.0, wave-0.55)*0.075;',
      '  vec2 uv = vec2(vUv.x, clamp(vUv.y + bob, 0.001, 0.999));',
      '  vec3 c = texture2D(map, uv).rgb;',
      // arms up on the wave read as a brightness lift
      '  c *= 0.84 + 0.30*h1(col + floor(time*2.4));',
      '  c *= 1.0 + max(0.0, wave-0.55)*0.9;',
      // camera flashes after dark
      '  if(night>0.5){',
      '    float f = h1(col*3.1 + floor(time*9.0));',
      '    if(f>0.994) c += vec3(1.6);',
      '    c *= 0.62;',
      '  }',
      '  gl_FragColor = vec4(c,1.0);',
      '}'].join('\n')
  });
}
function buildGrandstands(t, env, tod){
  var q=QUAL(), count = q>1?13:(q>0?9:6);
  var LEN=96, DEP=28, OFFSET=24;
  var sgnG = Track.outward;
  var spots = clearPositions(count,
    function(i){ return sgnG>0 ? (Track.halfR[i]+OFFSET) : -(Track.half+OFFSET); },
    LEN, DEP, 4, Track.half+9);
  var struct = new THREE.MeshLambertMaterial({color:0xa2acba});
  var deck   = new THREE.MeshLambertMaterial({color:0x6e7886});
  var roofM  = new THREE.MeshLambertMaterial({color:0x252d3b});
  for(var s=0;s<spots.length;s++){
    var i = spots[s].i;
    var p = Track.pts[i], r = Track.rgt[i];
    var sgn = sgnG;
    var lat = sgn>0 ? (Track.halfR[i]+OFFSET) : -(Track.half+OFFSET);
    var HGT = 21;

    var g = new THREE.Group();
    // substructure
    var base = new THREE.Mesh(new THREE.BoxGeometry(LEN,2.6,DEP), deck);
    base.position.set(0,1.3,-DEP/2+3); g.add(base);
    // raked seating with the animated crowd on it
    var cm = crowdShaderMaterial(!!tod.night);
    crowdMats.push(cm);
    var seat = new THREE.Mesh(new THREE.PlaneGeometry(LEN,29), cm);
    seat.rotation.x = -Math.PI/2 + 0.66;
    seat.position.set(0, 11.4, -10.2);
    g.add(seat);
    // front safety rail
    var rail = new THREE.Mesh(new THREE.BoxGeometry(LEN,0.9,0.5), struct);
    rail.position.set(0,3.1,2.4); g.add(rail);
    // back wall + roof
    var back = new THREE.Mesh(new THREE.BoxGeometry(LEN,HGT,1.4), struct);
    back.position.set(0,HGT/2,-DEP+2); g.add(back);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(LEN+8,1.3,DEP+6), roofM);
    roof.position.set(0,HGT+2.4,-DEP/2+3); g.add(roof);
    for(var c2=-2;c2<=2;c2++){
      var pl=new THREE.Mesh(new THREE.BoxGeometry(1.5,HGT+2,1.5), struct);
      pl.position.set(c2*(LEN/2-6)*0.5, (HGT+2)/2, -DEP+3); g.add(pl);
    }
    // sponsor fascia facing the track
    var fas=new THREE.Mesh(new THREE.PlaneGeometry(LEN,3.0), new THREE.MeshBasicMaterial({map:billboardTexture(s+5)}));
    fas.position.set(0,1.6,2.8); g.add(fas);
    var top=new THREE.Mesh(new THREE.PlaneGeometry(LEN+6,4.2), new THREE.MeshBasicMaterial({map:billboardTexture(s+11)}));
    top.position.set(0,HGT+4.6,-DEP/2+6.2); g.add(top);

    g.position.set(p.x + r.x*lat, Track.surfaceY(i, lat*0.7), p.z + r.z*lat);
    var dx = -r.x*sgn, dz = -r.z*sgn;             // face the racing surface
    g.rotation.y = Math.atan2(dx, dz);
    g.name='GRANDSTAND';
    worldGroup.add(g);
  }
}
/* ---------------- catch fencing over the outside wall ---------------- */
function buildCatchFence(t){
  var sgn = Track.outward, n = SAMPLES, H = 3.4, FH = 6.6;
  var c=cvs(64,64), gg=c.getContext('2d');
  gg.clearRect(0,0,64,64);
  gg.strokeStyle='rgba(196,206,220,0.95)'; gg.lineWidth=4;
  for(var k=0;k<=64;k+=16){ gg.beginPath(); gg.moveTo(k,0); gg.lineTo(k,64); gg.moveTo(0,k); gg.lineTo(64,k); gg.stroke(); }
  var ft=tex(c, 220, 3);
  var pos=[], uv=[], idx=[], cnt=0;
  for(var i=0;i<n;i++){
    var i2=(i+1)%n;
    var l1 = sgn>0 ? Track.halfR[i]+0.2 : -(Track.half+0.2);
    var l2 = sgn>0 ? Track.halfR[i2]+0.2 : -(Track.half+0.2);
    var p1=Track.pts[i], r1=Track.rgt[i], p2=Track.pts[i2], r2=Track.rgt[i2];
    var y1=Track.surfaceY(i,l1)+H, y2=Track.surfaceY(i2,l2)+H;
    pos.push(p1.x+r1.x*l1, y1,    p1.z+r1.z*l1,
             p1.x+r1.x*l1, y1+FH, p1.z+r1.z*l1,
             p2.x+r2.x*l2, y2,    p2.z+r2.z*l2,
             p2.x+r2.x*l2, y2+FH, p2.z+r2.z*l2);
    var v1=Track.cum[i]/9, v2=Track.cum[i2]/9;
    uv.push(v1,0, v1,1, v2,0, v2,1);
    var b=cnt*4; idx.push(b,b+2,b+1, b+1,b+2,b+3); cnt++;
  }
  var geo=new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  geo.setIndex(idx); geo.computeVertexNormals();
  worldGroup.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map:ft, transparent:true, opacity:0.55,
    side:THREE.DoubleSide, depthWrite:false})));
  // fence posts
  var postM=new THREE.MeshLambertMaterial({color:0x767f8c});
  var step=Math.max(6, Math.floor(n/110));
  var pg=new THREE.BoxGeometry(0.22,FH+0.6,0.22);
  var inst=new THREE.InstancedMesh(pg, postM, Math.floor(n/step)+1);
  var m4=new THREE.Matrix4(), q4=new THREE.Quaternion(), sc=new THREE.Vector3(1,1,1), pv=new THREE.Vector3(), cc=0;
  for(var j=0;j<n;j+=step){
    var lj = sgn>0 ? Track.halfR[j]+0.2 : -(Track.half+0.2);
    var pj=Track.pts[j], rj=Track.rgt[j];
    pv.set(pj.x+rj.x*lj, Track.surfaceY(j,lj)+H+FH/2, pj.z+rj.z*lj);
    m4.compose(pv,q4,sc); inst.setMatrixAt(cc++, m4);
  }
  inst.count=cc; worldGroup.add(inst);
}
/* ---------------- trackside billboards ---------------- */
function buildBillboards(t){
  var q=QUAL(), count = q>1?24:(q>0?16:10);
  for(var s=0;s<count;s++){
    var u=(s/count + 0.017)%1, i=Track.idxOf(u);
    if (Track.pitExtra(u)>2 && s%2===1) continue;
    var side = (s%2===0)?-1:1;
    if (Track.pitExtra(u)>2) side=-1;
    var p=Track.pts[i], r=Track.rgt[i], f=Track.fwd[i];
    var lat = side<0 ? -(Track.half+3.4) : (Track.halfR[i]+3.4);
    var w=17,h=6.2;
    var m=new THREE.Mesh(new THREE.PlaneGeometry(w,h), new THREE.MeshBasicMaterial({map:billboardTexture(s), side:THREE.DoubleSide}));
    var g=new THREE.Group();
    g.add(m); m.position.y=h/2+3.6;
    var post=new THREE.MeshLambertMaterial({color:0x4a5364});
    for(var k=-1;k<=1;k+=2){
      var po=new THREE.Mesh(new THREE.BoxGeometry(0.5,4.2,0.5),post);
      po.position.set(k*w*0.36,2.1,0); g.add(po);
    }
    g.position.set(p.x+r.x*lat, Track.surfaceY(i,lat*0.9), p.z+r.z*lat);
    g.lookAt(p.x, g.position.y+h/2+3.6, p.z);
    g.name='BILLBOARD';
    worldGroup.add(g);
  }
}
/* ---------------- start/finish gantry ---------------- */
function buildStartGantry(){
  var i=0, p=Track.pts[0], r=Track.rgt[0], f=Track.fwd[0];
  var g=new THREE.Group();
  var W=Track.half*2+8;
  var steel=new THREE.MeshLambertMaterial({color:0x3a4356});
  var beam=new THREE.Mesh(new THREE.BoxGeometry(W,1.6,2.4),steel); beam.position.y=10.4; g.add(beam);
  for(var k=-1;k<=1;k+=2){
    var col=new THREE.Mesh(new THREE.BoxGeometry(1.6,11,1.6),steel); col.position.set(k*W/2,5.5,0); g.add(col);
  }
  var c=cvs(1024,128), gg=c.getContext('2d');
  gg.fillStyle='#0d1220'; gg.fillRect(0,0,1024,128);
  gg.fillStyle='#ffd45e'; gg.font='bold 74px Arial Black, Arial'; gg.textAlign='center'; gg.textBaseline='middle';
  gg.fillText('THUNDER CIRCUIT', 512, 62);
  gg.fillStyle='#7f8ca6'; gg.font='bold 26px Arial'; gg.fillText('OFFLINEGAMES.ART', 512, 108);
  var sign=new THREE.Mesh(new THREE.PlaneGeometry(W-2,4.6), new THREE.MeshBasicMaterial({map:tex(c), side:THREE.DoubleSide}));
  sign.position.set(0,13.2,0); g.add(sign);
  // start lights
  for(var L=0;L<5;L++){
    var lm=new THREE.Mesh(new THREE.SphereGeometry(0.72,10,8), new THREE.MeshBasicMaterial({color:0x330000}));
    lm.position.set((L-2)*3.0, 8.6, 1.4); lm.name='startlight'+L; g.add(lm);
    startLights.push(lm);
  }
  g.position.set(p.x, Track.surfaceY(0,0), p.z);
  g.rotation.y = -Math.atan2(f.z,f.x) + Math.PI/2;
  worldGroup.add(g);
}
var startLights=[];

/* ---------------- vegetation / rocks ---------------- */
function buildScenery(t, env, tod){
  var q=QUAL(), rnd=RNG(t.seed*13+5);
  var treeN = Math.floor((q>1?520:260)*env.trees);
  var rockN = Math.floor((q>1?260:120)*env.rocks);
  var pool = [];
  function place(minD, maxD){
    for(var tries=0;tries<24;tries++){
      var i=(rnd()*SAMPLES)|0, p=Track.pts[i], r=Track.rgt[i];
      var side=rnd()<0.5?-1:1;
      var d = minD + rnd()*(maxD-minD);
      var x=p.x + r.x*side*d + (rnd()-0.5)*40, z=p.z + r.z*side*d + (rnd()-0.5)*40;
      var loc = Track.locate(x,z,null);
      if (Math.abs(loc.lat) > Track.half+26) return {x:x,z:z,y:Terrain.h(x,z)-0.15};
    }
    return null;
  }
  if (treeN>0){
    var trunkG=new THREE.CylinderGeometry(0.55,0.8,4.5,5);
    var leafG = (env===ENV.forest||env===ENV.hills||env===ENV.swamp) ? new THREE.ConeGeometry(3.2,10,6) : new THREE.SphereGeometry(3.0,6,5);
    var trunkM=new THREE.MeshLambertMaterial({color:0x503620});
    var leafM=new THREE.MeshLambertMaterial({color:env===ENV.snow?0x2f4a3a:(env===ENV.savanna?0x7a8b3e:0x2f5e2a)});
    var it=new THREE.InstancedMesh(trunkG,trunkM,treeN), il=new THREE.InstancedMesh(leafG,leafM,treeN);
    var m4=new THREE.Matrix4(), q4=new THREE.Quaternion(), sc=new THREE.Vector3(), pv=new THREE.Vector3(); var placed=0;
    for(var i2=0;i2<treeN;i2++){
      var pt=place(38,520); if(!pt) continue;
      var s=0.7+rnd()*1.5;
      pv.set(pt.x,pt.y+2.2*s,pt.z); sc.set(s,s,s);
      q4.setFromAxisAngle(new THREE.Vector3(0,1,0), rnd()*6.28);
      m4.compose(pv,q4,sc); it.setMatrixAt(placed,m4);
      pv.set(pt.x,pt.y+(4.5+4.4)*s,pt.z);
      m4.compose(pv,q4,sc); il.setMatrixAt(placed,m4);
      placed++;
    }
    it.count=placed; il.count=placed; worldGroup.add(it); worldGroup.add(il);
  }
  if (rockN>0){
    var rgeo=new THREE.DodecahedronGeometry(2.4,0);
    var rmat=new THREE.MeshLambertMaterial({color:env===ENV.volcanic?0x2b2726:0x8a7f6d, flatShading:true});
    var ir=new THREE.InstancedMesh(rgeo,rmat,rockN);
    var mm=new THREE.Matrix4(), qq=new THREE.Quaternion(), ss=new THREE.Vector3(), pp=new THREE.Vector3(); var pl=0;
    for(var j=0;j<rockN;j++){
      var pt2=place(34,600); if(!pt2) continue;
      var s2=0.6+rnd()*2.6;
      pp.set(pt2.x,pt2.y+s2,pt2.z); ss.set(s2,s2*0.75,s2*1.1);
      qq.setFromEuler(new THREE.Euler(rnd()*3,rnd()*6.28,rnd()*3));
      mm.compose(pp,qq,ss); ir.setMatrixAt(pl,mm); pl++;
    }
    ir.count=pl; worldGroup.add(ir);
  }
}
/* ---------------- skyline / city ---------------- */
function buildCity(t, env, tod){
  var q=QUAL(), rnd=RNG(t.seed*29+7);
  var n = Math.floor((q>1?190:110) * (0.4+env.city));
  var wt = windowTexture(!!tod.night);
  var mat = new THREE.MeshLambertMaterial({map:wt, color:0xffffff});
  var geo = new THREE.BoxGeometry(1,1,1);
  var inst = new THREE.InstancedMesh(geo, mat, n);
  var m4=new THREE.Matrix4(), q4=new THREE.Quaternion(), sc=new THREE.Vector3(), pv=new THREE.Vector3();
  var placed=0;
  for(var i=0;i<n;i++){
    var ang=rnd()*6.28, dist=340+rnd()*1500;
    var x=Math.cos(ang)*dist, z=Math.sin(ang)*dist;
    var loc=Track.locate(x,z,null);
    if (Math.abs(loc.lat) < Track.half+120) continue;
    var w=22+rnd()*40, d=22+rnd()*40, h=40+Math.pow(rnd(),1.8)*300;
    pv.set(x, Terrain.h(x,z)+h/2-1, z); sc.set(w,h,d);
    q4.setFromAxisAngle(new THREE.Vector3(0,1,0), (rnd()*4|0)*0.7854);
    m4.compose(pv,q4,sc); inst.setMatrixAt(placed++,m4);
  }
  inst.count=placed; worldGroup.add(inst);
  // a few rooftop beacons at night
  if (tod.night){
    var bg=new THREE.SphereGeometry(2.2,6,5), bm=new THREE.MeshBasicMaterial({color:0xff3b30});
    var bi=new THREE.InstancedMesh(bg,bm,20), mm=new THREE.Matrix4();
    for(var k=0;k<20;k++){
      var a2=rnd()*6.28, d2=420+rnd()*1200;
      mm.makeTranslation(Math.cos(a2)*d2, 150+rnd()*220, Math.sin(a2)*d2);
      bi.setMatrixAt(k,mm);
    }
    worldGroup.add(bi);
  }
}
/* ---------------- night flood lights ---------------- */
function buildTrackLights(t){
  var count=18, poleM=new THREE.MeshLambertMaterial({color:0x39414f});
  var lampM=new THREE.MeshBasicMaterial({color:0xfff3d0});
  for(var s=0;s<count;s++){
    var u=(s/count+0.005)%1, i=Track.idxOf(u);
    var p=Track.pts[i], r=Track.rgt[i];
    var side=(s%2)?1:-1;
    var lat = side<0 ? -(Track.half+16) : (Track.halfR[i]+16);
    var g=new THREE.Group();
    var pole=new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.8,34,6),poleM); pole.position.y=17; g.add(pole);
    var head=new THREE.Mesh(new THREE.BoxGeometry(7,2.2,1.4),poleM); head.position.y=34.4; g.add(head);
    var lamp=new THREE.Mesh(new THREE.BoxGeometry(6.4,1.4,1.0),lampM); lamp.position.set(0,33.6,0.2); g.add(lamp);
    g.position.set(p.x+r.x*lat, Track.surfaceY(i,lat*0.8), p.z+r.z*lat);
    g.name='LIGHTPOLE';
    worldGroup.add(g);
    if (s%3===0){
      var pt=new THREE.PointLight(0xfff0c8, 0.7, 190, 2);
      pt.position.set(p.x+r.x*lat*0.55, 30, p.z+r.z*lat*0.55);
      worldGroup.add(pt);
    }
  }
}
/* ---------------- horizon mountains ---------------- */
function buildMountains(t, env, tod){
  var rnd=RNG(t.seed*17+9), n=Math.floor(46*env.mount)+10;
  var geo=new THREE.ConeGeometry(1,1,5);
  var col = env.snow>0.5?0xdfe8f2:(tod.night?0x161d2b:0x54606f);
  var mat=new THREE.MeshLambertMaterial({color:col, flatShading:true});
  var inst=new THREE.InstancedMesh(geo,mat,n), m4=new THREE.Matrix4(), q4=new THREE.Quaternion(), sc=new THREE.Vector3(), pv=new THREE.Vector3();
  for(var i=0;i<n;i++){
    var a=rnd()*6.28, d=1900+rnd()*1500;
    var h=180+rnd()*520, w=260+rnd()*420;
    pv.set(Math.cos(a)*d, h/2-40, Math.sin(a)*d); sc.set(w,h,w);
    q4.setFromAxisAngle(new THREE.Vector3(0,1,0), rnd()*6.28);
    m4.compose(pv,q4,sc); inst.setMatrixAt(i,m4);
  }
  worldGroup.add(inst);
}
/* ---------------- clouds ---------------- */
function buildClouds(t, tod){
  if (QUAL()<1) return;
  var c=cvs(256,128), g=c.getContext('2d');
  var grd=g.createRadialGradient(128,64,4,128,64,110);
  grd.addColorStop(0,'rgba(255,255,255,.92)'); grd.addColorStop(.55,'rgba(255,255,255,.42)'); grd.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=grd; g.fillRect(0,0,256,128);
  var m=new THREE.SpriteMaterial({map:tex(c), transparent:true, depthWrite:false,
    color: tod.night?0x2a3550:(tod===TOD.sunset?0xffb27a:(tod===TOD.sunrise?0xffc79a:0xffffff)), opacity:tod===TOD.overcast?0.9:0.6});
  var rnd=RNG(t.seed*31+2), n=QUAL()>1?42:20;
  for(var i=0;i<n;i++){
    var s=new THREE.Sprite(m.clone());
    var a=rnd()*6.28, d=700+rnd()*2200;
    s.position.set(Math.cos(a)*d, 420+rnd()*420, Math.sin(a)*d);
    var sz=500+rnd()*900; s.scale.set(sz, sz*0.42, 1);
    worldGroup.add(s);
  }
}

/* =====================================================================
   PARTICLES — smoke, sparks, fire, dust, debris
   ===================================================================== */
function pTexture(kind){
  var c=cvs(64,64), g=c.getContext('2d');
  var grd=g.createRadialGradient(32,32,1,32,32,32);
  if(kind==='spark'){ grd.addColorStop(0,'rgba(255,255,220,1)'); grd.addColorStop(.35,'rgba(255,180,60,.85)'); grd.addColorStop(1,'rgba(255,80,0,0)'); }
  else if(kind==='fire'){ grd.addColorStop(0,'rgba(255,250,200,1)'); grd.addColorStop(.3,'rgba(255,150,40,.9)'); grd.addColorStop(.7,'rgba(200,40,10,.4)'); grd.addColorStop(1,'rgba(80,20,0,0)'); }
  else { grd.addColorStop(0,'rgba(255,255,255,.85)'); grd.addColorStop(.45,'rgba(220,220,225,.45)'); grd.addColorStop(1,'rgba(200,200,205,0)'); }
  g.fillStyle=grd; g.fillRect(0,0,64,64);
  return tex(c);
}
function ParticleSys(max, kind, size, blend){
  var geo=new THREE.BufferGeometry();
  var pos=new Float32Array(max*3), col=new Float32Array(max*3), sz=new Float32Array(max);
  geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color', new THREE.BufferAttribute(col,3));
  geo.setAttribute('size', new THREE.BufferAttribute(sz,1));
  var mat=new THREE.PointsMaterial({size:size, map:pTexture(kind), transparent:true, depthWrite:false,
    vertexColors:true, sizeAttenuation:true, blending: blend||THREE.NormalBlending, opacity:1});
  var pts=new THREE.Points(geo,mat); pts.frustumCulled=false;
  var P=[], head=0;
  for(var i=0;i<max;i++) P.push({life:0,max:1,x:0,y:-9999,z:0,vx:0,vy:0,vz:0,s0:1,s1:2,c:new THREE.Color(1,1,1)});
  return {
    obj:pts, arr:P,
    spawn:function(x,y,z,vx,vy,vz,life,s0,s1,c){
      var p=P[head]; head=(head+1)%max;
      p.x=x;p.y=y;p.z=z;p.vx=vx;p.vy=vy;p.vz=vz;p.life=life;p.max=life;p.s0=s0;p.s1=s1;
      if(c)p.c.setHex(c);
    },
    update:function(dt){
      var pa=geo.attributes.position.array, ca=geo.attributes.color.array, sa=geo.attributes.size.array;
      for(var i=0;i<max;i++){
        var p=P[i];
        if(p.life>0){
          p.life-=dt;
          p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
          p.vy += (kind==='smoke'? 2.4 : -13)*dt;
          p.vx*=Math.pow(0.36,dt); p.vz*=Math.pow(0.36,dt);
          var k=Math.max(0,p.life/p.max);
          pa[i*3]=p.x; pa[i*3+1]=p.y; pa[i*3+2]=p.z;
          var f = kind==='smoke'? k*0.9 : k;
          ca[i*3]=p.c.r*f; ca[i*3+1]=p.c.g*f; ca[i*3+2]=p.c.b*f;
          sa[i]=p.s0+(p.s1-p.s0)*(1-k);
        } else { pa[i*3+1]=-9999; sa[i]=0; }
      }
      geo.attributes.position.needsUpdate=true;
      geo.attributes.color.needsUpdate=true;
      geo.attributes.size.needsUpdate=true;
    }
  };
}
var FX = {smoke:null, spark:null, fire:null, debris:[]};
function initFX(){
  FX.smoke = ParticleSys(40,'smoke',2.0);
  FX.spark = ParticleSys(320,'spark',1.1,THREE.AdditiveBlending);
  FX.fire  = ParticleSys(260,'fire',4.2,THREE.AdditiveBlending);
  scene.add(FX.smoke.obj); scene.add(FX.spark.obj); scene.add(FX.fire.obj);
}

/* =====================================================================
   CAR MODEL
   ===================================================================== */
var PAINTS = [
  {n:'Inferno Red',   c:'#d81f26'}, {n:'Electric Blue', c:'#1b6fe0'},
  {n:'Sunburst',      c:'#f5a11b'}, {n:'Midnight',      c:'#1b2230'},
  {n:'Viper Green',   c:'#2fae52'}, {n:'Arctic White',  c:'#eef2f7'},
  {n:'Royal Purple',  c:'#7b3fd4'}, {n:'Hot Pink',      c:'#e5399a'},
  {n:'Gold Rush',     c:'#c9a227'}, {n:'Carbon Grey',   c:'#4d545e'},
  {n:'Cyan Strike',   c:'#17b8c9'}, {n:'Lava Orange',   c:'#f0561b'}
];
/* ================= CAR BODY (lofted, not boxes) =================
   Cross-sections along the length are lofted into a smooth shell, with the
   floor line lifted over the axles to cut real wheel arches. */
var BODY_STATIONS = [
 //  z     fw    fy    bw    by    tw    ty
 [ 2.95, 0.30, 0.30, 0.34, 0.44, 0.20, 0.54],
 [ 2.82, 0.52, 0.24, 0.60, 0.46, 0.42, 0.62],
 [ 2.62, 0.70, 0.22, 0.81, 0.52, 0.61, 0.72],
 [ 2.30, 0.80, 0.22, 0.90, 0.60, 0.75, 0.82],
 [ 2.02, 0.84, 0.30, 0.94, 0.66, 0.80, 0.88],
 [ 1.80, 0.86, 0.56, 0.97, 0.70, 0.83, 0.92],
 [ 1.55, 0.88, 0.76, 0.99, 0.74, 0.85, 0.95],
 [ 1.30, 0.86, 0.56, 0.97, 0.76, 0.85, 0.98],
 [ 1.05, 0.85, 0.36, 0.96, 0.78, 0.85, 1.00],
 [ 0.55, 0.85, 0.24, 0.96, 0.80, 0.86, 1.02],
 [ 0.00, 0.85, 0.22, 0.96, 0.81, 0.86, 1.03],
 [-0.55, 0.85, 0.23, 0.96, 0.81, 0.86, 1.03],
 [-1.05, 0.86, 0.36, 0.97, 0.80, 0.86, 1.02],
 [-1.30, 0.87, 0.56, 0.98, 0.78, 0.86, 1.01],
 [-1.55, 0.88, 0.76, 0.99, 0.76, 0.86, 1.00],
 [-1.80, 0.86, 0.56, 0.97, 0.74, 0.85, 0.99],
 [-2.05, 0.84, 0.34, 0.94, 0.72, 0.83, 0.97],
 [-2.35, 0.78, 0.30, 0.88, 0.68, 0.78, 0.94],
 [-2.58, 0.68, 0.32, 0.76, 0.62, 0.66, 0.88],
 [-2.72, 0.34, 0.36, 0.40, 0.54, 0.32, 0.74]
];
var CABIN_STATIONS = [
 //  z     w     y     wr    yr
 [ 1.50, 0.74, 0.99, 0.16, 1.03],
 [ 1.20, 0.78, 1.00, 0.42, 1.24],
 [ 0.92, 0.80, 1.01, 0.62, 1.42],
 [ 0.50, 0.81, 1.02, 0.72, 1.52],
 [ 0.00, 0.82, 1.03, 0.74, 1.55],
 [-0.55, 0.82, 1.03, 0.74, 1.55],
 [-1.00, 0.81, 1.02, 0.70, 1.51],
 [-1.45, 0.79, 1.01, 0.52, 1.36],
 [-1.85, 0.76, 0.99, 0.20, 1.10],
 [-2.06, 0.72, 0.97, 0.07, 1.00]
];
function loft(stations, ringOf){
  var rings=[], i, j;
  for(i=0;i<stations.length;i++) rings.push(ringOf(stations[i]));
  var M=stations.length, N=rings[0].length, pos=[], uv=[], idx=[];
  for(i=0;i<M;i++) for(j=0;j<N;j++){
    pos.push(rings[i][j][0], rings[i][j][1], stations[i][0]);
    uv.push(j/(N-1), i/(M-1));
  }
  for(i=0;i<M-1;i++) for(j=0;j<N-1;j++){
    var p=i*N+j;
    idx.push(p, p+N, p+1, p+1, p+N, p+N+1);
  }
  var g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function bodyRing(st){
  var fw=st[1], fy=st[2], bw=st[3], by=st[4], tw=st[5], ty=st[6];
  return [[0,fy],[fw*0.90,fy],[fw,fy+0.10],[bw,by],[tw,ty],[0,ty+0.012],
          [-tw,ty],[-bw,by],[-fw,fy+0.10],[-fw*0.90,fy],[0,fy]];
}
function cabinRing(st){
  var w=st[1], y=st[2], wr=st[3], yr=st[4];
  return [[0,y],[w,y],[wr,yr],[0,yr+0.010],[-wr,yr],[-w,y],[0,y]];
}
/* quad strip that hugs the flank, used for the livery */
function flankStrip(side, flipU){
  var pos=[], uv=[], idx=[], M=BODY_STATIONS.length;
  for(var i=0;i<M;i++){
    var st=BODY_STATIONS[i], x=(st[3]+0.012)*side;
    var yb=st[2]+0.10, yt=st[4];
    pos.push(x*0.94, yb, st[0], x, yt, st[0]);
    var u=i/(M-1); if(flipU) u=1-u;
    uv.push(u,0, u,1);
  }
  for(var j=0;j<M-1;j++){
    var p=j*2;
    if(side>0) idx.push(p,p+2,p+1, p+1,p+2,p+3);
    else       idx.push(p,p+1,p+2, p+1,p+3,p+2);
  }
  var g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function quadGeo(p1,p2,p3,p4){
  var g=new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([].concat(p1,p2,p3,p4),3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0,0, 1,0, 1,1, 0,1],2));
  g.setIndex([0,1,2, 0,2,3]); g.computeVertexNormals();
  return g;
}
var _shadowTex=null;
function shadowTexture(){
  if(_shadowTex) return _shadowTex;
  var c=cvs(128,128), g=c.getContext('2d');
  var r=g.createRadialGradient(64,64,4,64,64,62);
  r.addColorStop(0,'rgba(0,0,0,.62)'); r.addColorStop(.6,'rgba(0,0,0,.30)'); r.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=r; g.fillRect(0,0,128,128);
  _shadowTex=tex(c); return _shadowTex;
}

function buildCar(paintHex, num, sponsorIdx, driver){
  var g = new THREE.Group();
  var accHex = SPONSOR_COLORS[(sponsorIdx+3) % SPONSOR_COLORS.length];
  var cfg = {
    base: paintHex,
    acc: '#'+('000000'+accHex.toString(16)).slice(-6),
    accHex: accHex,
    num: num,
    sponsor: SPONSORS[sponsorIdx % SPONSORS.length],
    sponsor2: SPONSORS[(sponsorIdx+7) % SPONSORS.length].split(' ')[0],
    driver: (driver||'DRIVER').split(' ').pop()
  };
  var env = envTexture();
  var paint = new THREE.MeshPhongMaterial({color:new THREE.Color(paintHex), shininess:96, specular:0x9099a6,
    envMap:env, reflectivity:0.30, combine:THREE.MixOperation});
  var trim  = new THREE.MeshPhongMaterial({color:0x14181f, shininess:52, specular:0x556070});
  var glass = new THREE.MeshPhongMaterial({color:0x0a1018, shininess:190, specular:0xa8bcd0,
    transparent:true, opacity:0.78, envMap:env, reflectivity:0.55, combine:THREE.MixOperation, side:THREE.DoubleSide});
  var chrome= new THREE.MeshPhongMaterial({color:0xb6bec8, shininess:170, specular:0xffffff, envMap:env, reflectivity:0.62});

  /* --- shell --- */
  var body = new THREE.Mesh(loft(BODY_STATIONS, bodyRing), paint);
  g.add(body);
  var cabin = new THREE.Mesh(loft(CABIN_STATIONS, cabinRing), paint);
  g.add(cabin);

  /* --- livery on both flanks (own texture per side so text reads right) --- */
  var texR = flankTexture(cfg,false), texL = flankTexture(cfg,true);
  var flankMatR = new THREE.MeshPhongMaterial({map:texR, shininess:88, specular:0x8a939f,
    envMap:env, reflectivity:0.22, combine:THREE.MixOperation});
  var flankMatL = new THREE.MeshPhongMaterial({map:texL, shininess:88, specular:0x8a939f,
    envMap:env, reflectivity:0.22, combine:THREE.MixOperation});
  var fR=new THREE.Mesh(flankStrip( 1,true),  flankMatR); fR.name='flank_r'; g.add(fR);
  var fL=new THREE.Mesh(flankStrip(-1,false), flankMatL); fL.name='flank_l'; g.add(fL);

  /* --- roof number --- */
  var roofM=new THREE.Mesh(new THREE.PlaneGeometry(1.34,1.90), new THREE.MeshPhongMaterial({map:roofTexture(cfg),shininess:70}));
  roofM.rotation.x=-Math.PI/2; roofM.position.set(0,1.566,-0.28); g.add(roofM);

  /* --- hood graphics --- */
  var hoodM=new THREE.Mesh(new THREE.PlaneGeometry(1.52,1.15), new THREE.MeshPhongMaterial({map:hoodTexture(cfg),shininess:80,
    envMap:env, reflectivity:0.20, combine:THREE.MixOperation}));
  hoodM.rotation.x=-Math.PI/2+0.10; hoodM.position.set(0,0.945,1.78); hoodM.name='hood'; g.add(hoodM);

  /* --- glazing --- */
  g.add(new THREE.Mesh(quadGeo([-0.715,1.00,1.46],[0.715,1.00,1.46],[0.700,1.505,0.95],[-0.700,1.505,0.95]), glass));
  g.add(new THREE.Mesh(quadGeo([0.735,1.00,-1.84],[-0.735,1.00,-1.84],[-0.715,1.50,-1.00],[0.715,1.50,-1.00]), glass));
  for(var sw=-1;sw<=1;sw+=2){
    var win=new THREE.Mesh(quadGeo([sw*0.822,1.055,0.86],[sw*0.822,1.055,-1.00],[sw*0.800,1.470,-0.96],[sw*0.800,1.470,0.70]), glass);
    g.add(win);
  }
  // window net on the driver's side
  var netC=cvs(64,64), ng=netC.getContext('2d');
  ng.strokeStyle='#0b0e13'; ng.lineWidth=9;
  for(var q=0;q<=64;q+=16){ ng.beginPath(); ng.moveTo(q,0); ng.lineTo(q,64); ng.moveTo(0,q); ng.lineTo(64,q); ng.stroke(); }
  var netT=tex(netC,3,2);
  var net=new THREE.Mesh(quadGeo([-0.828,1.06,0.62],[-0.828,1.06,-0.62],[-0.812,1.44,-0.60],[-0.812,1.44,0.58]),
    new THREE.MeshBasicMaterial({map:netT, transparent:true, opacity:0.92, side:THREE.DoubleSide}));
  g.add(net);
  // driver-name banner above the door
  var ban=new THREE.Mesh(new THREE.PlaneGeometry(1.05,0.15), new THREE.MeshBasicMaterial({map:bannerTexture(cfg),side:THREE.DoubleSide}));
  ban.position.set(0.806,1.52,-0.10); ban.rotation.y=Math.PI/2; g.add(ban);
  var ban2=ban.clone(); ban2.position.x=-0.806; ban2.rotation.y=-Math.PI/2; g.add(ban2);

  /* --- aero --- */
  var splitter=new THREE.Mesh(new THREE.BoxGeometry(2.08,0.045,0.62), trim);
  splitter.position.set(0,0.135,2.58); splitter.name='splitter'; g.add(splitter);
  var valance=new THREE.Mesh(new THREE.BoxGeometry(1.86,0.30,0.22), trim);
  valance.position.set(0,0.31,2.76); valance.name='bumper_f'; g.add(valance);
  var grille=new THREE.Mesh(new THREE.BoxGeometry(1.16,0.26,0.10), new THREE.MeshPhongMaterial({color:0x05070a,shininess:20}));
  grille.position.set(0,0.60,2.80); g.add(grille);
  var rearB=new THREE.Mesh(new THREE.BoxGeometry(1.80,0.30,0.20), trim);
  rearB.position.set(0,0.50,-2.66); rearB.name='bumper_r'; g.add(rearB);
  var spoiler=new THREE.Mesh(new THREE.BoxGeometry(1.90,0.235,0.055), trim);
  spoiler.position.set(0,1.06,-2.44); spoiler.rotation.x=0.26; spoiler.name='spoiler'; g.add(spoiler);
  for(var dm=-1;dm<=1;dm+=2){
    var dam=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.24,0.42), trim);
    dam.position.set(dm*0.945,1.03,-2.34); g.add(dam);
  }
  // rocker skirts
  for(var rk=-1;rk<=1;rk+=2){
    var sk=new THREE.Mesh(new THREE.BoxGeometry(0.07,0.16,2.45), trim);
    sk.position.set(rk*0.90,0.20,-0.05); g.add(sk);
  }
  // roof rails + flaps
  for(var rr=-1;rr<=1;rr+=2){
    var rail=new THREE.Mesh(new THREE.BoxGeometry(0.05,0.055,1.9), trim);
    rail.position.set(rr*0.735,1.575,-0.25); g.add(rail);
  }
  var flap=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.02,0.34), new THREE.MeshPhongMaterial({color:0xd8dde4,shininess:40}));
  flap.position.set(-0.30,1.575,-1.02); g.add(flap);
  var flap2=flap.clone(); flap2.position.set(0.34,1.575,-1.28); g.add(flap2);

  /* --- lights & details --- */
  var hlm=new THREE.MeshPhongMaterial({color:0xeef4ff, shininess:200, specular:0xffffff, emissive:0x223044});
  for(var hl=-1;hl<=1;hl+=2){
    var lamp=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.17,0.05), hlm);
    lamp.position.set(hl*0.52,0.74,2.72); lamp.rotation.y=hl*0.10; g.add(lamp);
  }
  var tlm=new THREE.MeshPhongMaterial({color:0xd8281c, shininess:140, emissive:0x3a0805});
  for(var tl=-1;tl<=1;tl+=2){
    var tail=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.16,0.05), tlm);
    tail.position.set(tl*0.46,0.76,-2.62); g.add(tail);
  }
  // side-exit exhausts
  for(var ex=-1;ex<=1;ex+=2){
    var pipe=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.30,10), chrome);
    pipe.rotation.z=Math.PI/2; pipe.position.set(ex*0.94,0.26,0.30); g.add(pipe);
  }
  // hood pins
  for(var hp=-1;hp<=1;hp+=2){
    var pin=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,0.05,6), chrome);
    pin.position.set(hp*0.62,0.965,2.24); g.add(pin);
  }
  // roll cage hint through the glass
  var cageM=new THREE.MeshPhongMaterial({color:0x9aa3af, shininess:60});
  for(var cg=-1;cg<=1;cg+=2){
    var bar=new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.62,6), cageM);
    bar.position.set(cg*0.60,1.25,-0.95); bar.rotation.x=0.22; g.add(bar);
  }
  var halo=new THREE.Mesh(new THREE.BoxGeometry(1.24,0.05,0.05), cageM);
  halo.position.set(0,1.50,0.30); g.add(halo);

  /* --- wheels --- */
  var wheels=[];
  var tyreGeo=new THREE.CylinderGeometry(0.475,0.475,0.40,26);
  var tyreMat=[ new THREE.MeshPhongMaterial({color:0x1a1e24, shininess:22, specular:0x333a44}),
                new THREE.MeshPhongMaterial({map:tyreTexture(), shininess:26}),
                new THREE.MeshPhongMaterial({map:tyreTexture(), shininess:26}) ];
  var rimMat=new THREE.MeshPhongMaterial({color:0xd0d6de, shininess:180, specular:0xffffff, envMap:env, reflectivity:0.5});
  var discMat=new THREE.MeshPhongMaterial({color:0x4a4f57, shininess:90});
  var wp=[[-0.885,0.475,1.55],[0.885,0.475,1.55],[-0.885,0.475,-1.55],[0.885,0.475,-1.55]];
  for(var w=0;w<4;w++){
    var wg=new THREE.Group();
    var ty=new THREE.Mesh(tyreGeo,tyreMat); ty.rotation.z=Math.PI/2; wg.add(ty);
    var disc=new THREE.Mesh(new THREE.CylinderGeometry(0.30,0.30,0.42,16), discMat); disc.rotation.z=Math.PI/2; wg.add(disc);
    var hub=new THREE.Mesh(new THREE.CylinderGeometry(0.115,0.115,0.44,10), rimMat); hub.rotation.z=Math.PI/2; wg.add(hub);
    for(var sp=0;sp<5;sp++){
      var spk=new THREE.Mesh(new THREE.BoxGeometry(0.42,0.115,0.055), rimMat);
      spk.rotation.x=sp*Math.PI/2.5; wg.add(spk);
    }
    var lug=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.46,8), new THREE.MeshPhongMaterial({color:0xf0c53a,shininess:120}));
    lug.rotation.z=Math.PI/2; wg.add(lug);
    wg.position.set(wp[w][0],wp[w][1],wp[w][2]);
    g.add(wg); wheels.push(wg);
  }

  /* --- contact shadow --- */
  var sh=new THREE.Mesh(new THREE.PlaneGeometry(3.0,6.2),
    new THREE.MeshBasicMaterial({map:shadowTexture(), transparent:true, depthWrite:false, opacity:0.75}));
  sh.rotation.x=-Math.PI/2; sh.position.y=0.02; g.add(sh);

  g.userData.wheels=wheels;
  g.userData.wheelBase=wp.map(function(a){return [a[0],a[1],a[2]];});
  g.userData.parts={bumper_f:valance, splitter:splitter, hood:hoodM, bumper_r:rearB, spoiler:spoiler};
  g.userData.shadow=sh;
  return g;
}
function spawnDebris(part, worldPos, vel){
  part.parent.remove(part);
  var m = part.clone();
  m.position.copy(worldPos);
  m.userData.v = vel.clone();
  m.userData.av = new THREE.Vector3((Math.random()-.5)*9,(Math.random()-.5)*9,(Math.random()-.5)*9);
  m.userData.life = 9;
  scene.add(m); FX.debris.push(m);
}
function updateDebris(dt){
  for(var i=FX.debris.length-1;i>=0;i--){
    var d=FX.debris[i];
    d.userData.life-=dt;
    d.userData.v.y -= 22*dt;
    d.position.addScaledVector(d.userData.v, dt);
    d.rotation.x+=d.userData.av.x*dt; d.rotation.y+=d.userData.av.y*dt; d.rotation.z+=d.userData.av.z*dt;
    var loc=Track.locate(d.position.x,d.position.z,null);
    var gy=Track.surfaceY(loc.idx,loc.lat)+0.16;
    if(d.position.y<gy){ d.position.y=gy; d.userData.v.y*=-0.28; d.userData.v.multiplyScalar(0.7); d.userData.av.multiplyScalar(0.7); }
    if(d.userData.life<=0){ scene.remove(d); FX.debris.splice(i,1); }
  }
}

/* =====================================================================
   CAR — physics, AI, damage
   ===================================================================== */
var G = 9.81;
var DRIVER_NAMES = ["R. Castellano","M. Okonkwo","D. Halvorsen","T. Nakamura","J. Brennan","L. Moreau",
  "S. Kowalski","A. Ferreira","K. Adeyemi","P. Novak","C. Whitlock","E. Vasquez","N. Lindqvist",
  "B. Rutherford","H. Al-Farsi","V. Petrov","G. Santoro","W. Mbeki","F. Delgado","O. Lindgren"];

function Car(opts){
  this.ai       = !!opts.ai;
  this.name     = opts.name || 'Driver';
  this.num      = opts.num || 1;
  this.color    = opts.color || '#d81f26';
  this.skill    = opts.skill == null ? 0.8 : opts.skill;
  this.mesh     = buildCar(this.color, this.num, opts.sponsor||0, this.name);
  scene.add(this.mesh);

  // kinematics (body frame)
  this.x=0; this.z=0; this.y=0; this.h=0;
  this.vLong=0; this.vLat=0; this.yawRate=0;
  this.steer=0; this.throttle=0; this.brake=0; this.hand=false;
  this.wheelAng=0; this.wheelSpin=0; this.slip=0; this.onGrass=0;

  // vehicle params
  this.mass=1560; this.a=1.52; this.b=1.58; this.L=3.10; this.Iz=2450;
  this.mu=1.95; this.power=620000; this.brakeF=24500; this.maxSteer=0.76;

  // race state
  this.lap=0; this.u=0; this.prevU=0; this.progress=0; this.pos=1;
  this.fuel=100; this.fuelCap=100; this.tyre=100; this.damage=0;
  this.finished=false; this.retired=false; this.onFire=false;
  this.lapStart=0; this.bestLap=0; this.lastLap=0; this.lapTimes=[];
  this.pitting=false; this.pitTimer=0; this.pitCount=0;
  this.cache={idx:0}; this.loc=null;
  this.detached={}; this.crashCool=0; this.hitCool=0; this.aiOffset=0; this.aiTarget=0;
  this.boost=0; this.gear=1; this.rpm=0.15; this.lastPassSnd=0; this.pitLift=0; this.pitTotal=1; this.autoPit=false; this.autoPitT=0; this.throttleHeld=0;
  this.pitAtProgress=-99; this.pitBlocked=false;
  this.exhaustT=0; this.slipSmoke=0; this.distLap=0; this.slowT=0;
}
Car.prototype.applyUpgrades = function(u){
  this.power   *= (1 + 0.075*u.engine);
  this.mu      *= (1 + 0.038*u.tyres);
  this.brakeF  *= (1 + 0.075*u.brakes);
  this.fuelCap  = 100 * (1 + 0.14*u.tank);
  this.fuel     = this.fuelCap;
  this.armor    = 0.12*u.armor;
  this.gearK    = 1 + 0.06*u.gearbox;
};
Car.prototype.placeAt = function(u, lat){
  var i = Track.idxOf(u), p=Track.pts[i], r=Track.rgt[i], f=Track.fwd[i];
  this.x = p.x + r.x*lat; this.z = p.z + r.z*lat;
  this.h = Math.atan2(f.x, f.z);
  this.u = u; this.prevU = u; this.cache.idx = i; this.lap = -1;
  this.vLong=0; this.vLat=0; this.yawRate=0;
  this.sync();
};
Car.prototype.sync = function(){
  var loc = Track.locate(this.x, this.z, this.cache);
  this.cache.idx = loc.idx; this.loc = loc;
  var y = Track.smoothY(loc, loc.lat);
  this.y = y;
  this.mesh.position.set(this.x, y + (this.pitLift||0), this.z);
  this.mesh.rotation.set(0,0,0);
  this.mesh.rotateY(this.h);
  // bank roll + pitch from slope
  var roll = -Track.smoothBs(loc)*Track.bank*0.62;
  this.mesh.rotateZ(roll * Math.cos(0) );
  var i2=(loc.idx+6)%SAMPLES;
  var slope = (Track.elev[i2]-Track.elev[loc.idx]) / (Track.length/SAMPLES*6);
  this.mesh.rotateX(-Math.atan(slope));
  var shm=this.mesh.userData.shadow;
  if(shm) shm.position.y = 0.02 + Math.min(0.10, Math.abs(this.vLat)*0.002);
};
Car.prototype.speedKmh = function(){ return Math.abs(this.vLong)*3.6; };

Car.prototype.step = function(dt, world){
  if (this.retired) return;
  var loc = Track.locate(this.x, this.z, this.cache);
  this.cache.idx = loc.idx; this.loc = loc;
  var i = loc.idx;

  /* ---- pit stop ---- */
  if (this.pitting){
    this.pitTimer -= dt;
    this.vLong *= Math.pow(0.02, dt); this.vLat=0; this.yawRate=0;
    var pp = 1 - Math.max(0, this.pitTimer)/this.pitTotal;
    if (!this.ai) PitCrew.update(dt, this, pp);
    if (this.pitTimer<=0){
      this.pitting=false; this.pitBlocked=true;      // no second stop on this visit
      this.autoPit=false; this.autoPitT=0;
      this.fuel=this.fuelCap; this.tyre=100;
      this.damage=Math.max(0,this.damage-45); this.onFire=false;
      if(!this.ai){ PitCrew.stop(this); if(world) world.msg('GO GO GO!','',1100); Audio2.beep(true); }
    }
    this.sync(); return;
  }

  /* ---- AI or player inputs ---- */
  if (this.finished){ this.throttle=0; this.brake=0.35; this.steer*=0.9; }
  else if (this.ai) this.think(dt, world);
  else if (this.autoPit) this.autoPitDrive(dt, world);

  /* ---- fuel / damage effects ---- */
  var dmgK = 1 - Math.min(0.55, this.damage/100*0.55*(1-(this.armor||0)));
  var tyreK = 0.80 + 0.20*(this.tyre/100);
  var onGrass = Math.abs(loc.lat) > (loc.lat>0 ? Track.halfR[i] : Track.half);
  this.onGrass = onGrass?1:0;
  var muEff = this.mu * tyreK * (onGrass?0.45:1);
  // banking adds grip in the corners
  muEff *= 1 + Math.abs(Track.bs[i])*Track.bank*0.85;

  var outOfFuel = this.fuel<=0;
  var vAbs = Math.abs(this.vLong), vSafe = Math.max(vAbs, 2.2);

  /* ---- longitudinal ---- */
  var Fzr = this.mass*G*this.a/this.L, Fzf = this.mass*G*this.b/this.L;
  var tractionMax = muEff*Fzr*1.35;
  var pwr = this.power*dmgK*(this.gearK||1)*(1+this.boost);
  var demand = (outOfFuel?0:this.throttle) * Math.min(pwr/Math.max(vSafe,7), tractionMax*1.55);
  var slipT = 0;
  if (demand > tractionMax){ slipT = Math.min(1,(demand-tractionMax)/tractionMax); demand = tractionMax*(1-0.22*slipT); }
  if (onGrass) demand *= 0.55;
  var Fx = demand;
  if (this.vLong > 0.4 || this.brake < 0.5){
    Fx -= this.brake*this.brakeF*(1-0.35*(onGrass?1:0))*Math.sign(this.vLong||1);
  } else if (this.vLong > -8.5) {
    Fx -= this.brakeF*0.30*this.brake;              // reverse gear
  }
  Fx -= 26*this.vLong;                              // rolling resistance
  Fx -= 0.575*this.vLong*vAbs;                      // aero drag
  if (onGrass) Fx -= 900*Math.sign(this.vLong||1);
  this.wheelSpin = slipT;

  /* ---- lateral (bicycle model with saturation) ---- */
  // Reversing needs no input flip: with the wheel turned right the nose swings
  // left and the car backs to the right, which is right on screen. Flipping it
  // (as an earlier build did) sends the car the wrong way.
  var st = this.steer*this.maxSteer*(1-Math.min(0.54, vAbs/108));
  var afr = Math.atan2(this.vLat + this.a*this.yawRate, vSafe) - st;
  var arr = Math.atan2(this.vLat - this.b*this.yawRate, vSafe);
  var Cf = 132000, Cr = 178000;
  var Ff = -Cf*afr, Fr = -Cr*arr;
  var maxF = muEff*Fzf, maxR = muEff*Fzr*(this.hand?0.42:1)*(1-0.30*slipT);
  var satF = Math.abs(Ff)>maxF, satR = Math.abs(Fr)>maxR;
  if (satF) Ff = Math.sign(Ff)*maxF;
  if (satR) Fr = Math.sign(Fr)*maxR;
  this.slip = Math.min(1, (Math.abs(afr)+Math.abs(arr))*2.4 + slipT*0.7);

  var Fy = Ff+Fr, Mz = this.a*Ff - this.b*Fr;
  var dvL = Fx/this.mass + this.yawRate*this.vLat;
  var dvY = Fy/this.mass - this.yawRate*this.vLong;
  this.vLong += dvL*dt;
  this.vLat  += dvY*dt;
  this.yawRate += Mz/this.Iz*dt;
  this.yawRate *= Math.pow(0.55, dt);
  this.yawRate = Math.max(-2.6, Math.min(2.6, this.yawRate));
  if (vAbs < 1.2){ this.vLat*=Math.pow(0.02,dt); this.yawRate*=Math.pow(0.02,dt); }

  /* ---- stability assist: the car goes where you point it ---- */
  var assistK = this.ai ? 0.55 : (Save.settings.assist ? 1 : 0.28);
  if (assistK > 0 && !this.hand && !onGrass && vAbs > 1.5){
    // never ask for more rotation than the tyres can actually hold -> understeers, never snaps
    var maxYaw = 1.12*muEff*G/Math.max(vAbs, 4.0);
    var idealYaw = this.vLong * Math.tan(st) / this.L;
    idealYaw = Math.max(-maxYaw, Math.min(maxYaw, idealYaw));
    this.yawRate += (idealYaw - this.yawRate) * Math.min(1, dt*8.5*assistK);
    this.vLat *= Math.pow(0.10 + 0.55*(1-assistK), dt);   // bleed off the slide
  }
  this.vLat = Math.max(-11, Math.min(11, this.vLat));
  this.yawRate = Math.max(-2.2, Math.min(2.2, this.yawRate));
  this.h -= this.yawRate*dt;   // +yawRate turns toward the car's right (R = -fz, fx)

  var fwdx=Math.sin(this.h), fwdz=Math.cos(this.h);
  var rgtx=-fwdz, rgtz=fwdx;
  this.x += (fwdx*this.vLong + rgtx*this.vLat)*dt;
  this.z += (fwdz*this.vLong + rgtz*this.vLat)*dt;

  /* ---- wall collision ---- */
  var loc2 = Track.locate(this.x, this.z, this.cache);
  this.cache.idx=loc2.idx; this.loc=loc2; i=loc2.idx;
  // the car is a 5.7 x 2.0 m box - work out how much of it sticks out sideways at this yaw
  var rr = Track.rgt[i];
  var dLong = fwdx*rr.x + fwdz*rr.z;
  var dLat  = -fwdz*rr.x + fwdx*rr.z;
  var eff = Math.abs(2.85*dLong) + Math.abs(1.02*dLat);
  var limL = -(Track.half+0.20) + eff, limR = (Track.halfR[i]+0.20) - eff;
  if (limR < limL){ var mid=(limR+limL)*0.5; limL=mid-0.01; limR=mid+0.01; }
  var hitSide = 0;
  if (loc2.lat < limL) hitSide = -1;
  else if (loc2.lat > limR) hitSide = 1;
  if (hitSide){
    var over = hitSide<0 ? (limL-loc2.lat) : (loc2.lat-limR);
    var r=Track.rgt[i];
    this.x -= r.x*hitSide*over; this.z -= r.z*hitSide*over;   // push back inside
    var nx = -hitSide*r.x, nz = -hitSide*r.z;                 // inward wall normal
    var wv = this.worldVel();
    var vdotn = wv.x*nx + wv.z*nz;                            // <0 => driving into the wall
    if (vdotn < -0.2){
      var impact = -vdotn;
      var e = 0.30;                                           // restitution: cars scrub, not bounce
      wv.x -= (1+e)*vdotn*nx; wv.z -= (1+e)*vdotn*nz;
      this.vLong = wv.x*fwdx + wv.z*fwdz;
      this.vLat  = -wv.x*fwdz + wv.z*fwdx;
      this.vLong *= (1 - Math.min(0.34, impact/48));
      this.yawRate -= hitSide*Math.min(0.9, impact*0.026)*(Math.random()*0.5+0.5);
      this.impact(impact, world, {x:this.x,y:this.y+0.7,z:this.z});
    } else {
      // scraping
      this.vLong *= Math.pow(0.86, dt);
      if (Math.abs(this.vLong)>8 && FX.spark){
        FX.spark.spawn(this.x - Track.rgt[i].x*hitSide*0.1, this.y+0.55, this.z - Track.rgt[i].z*hitSide*0.1,
            (Math.random()-.5)*6 - fwdx*this.vLong*0.2, Math.random()*4+2, (Math.random()-.5)*6 - fwdz*this.vLong*0.2,
            0.3, 0.8, 0.15, 0xffcc66);
        this.damage += dt*1.2*(1-(this.armor||0));
        if(!this.ai) Audio2.skid(0.6);
      }
    }
  }

  /* ---- lap & progress ---- */
  this.prevU = this.u; this.u = loc2.u;
  var du = this.u - this.prevU;
  if (du < -0.5){ this.lap++; this.onLapComplete(world); }
  else if (du > 0.5){ this.lap--; }
  this.progress = this.lap + this.u;

  /* ---- consumables ---- */
  var burn = (0.30 + 0.62*this.throttle) * (1+0.12*(this.boost>0?1:0));
  this.fuel = Math.max(0, this.fuel - burn*dt*(100/this.fuelCap)*0.74);
  this.tyre = Math.max(0, this.tyre - dt*(0.20 + this.slip*1.5 + slipT*0.9)*0.17);
  if (this.boost>0) this.boost = Math.max(0, this.boost-dt*0.5);
  if (this.damage>=100 && !this.onFire){ this.onFire=true; this.explode(world); }
  this.damage = Math.min(100, this.damage);

  /* ---- pit detection ---- */
  var inPit = Track.pitExtra(this.u)>Track.pitW*0.7 && loc2.lat > Track.half+4.5;
  this.inPitLane = inPit;
  if (this.pitBlocked && Track.pitExtra(this.u) < 0.5) this.pitBlocked = false;   // back on the circuit
  if (this.ai){
    if (inPit && Math.abs(this.vLong)*3.6 < 62 && this.lap>=1 && this.vLong>0 && this.wantPit && this.canPit())
      this.beginPitStop(world);
  } else {
    // roll into the pit lane and the car parks itself in the box
    if (inPit && !this.autoPit && this.lap>=1 && this.vLong>0.5 && this.canPit()){
      this.autoPit=true; this.autoPitT=0;
      this.autoPitV0=Math.min(20, Math.abs(this.vLong));
      if(world) world.msg('PIT LANE','AUTO PIT — HOLD ACCELERATE TO DRIVE THROUGH',2000);
    }
    if (!inPit && this.autoPit){ this.autoPit=false; this.autoPitT=0; }
  }

  /* ---- marshal recovery: nobody stays beached ---- */
  if (!this.pitting && !this.finished && Math.abs(this.vLong)*3.6 < 22){
    this.slowT = (this.slowT||0) + dt;
    if (this.slowT > 7.5){ this.marshalReset(world); }
  } else this.slowT = 0;

  /* ---- visuals ---- */
  this.wheelAng += (this.vLong/0.44)*dt;
  var ws=this.mesh.userData.wheels;
  for(var w=0;w<4;w++){
    ws[w].rotation.set(0,0,0);
    if(w<2) ws[w].rotation.y = -st*0.85;
    ws[w].rotateX(this.wheelAng*(1+slipT*2.2));
  }
  this.emit(dt);
  this.sync();
};
/* the player drives in, the car takes itself to the box and the crew go to work */
Car.prototype.autoPitDrive = function(dt, world){
  // holding the throttle aborts it, so you can always drive straight through
  if (this.throttleHeld > 0.55){
    this.autoPit=false; this.autoPitT=0;
    if(world) world.msg('DRIVE THROUGH','PIT STOP CANCELLED',1200);
    return;
  }
  this.autoPitT = (this.autoPitT||0) + dt;
  var stallLat = Track.half + 11;
  var look = 8 + Math.abs(this.vLong)*0.55;
  var tp = Track.point(this.u + look/Track.length, stallLat);
  var fx=Math.sin(this.h), fz=Math.cos(this.h);
  var dx=tp.x-this.x, dz=tp.z-this.z;
  var rel = Math.atan2(-dx*fz + dz*fx, dx*fx + dz*fz);
  this.steer = Math.max(-1, Math.min(1, rel*2.3));
  var vT = Math.max(0, (this.autoPitV0||18) * (1 - this.autoPitT/3.0));
  var err = vT - this.vLong;
  if (err > 0.4){ this.throttle = Math.min(0.55, err*0.20); this.brake = 0; }
  else { this.throttle = 0; this.brake = Math.min(1, -err*0.34); }
  var onStall = Math.abs((this.loc?this.loc.lat:0) - stallLat) < 5.0;
  if (Math.abs(this.vLong) < 0.7 && (onStall || this.autoPitT > 4.2)){
    this.vLong=0; this.vLat=0; this.yawRate=0; this.steer=0;
    this.autoPit=false; this.autoPitT=0;
    this.beginPitStop(world);
  }
};
Car.prototype.canPit = function(){
  // not already stopped, not still sitting in the box from the last one,
  // and a full lap must have gone by since the previous stop
  return !this.pitting && !this.pitBlocked && (this.progress - this.pitAtProgress) > 0.85;
};
Car.prototype.beginPitStop = function(world){
  if (this.pitting || this.pitBlocked) return;      // never stack two stops
  this.pitAtProgress = this.progress;
  this.pitting=true;
  this.pitTimer = 4.6 + (this.damage>30?1.4:0) + Math.random()*0.4;
  this.pitTotal = this.pitTimer;
  this.pitCount++;
  this.vLong=0; this.vLat=0; this.yawRate=0;
  if(!this.ai){ PitCrew.start(); if(world) world.msg('PIT STOP','CREW OVER THE WALL',1500); }
};
Car.prototype.marshalReset = function(world){
  var self=this, lats=[0,-5,5,-9,9], chosen=0;
  for(var k=0;k<lats.length;k++){
    var q=Track.point(this.u, lats[k]), free=true;
    for(var c=0;c<world.cars.length;c++){
      var o=world.cars[c]; if(o===this||o.retired) continue;
      var dx=o.x-q.x, dz=o.z-q.z;
      if(dx*dx+dz*dz < 64){ free=false; break; }
    }
    if(free){ chosen=lats[k]; break; }
  }
  var i=Track.idxOf(this.u), p=Track.pts[i], r=Track.rgt[i], f=Track.fwd[i];
  this.x = p.x + r.x*chosen; this.z = p.z + r.z*chosen;
  this.h = Math.atan2(f.x, f.z);
  this.vLong = this.ai ? 14 : 0; this.vLat = 0; this.yawRate = 0;
  this.steer = 0; this.recover = 0; this.slowT = 0;
  this.damage = Math.min(96, this.damage + 3);
  this.cache.idx = i;
  if (!this.ai && world) world.msg('RECOVERED','MARSHALS PUSHED YOU BACK ON TRACK', 1600);
  this.sync();
};
Car.prototype.onLapComplete = function(world){
  if(!world) return;
  var t = world.raceTime;
  if (this.lapStart>0){
    var lt = t - this.lapStart;
    if (lt > 12){                                  // ignore bounces over the line
      this.lastLap = lt;
      this.lapTimes.push(lt);
      if(!this.bestLap || lt<this.bestLap) this.bestLap=lt;
    }
  }
  this.lapStart = t;
  if (this.lap >= world.totalLaps && this.vLong > 2){
    this.finished = true; this.finishTime = t;
    world.onFinish(this);
  } else if (!this.ai){
    world.msg('LAP '+(this.lap+1), this.lastLap?('LAST '+fmtTime(this.lastLap)):'', 1200);
    Audio2.beep(false);
  }
};
Car.prototype.impact = function(power, world, at){
  if (this.crashCool>0) return;
  this.crashCool = 0.22;
  var d = Math.max(0, power-4.5);
  var add = d*d*0.040*(1-(this.armor||0));
  this.damage += add;
  if (power>7){
    Audio2.crash(Math.min(1,power/26));
    for(var s=0;s<Math.min(26,power*1.5);s++)
      FX.spark.spawn(at.x,at.y,at.z,(Math.random()-.5)*20,Math.random()*11,(Math.random()-.5)*20,0.5+Math.random()*0.4,1.0,0.2,0xffdd88);
  
  }
  if(!this.ai && power>13 && world) world.shake(Math.min(0.7,power/40));
  // part detachment thresholds
  var parts=this.mesh.userData.parts;
  var order=[['splitter',20],['bumper_f',36],['hood',52],['bumper_r',66],['spoiler',80]];
  for(var o=0;o<order.length;o++){
    var nm=order[o][0], th=order[o][1];
    if(this.damage>=th && !this.detached[nm] && parts[nm] && parts[nm].parent){
      this.detached[nm]=1;
      var wp=new THREE.Vector3(); parts[nm].getWorldPosition(wp);
      var vv=new THREE.Vector3(Math.sin(this.h)*this.vLong*0.35+(Math.random()-.5)*7, 4+Math.random()*4, Math.cos(this.h)*this.vLong*0.35+(Math.random()-.5)*7);
      spawnDebris(parts[nm], wp, vv);
      if(!this.ai && world) world.msg('PART LOST','', 900);
    }
  }
};
Car.prototype.explode = function(world){
  Audio2.crash(1);
  for(var s=0;s<50;s++)
    FX.fire.spawn(this.x,this.y+0.9,this.z,(Math.random()-.5)*13,Math.random()*11,(Math.random()-.5)*13,0.9+Math.random(),2.4,7,0xffffff);
  
  this.retired = true;
  if(!this.ai && world) world.playerCrashedOut();
};
Car.prototype.emit = function(dt){
  /* no tyre smoke, no exhaust haze, no damage smoke - only fire on a total wreck */
  if (this.onFire && Math.random()<dt*26){
    FX.fire.spawn(this.x+(Math.random()-.5)*1.4, this.y+0.8+Math.random(), this.z+(Math.random()-.5)*1.4,
      (Math.random()-.5)*2.0, 3+Math.random()*3.5, (Math.random()-.5)*2.0, 0.45, 1.8, 4.5, 0xffffff);
  }
};

/* ---------------- AI brain ---------------- */
Car.prototype.think = function(dt, world){
  var i=this.loc.idx, n=SAMPLES;
  var sk = this.skill;                 // 0..1
  var v = Math.max(2, this.vLong);

  // racing line offset (apex-seeking)
  var lineLat = Track.bs[i]*Track.half*0.52 + (this.lane||0);
  // personality wander + slipstream hunting
  this.aiOffset += (Math.random()-0.5)*dt*0.45;
  this.aiOffset = Math.max(-Track.half*0.16, Math.min(Track.half*0.16, this.aiOffset*Math.pow(0.35,dt)));
  var targetLat = lineLat + this.aiOffset;

  // ---- avoid traffic ----
  var cars = world.cars, lift = 0;
  for (var c=0;c<cars.length;c++){
    var o=cars[c]; if(o===this||o.retired) continue;
    var dx=o.x-this.x, dz=o.z-this.z;
    var fwdx=Math.sin(this.h), fwdz=Math.cos(this.h);
    var ahead = dx*fwdx+dz*fwdz;
    var lateral = -dx*fwdz + dz*fwdx;
    if (ahead>0 && ahead<46 && Math.abs(lateral)<4.2){
      var room = Track.half-2.6;
      var dir = (lateral>0? -1: 1);
      if (Math.abs(this.loc.lat + dir*5.5) > room) dir = -dir;
      targetLat = Math.max(-room, Math.min(room, this.loc.lat + dir*5.0));
      if (ahead<22) lift = Math.max(lift, 1-(ahead/22));
    } else if (ahead>-8 && ahead<8 && Math.abs(lateral)<3.2){
      targetLat = this.loc.lat + (lateral>0?-3.4:3.4);
    }
  }
  // pit strategy
  var lapsLeft = world.totalLaps - this.lap;
  var fuelLaps = (this.fuel/this.fuelCap) * world.fuelLaps;
  this.wantPit = (fuelLaps < 1.25 && lapsLeft > 1) || this.damage>72;
  if (this.wantPit && Track.pitExtra(this.u)>1) targetLat = Track.half + 11;
  else targetLat = Math.max(-(Track.half-1.6), Math.min(Track.half-1.6, targetLat));

  // ---- steering toward a lookahead point ----
  this.smoothLat = this.smoothLat==null ? targetLat : this.smoothLat + (targetLat-this.smoothLat)*Math.min(1, dt*2.6);
  targetLat = this.smoothLat;

  var look = 13 + v*0.68;
  var du = look/Track.length;
  var tp = Track.point(this.u+du, targetLat);
  var dx2=tp.x-this.x, dz2=tp.z-this.z;
  var fx=Math.sin(this.h), fz=Math.cos(this.h);
  var rel = Math.atan2(-dx2*fz + dz2*fx, dx2*fx + dz2*fz);
  var steerCmd = Math.max(-1, Math.min(1, rel*(2.1 + sk*0.7)));
  // damping
  this.steer += (steerCmd - this.steer)*Math.min(1, dt*9);

  // ---- target speed from curvature ahead ----
  var worstV = 1e9;
  for (var s=4; s<=44; s+=6){
    var j=(i+s*2)%n;
    var k = Track.curvature(j, 14);
    var muE = this.mu*(0.8+0.2*this.tyre/100)*(1+Math.abs(Track.bs[j])*Track.bank*0.85);
    var vmax = k>1e-5 ? Math.sqrt(muE*G/k) : 200;
    var dist = (s*2)*(Track.length/n);
    // brake-limited approach
    var allow = Math.sqrt(Math.max(0, vmax*vmax + 2*(this.brakeF/this.mass)*0.88*dist));
    if (allow<worstV) worstV=allow;
  }
  var tgt = Math.min(worstV, 96) * (0.68 + sk*0.20) * (this.wantPit&&Track.pitExtra(this.u)>1 ? 0.20 : 1);
  if (this.pitting) tgt = 0;
  // keep the racing close - rivals well clear of the player ease off a little
  var pl = world.player;
  if (pl && !pl.retired && !pl.finished){
    var gap = this.progress - pl.progress;                 // in laps
    if (gap > 0.02)       tgt *= Math.max(0.90, 1 - Math.min(0.10, (gap-0.02)*1.5));
    else if (gap < -0.06) tgt *= Math.min(1.04, 1 + Math.min(0.04, (-gap-0.06)*0.7));
  }
  var err = tgt - v;
  if (err > 0.5){ this.throttle = Math.min(1, err*0.30)*(1-lift*0.95); this.brake=0; }
  else { this.throttle = 0; this.brake = Math.min(1, -err*0.22); }
  if (this.onGrass) this.throttle*=0.5;
  this.hand = false;

  /* --- recovery: measured against the track direction, not the racing line --- */
  var tf = Track.fwd[i];
  var relTrack = Math.atan2(-tf.x*fz + tf.z*fx, tf.x*fx + tf.z*fz);  // track dir in car frame
  var wrongWay = Math.abs(relTrack) > 1.5;
  if ((wrongWay || (this.vLong < 4 && Math.abs(relTrack) > 0.9)) && Math.abs(this.vLong) < 16){
    if (!this.recover){ this.recover = 0.0001; this.recDir = relTrack >= 0 ? 1 : -1; }
    this.recover += dt;
    if (this.recover < 1.4){                 // reverse away from whatever we hit
      this.throttle = 0; this.brake = 1; this.steer = -this.recDir*0.9;
    } else {                                  // then drive forward, swinging one consistent way
      this.throttle = 0.5; this.brake = 0; this.steer = this.recDir;
    }
    if (Math.abs(relTrack) < 0.55) this.recover = 0;
  } else this.recover = 0;
};

/* =====================================================================
   RACE WORLD
   ===================================================================== */
function fmtTime(s){
  if(!s||s<0) return '--:--';
  var m=Math.floor(s/60), r=s-m*60;
  return m+':'+(r<10?'0':'')+r.toFixed(1);
}
function fmtGap(g){ return g>=60? fmtTime(g) : ('+'+g.toFixed(1)); }

var World = {
  cars:[], player:null, track:null, totalLaps:7, raceTime:0, state:'idle',
  countdown:3.2, camMode:1, shakeAmt:0, finishOrder:[], results:null,
  hintTime:0, fuelLaps:5, difficulty:1, startedAt:0, camShakeT:0,

  start: function(trackIdx, laps, diff){
    var t = TRACKS[trackIdx];
    this.trackIdx = trackIdx; this.track = t;
    this.totalLaps = laps; this.difficulty = diff;
    this.raceTime = 0; this.countdown = 4.2; this.state='countdown';
    this.finishOrder=[]; this.results=null; this.hintTime=0; this.shakeAmt=0;

    Track.build(t);
    buildWorld(t);
    initFX();
    PitCrew.build();
    this.cars.forEach(function(c){ if(c.mesh) scene.remove(c.mesh); });
    FX.debris.forEach(function(d){scene.remove(d);}); FX.debris=[];
    this.cars=[];

    var narrow = (t.shape==='street'||t.shape==='road'||t.shape==='short');
    var FIELD = narrow ? 14 : 20;
    if (IS_MOBILE && QUAL()<2) FIELD = Math.min(FIELD, 12);
    var rnd = RNG(t.seed*3+Date.now()%1000);
    var order = [];
    for (var i=0;i<FIELD;i++) order.push(i);
    // grid: 2-wide, player starts mid-pack so there's racing both ways
    var playerGrid = Math.min(FIELD-1, 8 + (diff===0?4:0));
    var usedNums = {};
    for (var k=0;k<FIELD;k++){
      var isP = (k===playerGrid);
      var car;
      if (isP){
        car = new Car({ai:false, name:'YOU', num:Save.num, color:PAINTS[Save.paint].c, sponsor:18});
        car.applyUpgrades(Save.upgrades);
        this.player = car;
      } else {
        var num; do { num = 1+((rnd()*98)|0); } while(usedNums[num]||num===Save.num); usedNums[num]=1;
        var base = [0.60,0.75,0.88][diff];
        var sk = Math.max(0.55, Math.min(0.995, base + (rnd()-0.42)*0.16 - k*0.004));
        car = new Car({ai:true, name:DRIVER_NAMES[k%DRIVER_NAMES.length], num:num,
          color:PAINTS[(k*5+3)%PAINTS.length].c, skill:sk, sponsor:k});
        car.lane = (rnd()-0.5)*Track.half*1.10;
        car.applyUpgrades({engine:diff*0.45,tyres:diff*0.35,brakes:diff*0.25,tank:1,armor:2,gearbox:diff*0.3});
        car.power *= 0.845 + diff*0.050;      // the rival cars are a touch down on the player's
        car.mu    *= 0.975;
      }
      var row = Math.floor(k/2), col = (k%2)?1:-1;
      var gu = 1 - (0.012 + row*0.0125);
      car.placeAt(gu, col*(Track.half*0.42));
      car.grid = k+1;
      this.cars.push(car);
    }
    // laps this circuit gets out of one tank -> drives AI pit strategy
    var avgSpd = (t.shape==='road'||t.shape==='street'||t.shape==='short') ? 46 : 60;
    var lapSec = Track.length/avgSpd;
    this.fuelLaps = Math.max(2.2, (100/(0.80*0.74))/lapSec);
    this.cars.forEach(function(c){ c.lapStart=0; });
    document.getElementById('hud').classList.remove('hide');
    if (IS_TOUCH) document.getElementById('touch').classList.remove('hide');
    Audio2.music(false);
    Audio2.crowd(0.55);
    this.camMode = Save.settings.cam; camYaw = null;
    this.buildMinimap();
    this.msg('GET READY', t.n.toUpperCase(), 1400);
  },

  onFinish: function(car){
    if (this.finishOrder.indexOf(car)<0) this.finishOrder.push(car);
    if (car===this.player){ this.state='finished'; this.finishDelay=3.0;
      this.msg(ordinal(this.finishOrder.length), 'RACE COMPLETE', 2600); Audio2.beep(true); }
  },
  playerCrashedOut: function(){
    this.state='crashed'; this.finishDelay=3.4;
    this.msg('WRECKED','RACE OVER',3000);
  },
  msg: function(big, small, ms){
    var el=document.getElementById('centermsg');
    el.innerHTML = big + (small?('<small>'+small+'</small>'):'');
    el.style.opacity=1;
    clearTimeout(el._t); el._t=setTimeout(function(){el.style.opacity=0;}, ms||1200);
  },
  shake: function(a){ this.shakeAmt = Math.min(1.4, this.shakeAmt + a); },

  step: function(dt){
    var i;
    if (this.state==='countdown'){
      this.countdown -= dt;
      var lit = Math.max(0, Math.min(5, Math.floor((4.2-this.countdown)/0.62)));
      for(i=0;i<startLights.length;i++)
        startLights[i].material.color.setHex(i<lit? 0xff2a1a : 0x330000);
      if (this.countdown<=0){
        for(i=0;i<startLights.length;i++) startLights[i].material.color.setHex(0x22ff44);
        this.state='racing'; this.startedAt=performance.now(); lastInputT=performance.now();
        this.msg('GO!','',900); Audio2.beep(true);
        this.cars.forEach(function(c){ c.lapStart=0; });
      } else if (this.countdown<3.6){
        var sec=Math.ceil(this.countdown-0.2);
        if (sec!==this._lastSec && sec>0 && sec<=3){ this._lastSec=sec; this.msg(String(sec),'',600); Audio2.beep(false); }
      }
    }
    if (this.state==='racing' || this.state==='finished' || this.state==='crashed'){
      if (this.state==='racing') this.raceTime += dt;
      for (i=0;i<this.cars.length;i++){
        var c=this.cars[i];
        if (this.state!=='racing' && c===this.player && this.state==='crashed'){ c.throttle=0; c.brake=1; }
        c.crashCool=Math.max(0,c.crashCool-dt);
        c.step(dt, this);
      }
      this.collide(dt);
      this.rank();
      if (this.state!=='racing'){
        this.finishDelay-=dt;
        if (this.finishDelay<=0){ this.endRace(); }
      }
      if (this.hintTime>0){ this.hintTime-=dt; if(this.hintTime<=0) document.getElementById('hintarrow').classList.add('hide'); }
    }
    FX.smoke.update(dt); FX.spark.update(dt); FX.fire.update(dt);
    updateDebris(dt);
  },

  collide: function(dt){
    /* each car = two circles (front + rear) so contact respects the body shape */
    var cs=this.cars, i, j;
    var nodes=[];
    for(i=0;i<cs.length;i++){
      var c=cs[i];
      var fx=Math.sin(c.h), fz=Math.cos(c.h);
      nodes.push([{x:c.x+fx*1.30, z:c.z+fz*1.30},{x:c.x-fx*1.30, z:c.z-fz*1.30}]);
    }
    var R=1.24, MIN=R*2;
    for(i=0;i<cs.length;i++){
      var A=cs[i]; if(A.retired) continue;
      for(j=i+1;j<cs.length;j++){
        var B=cs[j]; if(B.retired) continue;
        var ddx=B.x-A.x, ddz=B.z-A.z;
        if(ddx*ddx+ddz*ddz > 64) continue;
        var bestPen=0, bnx=0, bnz=0;
        for(var a=0;a<2;a++) for(var b=0;b<2;b++){
          var na=nodes[i][a], nb=nodes[j][b];
          var dx=nb.x-na.x, dz=nb.z-na.z, d2=dx*dx+dz*dz;
          if(d2>=MIN*MIN || d2<1e-6) continue;
          var d=Math.sqrt(d2), pen=MIN-d;
          if(pen>bestPen){ bestPen=pen; bnx=dx/d; bnz=dz/d; }
        }
        if(bestPen<=0){
          // gentle proximity repulsion - cars ease apart instead of banging together
          var gx=B.x-A.x, gz=B.z-A.z, gd2=gx*gx+gz*gz;
          if(gd2<49 && gd2>0.4){
            var gd=Math.sqrt(gd2), push=(1-gd/7)*3.4*dt;
            A.addImpulse(-gx/gd*push, -gz/gd*push);
            B.addImpulse( gx/gd*push,  gz/gd*push);
          }
          continue;
        }
        var push=bestPen*0.52;
        A.x-=bnx*push; A.z-=bnz*push; B.x+=bnx*push; B.z+=bnz*push;
        var av=A.worldVel(), bv=B.worldVel();
        var rvn=(bv.x-av.x)*bnx+(bv.z-av.z)*bnz;
        if(rvn<0){
          var imp=-rvn*0.42;
          A.addImpulse(-bnx*imp,-bnz*imp); B.addImpulse(bnx*imp,bnz*imp);
          var pw=Math.abs(rvn);
          if(pw>11){
            var mid={x:(A.x+B.x)/2,y:A.y+0.7,z:(A.z+B.z)/2};
            A.impact(pw*0.22,this,mid); B.impact(pw*0.22,this,mid);
          } else if (pw>2 && FX.spark && Math.random()<0.4){
            FX.spark.spawn((A.x+B.x)/2,A.y+0.6,(A.z+B.z)/2,(Math.random()-.5)*6,Math.random()*4,(Math.random()-.5)*6,0.3,0.7,0.15,0xffcc66);
          }
          A.yawRate += (Math.random()-.5)*0.30; B.yawRate += (Math.random()-.5)*0.30;
        }
      }
    }
  },
  rank: function(){
    var arr=this.cars.slice();
    arr.sort(function(a,b){
      if(a.retired!==b.retired) return a.retired?1:-1;
      if(a.finished&&b.finished) return a.finishTime-b.finishTime;
      if(a.finished) return -1; if(b.finished) return 1;
      return b.progress-a.progress;
    });
    for(var i=0;i<arr.length;i++) arr[i].pos=i+1;
    this.ranked=arr;
  },
  endRace: function(){
    if(this.results) return;
    var self=this;
    this.rank();
    var res = this.ranked.map(function(c){
      return {name:c===self.player?'YOU':c.name, num:c.num, pos:c.pos, me:c===self.player,
        best:c.bestLap, laps:c.lap, retired:c.retired, pits:c.pitCount,
        gap: c.finished&&self.ranked[0].finished ? (c.finishTime-self.ranked[0].finishTime) : null};
    });
    var p=this.player;
    var pos=p.retired?res.length:p.pos;
    var reward = Math.max(40, Math.round((this.cars.length-pos+1)*30*(1+this.difficulty*0.5)*(this.totalLaps/7)));
    if(p.retired) reward=Math.round(reward*0.25);
    var xp = Math.round(reward*0.8);
    addCoins(reward); Save.xp+=xp;
    var key=this.trackIdx;
    if(!p.retired){
      Save.done[key]=Math.max(Save.done[key]||0, this.cars.length-pos+1);
      if(p.bestLap && (!Save.best[key] || p.bestLap<Save.best[key])) Save.best[key]=p.bestLap;
    }
    Save.flush();
    this.results={rows:res, pos:pos, reward:reward, retired:p.retired, best:p.bestLap};
    this.state='results';
    showResults(this.results);
  },

  /* --------- minimap --------- */
  buildMinimap: function(){
    var mm=document.getElementById('minimap'), g=mm.getContext('2d');
    var minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9;
    for(var i=0;i<SAMPLES;i+=4){ var p=Track.pts[i];
      if(p.x<minx)minx=p.x; if(p.x>maxx)maxx=p.x; if(p.z<minz)minz=p.z; if(p.z>maxz)maxz=p.z; }
    var w=maxx-minx, h=maxz-minz, s=Math.min(232/w,232/h);
    this.mm={minx:minx,minz:minz,s:s,ox:(264-w*s)/2,oz:(264-h*s)/2};
  },
  drawMinimap: function(){
    if(!this.mm) return;
    var mm=document.getElementById('minimap'), g=mm.getContext('2d'), M=this.mm;
    g.clearRect(0,0,264,264);
    g.strokeStyle='rgba(160,180,215,.55)'; g.lineWidth=9; g.lineJoin='round'; g.beginPath();
    for(var i=0;i<=SAMPLES;i+=5){
      var p=Track.pts[i%SAMPLES];
      var x=M.ox+(p.x-M.minx)*M.s, y=M.oz+(p.z-M.minz)*M.s;
      i===0?g.moveTo(x,y):g.lineTo(x,y);
    }
    g.closePath(); g.stroke();
    g.strokeStyle='rgba(30,38,54,.9)'; g.lineWidth=6; g.stroke();
    for(var c=0;c<this.cars.length;c++){
      var car=this.cars[c]; if(car.retired) continue;
      var cx=M.ox+(car.x-M.minx)*M.s, cy=M.oz+(car.z-M.minz)*M.s;
      g.fillStyle = car===this.player?'#ffd45e':'#9fb0cc';
      g.beginPath(); g.arc(cx,cy,car===this.player?5:3.2,0,6.3); g.fill();
      if(car===this.player){ g.strokeStyle='#0a0d14'; g.lineWidth=1.6; g.stroke(); }
    }
    // start line marker
    var sp=Track.pts[0];
    g.fillStyle='#ff5a4a';
    g.fillRect(M.ox+(sp.x-M.minx)*M.s-3, M.oz+(sp.z-M.minz)*M.s-3, 6,6);
  }
};
Car.prototype.worldVel = function(){
  var fx=Math.sin(this.h), fz=Math.cos(this.h);   // right = forward x up = (-fz, 0, fx)
  return {x: fx*this.vLong - fz*this.vLat, z: fz*this.vLong + fx*this.vLat};
};
Car.prototype.addImpulse = function(dx,dz){
  var fx=Math.sin(this.h), fz=Math.cos(this.h);
  this.vLong += dx*fx + dz*fz;
  this.vLat  += -dx*fz + dz*fx;
};
function ordinal(n){
  var s=['th','st','nd','rd'], v=n%100;
  return n+(s[(v-20)%10]||s[v]||s[0]);
}

/* =====================================================================
   INPUT
   ===================================================================== */
var Keys={}, Touch={left:0,right:0,gas:0,brake:0,hand:0};
var lastInputT=0, IDLE_PAUSE_MS=15000;
window.addEventListener('keydown',function(e){
  Keys[e.code]=1; lastInputT=performance.now();
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].indexOf(e.code)>=0) e.preventDefault();
  if(e.code==='KeyC') cycleCam();
  if(e.code==='Escape'||e.code==='KeyP') togglePause();
  if(e.code==='KeyR' && World.state==='racing') restartRace();
});
window.addEventListener('keyup',function(e){ Keys[e.code]=0; });
function bindTouch(id,prop){
  var el=document.getElementById(id);
  function on(e){ e.preventDefault(); Touch[prop]=1; el.classList.add('on'); Audio2.unlock(); lastInputT=performance.now(); }
  function off(e){ e.preventDefault(); Touch[prop]=0; el.classList.remove('on'); }
  el.addEventListener('touchstart',on,{passive:false}); el.addEventListener('touchend',off,{passive:false});
  el.addEventListener('touchcancel',off,{passive:false});
  el.addEventListener('mousedown',on); el.addEventListener('mouseup',off); el.addEventListener('mouseleave',off);
}
function readInput(dt, car){
  if(!car || car.retired) return;
  var steerT = 0;
  if(Keys.ArrowLeft||Keys.KeyA||Touch.left) steerT -= 1;
  if(Keys.ArrowRight||Keys.KeyD||Touch.right) steerT += 1;
  if(Save.settings.invert) steerT=-steerT;
  var rate = 5.6 - Math.min(2.4, car.speedKmh()/160);
  if(steerT===0) car.steer += (0 - car.steer)*Math.min(1, dt*9);
  else car.steer += (steerT - car.steer)*Math.min(1, dt*rate);
  car.steer = Math.max(-1, Math.min(1, car.steer));
  var gas = (Keys.ArrowUp||Keys.KeyW||Touch.gas)?1:0;
  var brk = (Keys.ArrowDown||Keys.KeyS||Touch.brake)?1:0;
  if (gas||brk||steerT||Keys.Space||Touch.hand) lastInputT=performance.now();
  car.throttle += (gas - car.throttle)*Math.min(1, dt*16);
  car.throttleHeld = gas ? (car.throttleHeld||0)+dt : 0;
  car.brake    += (brk - car.brake)*Math.min(1, dt*20);
  car.hand = !!(Keys.Space||Touch.hand);
  // driving assist: gentle stability control
  if (Save.settings.assist && car.slip>0.75 && Math.abs(car.vLong)>18){
    car.steer *= 0.86;
  }
}

/* =====================================================================
   CAMERAS
   ===================================================================== */
var camPos=new THREE.Vector3(), camLook=new THREE.Vector3(), camVel=new THREE.Vector3();
var camLoc={idx:0}, camLoc2={idx:0}, camYaw=null;
function cycleCam(){
  World.camMode=(World.camMode+1)%3;
  Save.settings.cam=World.camMode; Save.flush();
  World.msg(['COCKPIT VIEW','CHASE VIEW','BROADCAST VIEW'][World.camMode],'',900);
}
function updateCamera(dt){
  var c=World.player; if(!c) return;
  var fx=Math.sin(c.h), fz=Math.cos(c.h);
  var sp=Math.abs(c.vLong);
  var tgt=new THREE.Vector3(), look=new THREE.Vector3();
  var rx=-fz, rz=fx;                       // the car's right vector
  // during a stop, swing out to the TV view so the crew work is visible
  var mode = (c.pitting && World.camMode===0) ? 2 : World.camMode;
  // in cockpit the driver's own bodywork just blocks the road - hide it
  if (c.mesh) c.mesh.visible = (mode !== 0);

  /* The camera is LOCKED: fixed distance, fixed height, fixed field of view.
     Nothing about it reacts to speed, so braking or hitting a wall cannot
     make the view zoom in and out. */
  var fov;
  if (mode===0){                   /* PILOT / COCKPIT */
    tgt.set(c.x + fx*0.55 - rx*0.32, c.y+1.34, c.z + fz*0.55 - rz*0.32);
    look.set(c.x + fx*45, c.y+1.44, c.z + fz*45);
    fov = 80;
  } else {
    /* Rigid follow at a fixed distance, with only the ROTATION eased. The camera
       cannot drift in or out when the car brakes, stops or is hit. */
    if (camYaw===null) camYaw = c.h;
    var dh = c.h - camYaw;
    while (dh >  Math.PI) dh -= Math.PI*2;
    while (dh < -Math.PI) dh += Math.PI*2;
    camYaw += dh * Math.min(1, dt*5.5);
    var gx=Math.sin(camYaw), gz=Math.cos(camYaw);
    if (mode===1){                 /* MEDIUM CHASE */
      tgt.set(c.x - gx*8.2, c.y+2.95, c.z - gz*8.2);
      look.set(c.x + fx*16, c.y+1.30, c.z + fz*16);
      fov = 74;
    } else {                       /* LONG / BROADCAST */
      tgt.set(c.x - gx*17.0, c.y+7.0, c.z - gz*17.0);
      look.set(c.x + fx*13, c.y+1.15, c.z + fz*13);
      fov = 62;
    }
  }

  /* Keep the camera out on the racing surface. Trailing straight behind the car
     throws it at the barrier through tight corners, so clamp the TARGET (not the
     final position) - that way the smoothing absorbs it and the view never jerks. */
  var tl=Track.locate(tgt.x, tgt.z, camLoc);
  camLoc.idx = tl.idx;
  var carLat = c.loc ? c.loc.lat : 0;
  var MARGIN = Math.min(4.6, Track.half*0.42);
  var lo = Math.max(-(Track.half-MARGIN), carLat-3.2);
  var hi = Math.min(Track.halfR[tl.idx]-MARGIN, carLat+3.2);
  if(hi<lo){ var mm=(hi+lo)*0.5; lo=mm; hi=mm; }
  var want=Math.max(lo, Math.min(hi, tl.lat));
  if(want!==tl.lat){
    var rv=Track.rgt[tl.idx], dd=want-tl.lat;
    tgt.x+=rv.x*dd; tgt.z+=rv.z*dd;
  }
  var floorY=Track.smoothY(tl, want)+1.25;
  if(tgt.y<floorY) tgt.y=floorY;

  camPos.copy(tgt);            // rigid - distance to the car never changes

  // last-resort guard so a violent hit can never shove the view through a barrier
  var lc=Track.locate(camPos.x,camPos.z,camLoc2);
  camLoc2.idx=lc.idx;
  var hardLo=-(Track.half-0.8), hardHi=Track.halfR[lc.idx]-0.8;
  if(hardHi<hardLo){ var h2=(hardHi+hardLo)*0.5; hardLo=h2; hardHi=h2; }
  if(lc.lat<hardLo||lc.lat>hardHi){
    var w2=Math.max(hardLo, Math.min(hardHi, lc.lat));
    var rv2=Track.rgt[lc.idx], d2=w2-lc.lat;
    camPos.x+=rv2.x*d2; camPos.z+=rv2.z*d2;
  }
  var minY=Track.smoothY(lc, Math.max(hardLo,Math.min(hardHi,lc.lat)))+1.20;
  if(camPos.y<minY) camPos.y=minY;

  if (World.shakeAmt>0){
    World.shakeAmt=Math.max(0, World.shakeAmt-dt*4.5);
    var sh=World.shakeAmt*0.20;
    camPos.x+=(Math.random()-.5)*sh; camPos.y+=(Math.random()-.5)*sh; camPos.z+=(Math.random()-.5)*sh;
  }
  cam.position.copy(camPos);
  camLook.lerp(look, 1-Math.pow(0.0035, dt));
  cam.lookAt(camLook);
  // banking roll for immersion
  var roll = -(c.loc?Track.smoothBs(c.loc):0)*Track.bank*0.34 + (c.vLat*0.0035);
  cam.rotation.z += roll*(mode===0?0.30:0.16);
  if (cam.fov !== fov){ cam.fov = fov; cam.updateProjectionMatrix(); }
  if (skyMesh) skyMesh.position.copy(cam.position);
}

/* =====================================================================
   HUD
   ===================================================================== */
var hudT=0;
function updateHUD(dt){
  var c=World.player; if(!c) return;
  hudT+=dt;
  var kmh=c.speedKmh();
  var disp = Save.settings.units==='mph' ? kmh*0.621371 : kmh;
  document.getElementById('hSpeed').textContent = Math.round(disp);
  document.querySelector('#speedo .unit').textContent = Save.settings.units==='mph'?'M P H':'K M / H';
  // gear + rpm
  var gears=[0,58,92,130,175,225,300];
  var g=1; for(var i=1;i<gears.length-1;i++) if(kmh>gears[i]) g=i+1;
  c.gear=g;
  var lo=gears[g-1], hi=gears[g];
  var rpm=Math.max(0.09, Math.min(1, (kmh-lo)/(hi-lo)*0.82+0.16));
  if(c.throttle<0.1) rpm*=0.55;
  rpm=Math.min(1, rpm + c.wheelSpin*0.35);
  c.rpm=rpm;
  document.getElementById('hGear').textContent = kmh<2?'N':('D'+g);
  document.getElementById('rpmfill').style.width=(rpm*100)+'%';

  document.getElementById('hLap').textContent = Math.max(1,Math.min(World.totalLaps, c.lap+1))+' / '+World.totalLaps;
  document.getElementById('hTime').textContent = fmtTime(World.raceTime - (c.lapStart||0));
  document.getElementById('hBest').textContent = c.bestLap?fmtTime(c.bestLap):'--:--';
  var fp=Math.round(c.fuel/c.fuelCap*100);
  document.getElementById('hFuel').style.width=fp+'%';
  document.getElementById('hFuelT').textContent=fp+'%';
  document.getElementById('hFuelT').style.color = fp<18?'#ff5a4a':(fp<35?'#ffd45e':'#cfd9ea');
  document.getElementById('hDmg').style.width=Math.round(c.damage)+'%';
  document.getElementById('hDmgT').textContent=Math.round(c.damage)+'%';
  document.getElementById('hTyre').style.width=Math.round(c.tyre)+'%';
  document.getElementById('hTyreT').textContent=Math.round(c.tyre)+'%';

  var pe=document.getElementById('pos');
  pe.querySelector('.p').innerHTML = c.retired?'DNF':(c.pos+'<sup style="font-size:.45em">'+ordinal(c.pos).replace(/\d+/,'')+'</sup>');
  pe.querySelector('.t').textContent = 'P'+c.pos+' OF '+World.cars.length;

  /* pit guidance: warn on the approach, then guide, then show the stop itself */
  var pitEl=document.getElementById('pitprompt'), panel=document.getElementById('pitpanel');
  if (c.pitting){
    pitEl.classList.add('hide'); panel.classList.remove('hide');
    var pp=1-Math.max(0,c.pitTimer)/c.pitTotal;
    document.getElementById('pitfill').style.width=Math.round(pp*100)+'%';
    document.getElementById('pitstage').textContent =
      pp<0.16 ? 'CREW OVER THE WALL' : pp<0.34 ? 'JACK UP · FUEL IN' :
      pp<0.62 ? 'CHANGING TYRES' : pp<0.82 ? 'FUELLING · REPAIRS' : 'DROPPING THE JACK';
  } else {
    panel.classList.add('hide');
    var needs = (c.fuel/c.fuelCap<0.34 || c.damage>28 || c.tyre<50);
    var ahead = ((0.845 - c.u) + 1) % 1;
    var distM = ahead*Track.length;
    if (needs && c.lap>=1 && distM < 700 && Track.pitExtra(c.u)<0.5){
      pitEl.classList.remove('hide');
      pitEl.textContent = 'PIT ENTRY IN ' + Math.round(distM) + ' m — KEEP RIGHT';
    } else if (Track.pitExtra(c.u)>1 && c.lap>=1){
      pitEl.classList.remove('hide');
      pitEl.textContent = c.loc && c.loc.lat > Track.half+4
        ? 'IN PIT LANE — SLOW UNDER 60 TO STOP'
        : 'PIT LANE OPEN — MOVE RIGHT TO ENTER';
    } else pitEl.classList.add('hide');
  }

  if (hudT>0.12){
    hudT=0;
    var b=document.getElementById('board'), html='', arr=World.ranked||World.cars;
    var meIdx=arr.indexOf(c);
    var from=Math.max(0, Math.min(meIdx-3, arr.length-7)), to=Math.min(arr.length, from+7);
    var leader=arr[0];
    for(var k=from;k<to;k++){
      var o=arr[k];
      var gap = o===leader?'LEADER':(o.retired?'DNF':fmtGap(Math.max(0,(leader.progress-o.progress)*Track.length/Math.max(14,leader.vLong||30))));
      html+='<div class="ln'+(o===c?' me':'')+'"><span class="n">'+(k+1)+'</span><span>#'+o.num+' '+(o===c?'YOU':o.name.split(' ').pop())+'</span><span class="g">'+gap+'</span></div>';
    }
    b.innerHTML=html;
    World.drawMinimap();
  }
}

/* =====================================================================
   MAIN LOOP
   ===================================================================== */
var lastT=0, acc=0, paused=false, running=false;
function loop(now){
  requestAnimationFrame(loop);
  if(!running) return;
  var dt=Math.min(0.05,(now-lastT)/1000)||0.016; lastT=now;
  if (paused || document.hidden){ renderer.render(scene,cam); return; }

  if (World.state!=='idle' && World.state!=='results'){
    readInput(dt, World.player);
    // hands off the controls for a while? stop the race rather than drive it for them
    var pl=World.player;
    var busy = pl && (pl.pitting || pl.retired);
    if (pl && pl.pitting) lastInputT = now;            // the crew are working - don't pause on them
    if (World.state==='racing' && !paused && !busy && lastInputT && (now-lastInputT) > IDLE_PAUSE_MS){
      togglePause(); World.msg('PAUSED','NO INPUT - PRESS RESUME',1800);
    }
    // fixed-ish substeps for stability
    var steps = dt>0.026?2:1, sdt=dt/steps;
    for(var s=0;s<steps;s++) World.step(sdt);
    updateCamera(dt);
    updateHUD(dt);
    // the crowd is alive
    var ct=(now%100000)/1000;
    for(var ci=0;ci<crowdMats.length;ci++) crowdMats[ci].uniforms.time.value=ct;
    // sense of speed
    var sfx=document.getElementById('speedfx');
    if(sfx && World.player){
      var kh=World.player.speedKmh();
      sfx.style.opacity = kh<120 ? 0 : Math.min(0.85, (kh-120)/210);
    }
    // audio
    var p=World.player;
    if(p){
      var inCar = World.camMode===0;
      Audio2.engine(p.rpm, p.throttle, Math.min(1,p.speedKmh()/300), inCar);
      Audio2.skid(Math.min(1, Math.max(p.wheelSpin, p.slip>0.55?(p.slip-0.55)*2.2:0)));
      // crowd swells near grandstands & when battling
      var excite = 0.35 + (p.pos<=3?0.3:0) + (World.state==='finished'?0.5:0);
      Audio2.crowd(Math.min(1,excite));
      // whoosh when a car passes close
      for(var i=0;i<World.cars.length;i++){
        var o=World.cars[i]; if(o===p||o.retired) continue;
        var dx=o.x-p.x, dz=o.z-p.z, d2=dx*dx+dz*dz;
        if(d2<40 && now-p.lastPassSnd>900 && Math.abs(o.vLong-p.vLong)>7){ p.lastPassSnd=now; Audio2.whoosh(); break; }
      }
    }
  }
  renderer.render(scene,cam);
}

/* =====================================================================
   UI
   ===================================================================== */
function show(id){
  ['scrMenu','scrTracks','scrPre','scrHow','scrSet','scrShop','scrPause','scrRes'].forEach(function(s){
    document.getElementById(s).classList.add('hide');
  });
  if(id) document.getElementById(id).classList.remove('hide');
}
function inMenus(v){
  document.getElementById('hud').classList.toggle('hide', v);
  document.getElementById('touch').classList.toggle('hide', v || !IS_TOUCH);
  if(v) Ads.showBanner(); else Ads.hideBanner();
}
function togglePause(){
  if(World.state!=='racing'&&World.state!=='countdown') return;
  paused=!paused;
  if(!paused) lastInputT=performance.now();
  document.getElementById('scrPause').classList.toggle('hide',!paused);
  if(paused) Ads.showBanner(); else Ads.hideBanner();
}
function restartRace(){
  paused=false; show(null);
  World.start(World.trackIdx, World.totalLaps, World.difficulty);
  inMenus(false);
}
function quitToMenu(){
  paused=false; running=true; World.state='idle';
  if(World.player&&World.player.mesh) World.player.mesh.visible=true;
  show('scrMenu'); inMenus(true); Audio2.music(true); Audio2.crowd(0);
  Audio2.engine(0.1,0,0,false);
}

/* ---------- track select ---------- */
var currentRegion='all';
var FILTERS=[{k:'all',n:'All 30'},{k:'oval',n:'Ovals'},{k:'road',n:'Road & Street'},
             {k:'night',n:'Night'},{k:'sun',n:'Sunrise / Sunset'},{k:'done',n:'Completed'}];
function matchFilter(t,i,k){
  if(k==='all') return true;
  if(k==='oval') return ['oval','super','trioval','short'].indexOf(t.shape)>=0;
  if(k==='road') return ['road','street'].indexOf(t.shape)>=0;
  if(k==='night') return t.tod==='night';
  if(k==='sun') return t.tod==='sunset'||t.tod==='sunrise';
  if(k==='done') return Save.done[i]!=null;
  return true;
}
function buildTrackGrid(){
  var tabs=document.getElementById('regionTabs'); tabs.innerHTML='';
  FILTERS.forEach(function(f){
    var e=document.createElement('div'); e.className='tab'+(currentRegion===f.k?' on':''); e.textContent=f.n;
    e.onclick=function(){ currentRegion=f.k; Audio2.ui(); buildTrackGrid(); };
    tabs.appendChild(e);
  });
  var grid=document.getElementById('trackGrid'); grid.innerHTML='';
  var shown=0;
  TRACKS.forEach(function(t,i){
    if(!matchFilter(t,i,currentRegion)) return;
    shown++;
    var d=document.createElement('div'); d.className='track';
    var tod=TOD[t.tod], env=ENV[t.env];
    var g1='#'+('000000'+tod.sky1.toString(16)).slice(-6), g2='#'+('000000'+tod.sky2.toString(16)).slice(-6);
    var gr='#'+('000000'+env.ground.toString(16)).slice(-6);
    var done=Save.done[i]!=null, best=Save.best[i];
    d.innerHTML='<div class="thumb" style="background:linear-gradient(180deg,'+g1+','+g2+' 60%,'+gr+' 60%,'+gr+')">'+
      '<span class="flag">'+t.f+'</span><span class="tn">'+t.n+'</span>'+
      (done?'<span style="position:absolute;top:6px;left:7px;font-size:12px">🏁</span>':'')+'</div>'+
      '<div class="meta"><span>'+t.shape+'</span><span>'+(best?fmtTime(best):t.tod)+'</span></div>';
    d.onclick=function(){ Audio2.ui(); openPre(i); };
    grid.appendChild(d);
  });
  if(!shown){
    var e=document.createElement('div'); e.className='muted'; e.style.padding='18px';
    e.textContent='No circuits match this filter yet — go win a race.';
    grid.appendChild(e);
  }
}
function openPre(i){
  var t=TRACKS[i]; World.pendingTrack=i;
  Track.build(t);
  document.getElementById('preName').textContent=t.n;
  document.getElementById('preCountry').textContent=t.c;
  document.getElementById('preType').textContent=t.shape.toUpperCase();
  document.getElementById('preLen').textContent=(Track.length/1000).toFixed(2)+' km';
  document.getElementById('preLaps').textContent=t.laps;
  document.getElementById('preTod').textContent=t.tod.toUpperCase();
  document.getElementById('preLapSel').value=String(t.laps);
  show('scrPre');
}
function launchRace(){
  var i=World.pendingTrack==null?0:World.pendingTrack;
  var laps=parseInt(document.getElementById('preLapSel').value,10)||7;
  var diff=parseInt(document.getElementById('preDiff').value,10)||1;
  show(null); inMenus(false); paused=false;
  document.getElementById('loading').classList.remove('hide');
  document.getElementById('lfill').style.width='30%';
  document.getElementById('ltext').textContent='Building '+TRACKS[i].n+'…';
  setTimeout(function(){
    World.start(i, laps, diff);
    document.getElementById('lfill').style.width='100%';
    setTimeout(function(){ document.getElementById('loading').classList.add('hide'); },220);
  },60);
}

/* ---------- results ---------- */
function showResults(r){
  var t=document.getElementById('resTable');
  var h='<tr><th>Pos</th><th>#</th><th>Driver</th><th>Best lap</th><th>Pits</th><th>Gap</th></tr>';
  r.rows.forEach(function(x){
    h+='<tr class="'+(x.me?'me':'')+'"><td>'+(x.retired?'DNF':x.pos)+'</td><td>'+x.num+'</td><td>'+x.name+'</td>'+
       '<td>'+(x.best?fmtTime(x.best):'—')+'</td><td>'+x.pits+'</td><td>'+(x.gap==null?'—':(x.pos===1?'—':'+'+x.gap.toFixed(2))) +'</td></tr>';
  });
  t.innerHTML=h;
  document.getElementById('resTitle').textContent = r.retired?'Retired — Race Over':(r.pos===1?'🏆 Victory!':ordinal(r.pos)+' Place');
  document.getElementById('resCoins').textContent=r.reward;
  inMenus(true);
  show('scrRes');
  Audio2.music(true); Audio2.crowd(r.pos<=3?0.8:0.2); Audio2.engine(0.1,0,0,false);
  refreshCoins();
}

/* ---------- shop ---------- */
var UPG=[
  {k:'engine', n:'Engine',  d:'More horsepower — higher top speed and stronger acceleration.', base:400},
  {k:'tyres',  n:'Tyres',   d:'Softer compound — more mechanical grip in the corners.',       base:380},
  {k:'brakes', n:'Brakes',  d:'Carbon discs — brake later, carry more speed.',                base:340},
  {k:'tank',   n:'Fuel Cell',d:'Bigger cell — go further between pit stops.',                 base:300},
  {k:'armor',  n:'Chassis', d:'Reinforced roll cage — take far less damage in contact.',      base:420},
  {k:'gearbox',n:'Gearbox', d:'Closer ratios — quicker out of the corners.',                  base:360}
];
var CONS=[
  {k:'repair', n:'Repair Kit', d:'Instantly clears 60% damage mid-race.', price:150, icon:'🔧'},
  {k:'fuel',   n:'Fuel Churn', d:'Fills the tank without a pit stop.',    price:120, icon:'⛽'},
  {k:'boost',  n:'Nitro Shot', d:'20 seconds of extra power.',            price:180, icon:'🔥'}
];
function upgCost(u,lvl){ return Math.round(u.base*Math.pow(1.7,lvl)); }
var shopTab='up';
function buildShop(){
  var b=document.getElementById('shopBody'); b.innerHTML='';
  if(shopTab==='up'){
    var d=document.createElement('div'); d.className='shopgrid';
    UPG.forEach(function(u){
      var lvl=Save.upgrades[u.k]||0, max=lvl>=6, cost=upgCost(u,lvl);
      var pips=''; for(var i=0;i<6;i++) pips+='<i class="'+(i<lvl?'f':'')+'"></i>';
      var el=document.createElement('div'); el.className='item';
      el.innerHTML='<h4>'+u.n+' <span style="float:right;color:#ffd45e">Lv '+lvl+'</span></h4>'+
        '<div class="pips">'+pips+'</div><div class="muted">'+u.d+'</div>';
      var btn=document.createElement('button'); btn.className='btn small';
      btn.textContent = max?'MAXED':('🪙 '+cost);
      btn.disabled = max || Save.coins<cost;
      btn.onclick=function(){ if(Save.coins>=cost){ addCoins(-cost); Save.upgrades[u.k]=lvl+1; Save.flush(); Audio2.ui(); buildShop(); } };
      el.appendChild(btn); d.appendChild(el);
    });
    b.appendChild(d);
  } else if(shopTab==='paint'){
    var w=document.createElement('div'); w.className='card';
    w.innerHTML='<h4 style="margin-bottom:9px">Paint scheme</h4>';
    var sw=document.createElement('div'); sw.className='swatches';
    PAINTS.forEach(function(p,i){
      var e=document.createElement('div'); e.className='sw'+(Save.paint===i?' sel':'');
      e.style.background=p.c; e.title=p.n;
      e.onclick=function(){ Save.paint=i; Save.flush(); Audio2.ui(); buildShop(); };
      sw.appendChild(e);
    });
    w.appendChild(sw);
    var nu=document.createElement('div'); nu.style.marginTop='14px';
    nu.innerHTML='<h4>Car number</h4><div class="muted" style="margin-bottom:6px">Pick your number (1–99)</div>';
    var inp=document.createElement('input'); inp.type='number'; inp.min=1; inp.max=99; inp.value=Save.num;
    inp.style.cssText='background:#161d2e;color:#e8edf6;border:1px solid #2c3a58;border-radius:8px;padding:8px 12px;width:96px;font:800 18px inherit';
    inp.onchange=function(){ Save.num=Math.max(1,Math.min(99,parseInt(inp.value,10)||7)); Save.flush(); };
    nu.appendChild(inp); w.appendChild(nu);
    b.appendChild(w);
  } else {
    var d2=document.createElement('div'); d2.className='shopgrid';
    CONS.forEach(function(cn){
      var own=Save.cons[cn.k]||0;
      var el=document.createElement('div'); el.className='item';
      el.innerHTML='<h4>'+cn.icon+' '+cn.n+' <span style="float:right;color:#ffd45e">x'+own+'</span></h4><div class="muted">'+cn.d+'</div>';
      var btn=document.createElement('button'); btn.className='btn small';
      btn.textContent='🪙 '+cn.price; btn.disabled=Save.coins<cn.price;
      btn.onclick=function(){ if(Save.coins>=cn.price){ addCoins(-cn.price); Save.cons[cn.k]=own+1; Save.flush(); Audio2.ui(); buildShop(); } };
      el.appendChild(btn); d2.appendChild(el);
    });
    b.appendChild(d2);
  }
  refreshCoins();
}

/* =====================================================================
   INSTRUCTIONS — different for web and app
   ===================================================================== */
var HOW = {
  web: '<h3 style="color:#ffd45e;letter-spacing:2px;margin-bottom:8px">DESKTOP / BROWSER CONTROLS</h3>'+
    '<div class="muted">'+
    '<p><span class="kbd">W</span><span class="kbd">↑</span> Throttle &nbsp;·&nbsp; <span class="kbd">S</span><span class="kbd">↓</span> Brake / reverse</p>'+
    '<p><span class="kbd">A</span><span class="kbd">←</span> Steer left &nbsp;·&nbsp; <span class="kbd">D</span><span class="kbd">→</span> Steer right</p>'+
    '<p><span class="kbd">Space</span> Handbrake / drift &nbsp;·&nbsp; <span class="kbd">C</span> Change camera</p>'+
    '<p><span class="kbd">P</span><span class="kbd">Esc</span> Pause &nbsp;·&nbsp; <span class="kbd">R</span> Restart race</p>'+
    '<hr style="border:0;border-top:1px solid #253048;margin:14px 0">'+
    '<p><b style="color:#fff">Cameras</b> — press <span class="kbd">C</span> to cycle <b>Pilot</b> (in-car), <b>Chase</b> (medium) and <b>Broadcast</b> (long TV view).</p>'+
    '<p><b style="color:#fff">Fuel &amp; pits</b> — the tank lasts roughly 4–5 laps. When <b>PIT LANE OPEN</b> appears on the start/finish straight, move right onto the apron and drop under 60 km/h to stop for fuel, tyres and repairs.</p>'+
    '<p><b style="color:#fff">Damage</b> — light contact costs bodywork (bumpers, doors, spoiler fly off). Heavy impacts push damage to 100%, the car catches fire and your race is over.</p>'+
    '<p><b style="color:#fff">Tips</b> — brake in a straight line before the corner, use the banking on the ovals, and tuck in behind a rival on the straights for a slipstream run.</p>'+
    '<p><b style="color:#fff">Hints</b> — stuck? Pause and watch a short ad to light up the racing line and repair the car.</p>'+
    '<p style="opacity:.7;margin-top:10px">Runs best in Chrome, Edge, Firefox or Safari with hardware acceleration on. A gamepad is not required.</p>'+
    '</div>',
  app: '<h3 style="color:#ffd45e;letter-spacing:2px;margin-bottom:8px">PHONE / APP CONTROLS</h3>'+
    '<div class="muted">'+
    '<p><b style="color:#fff">No need to rotate anything.</b> The game turns itself sideways the moment it loads and stays there, whether or not your screen-rotation lock is on.</p>'+
    '<p><b style="color:#fff">◀ ▶</b> (bottom left) Steer &nbsp;·&nbsp; <b>GAS</b> (bottom right) Throttle &nbsp;·&nbsp; <b>BRAKE</b> Slow down / reverse</p>'+
    '<p><b>DRIFT</b> Handbrake &nbsp;·&nbsp; <b>CAM</b> Switch camera &nbsp;·&nbsp; <b>II</b> Pause</p>'+
    '<hr style="border:0;border-top:1px solid #253048;margin:14px 0">'+
    '<p><b style="color:#fff">Cameras</b> — tap <b>CAM</b> to cycle <b>Pilot</b> (in-car), <b>Chase</b> (medium) and <b>Broadcast</b> (long TV view).</p>'+
    '<p><b style="color:#fff">Fuel &amp; pits</b> — the tank lasts about 4–5 laps. When <b>PIT LANE OPEN</b> shows, steer right onto the pit apron on the main straight and slow under 60 km/h to refuel, change tyres and repair.</p>'+
    '<p><b style="color:#fff">Damage</b> — brush the wall and you lose bodywork. Hit it hard and the car burns — race over.</p>'+
    '<p><b style="color:#fff">Battery &amp; heat</b> — drop Graphics to <b>Low</b> in Settings for longer sessions on older phones.</p>'+
    '<p><b style="color:#fff">Ads</b> — a banner sits at the bottom of the menus and a short ad plays after a race finishes. Watch a rewarded ad any time for a hint, repairs or coins.</p>'+
    '<p style="opacity:.7;margin-top:10px">Offline friendly: once loaded, races run without a connection (ads need data).</p>'+
    '</div>'
};
function setHowTab(which){
  document.getElementById('howBody').innerHTML=HOW[which];
  document.querySelectorAll('[data-howtab]').forEach(function(e){ e.classList.toggle('on', e.dataset.howtab===which); });
}

/* =====================================================================
   SETTINGS
   ===================================================================== */
function buildSettings(){
  var b=document.getElementById('setBody'); b.innerHTML='';
  function toggle(label, key, cb){
    var row=document.createElement('div'); row.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px';
    row.innerHTML='<span>'+label+'</span>';
    var btn=document.createElement('button'); btn.className='btn small '+(Save.settings[key]?'':'ghost');
    btn.textContent=Save.settings[key]?'ON':'OFF';
    btn.onclick=function(){ Save.settings[key]=!Save.settings[key]; Save.flush(); buildSettings(); if(cb)cb(); Audio2.ui(); };
    row.appendChild(btn); b.appendChild(row);
  }
  toggle('Music','music',function(){ Audio2.setMusic(Save.settings.music); Audio2.music(World.state==='idle'||World.state==='results'); });
  toggle('Sound effects','sfx',function(){ Audio2.setSfx(Save.settings.sfx); });
  toggle('Stability assist','assist');
  toggle('Invert steering','invert');
  var qrow=document.createElement('div'); qrow.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px';
  qrow.innerHTML='<span>Graphics</span>';
  var qwrap=document.createElement('div'); qwrap.className='row';
  ['Low','Medium','High'].forEach(function(n,i){
    var bt=document.createElement('button'); bt.className='btn small '+(Save.settings.quality===i?'':'ghost'); bt.textContent=n;
    bt.onclick=function(){ Save.settings.quality=i; Save.flush(); buildSettings(); Audio2.ui(); };
    qwrap.appendChild(bt);
  });
  qrow.appendChild(qwrap); b.appendChild(qrow);
  var urow=document.createElement('div'); urow.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:12px';
  urow.innerHTML='<span>Speed units</span>';
  var uwrap=document.createElement('div'); uwrap.className='row';
  ['kmh','mph'].forEach(function(n){
    var bt=document.createElement('button'); bt.className='btn small '+(Save.settings.units===n?'':'ghost'); bt.textContent=n.toUpperCase();
    bt.onclick=function(){ Save.settings.units=n; Save.flush(); buildSettings(); };
    uwrap.appendChild(bt);
  });
  urow.appendChild(uwrap); b.appendChild(urow);
  var info=document.createElement('div'); info.className='muted';
  info.style.marginTop='6px';
  info.innerHTML='Platform detected: <b style="color:#ffd45e">'+(PLATFORM==='app'?'App':'Web browser')+'</b>'+
    (IS_TOUCH?' · touch controls':' · keyboard')+'<br>Graphics changes apply at the start of the next race.';
  b.appendChild(info);
  var reset=document.createElement('button'); reset.className='btn ghost small'; reset.textContent='Reset all progress';
  reset.onclick=function(){
    if(confirm('Reset coins, upgrades and records?')){
      Save.coins=500;Save.xp=0;Save.best={};Save.done={};
      Save.upgrades={engine:0,tyres:0,brakes:0,tank:0,armor:0,gearbox:0};
      Save.cons={repair:1,fuel:1,boost:1}; Save.flush(); refreshCoins(); buildTrackGrid();
    }
  };
  b.appendChild(reset);
}

/* =====================================================================
   ORIENTATION LOCK (phones)
   ===================================================================== */
var forcedLandscape=false, nativeLockActive=false, lockTried=false;

/* Ask the platform for a REAL landscape lock. Android Chrome only grants this
   while the page is fullscreen, so request fullscreen first. iOS Safari never
   grants it at all - that is what the CSS rotation below is for. */
function tryLockLandscape(){
  try{ if (window.TCNative && window.TCNative.lockLandscape) { window.TCNative.lockLandscape(); nativeLockActive=true; } }catch(e){}
  try{ if (window.screen && screen.orientation && screen.orientation.type &&
           screen.orientation.type.indexOf('landscape')===0) nativeLockActive=true; }catch(e){}

  function lock(){
    try{
      if (screen.orientation && screen.orientation.lock){
        screen.orientation.lock('landscape').then(function(){
          nativeLockActive=true; onResize();
        }).catch(function(){ onResize(); });
        return;
      }
      var fn = screen.lockOrientation || screen.mozLockOrientation || screen.msLockOrientation;
      if (fn && fn.call(screen,'landscape')) nativeLockActive=true;
    }catch(e){}
    onResize();
  }
  var el=document.documentElement;
  var req=el.requestFullscreen||el.webkitRequestFullscreen||el.mozRequestFullScreen||el.msRequestFullscreen;
  if (IS_TOUCH && req && !(document.fullscreenElement||document.webkitFullscreenElement)){
    try{
      var p=req.call(el);
      if (p && p.then) p.then(lock).catch(lock); else setTimeout(lock,80);
    }catch(e){ lock(); }
  } else lock();
}

/* The size the game should actually render at - swapped while self-rotated. */
function viewSize(){
  return forcedLandscape ? {w:window.innerHeight, h:window.innerWidth}
                         : {w:window.innerWidth,  h:window.innerHeight};
}
function checkOrientation(){
  // Never ask the player to turn the phone - turn the game instead.
  var want = IS_TOUCH && !nativeLockActive && (window.innerHeight > window.innerWidth);
  if (want !== forcedLandscape){
    forcedLandscape = want;
    document.body.classList.toggle('force-landscape', want);
  }
}
window.addEventListener('orientationchange', function(){ setTimeout(function(){ checkOrientation(); onResize(); },220); });

/* =====================================================================
   BOOT
   ===================================================================== */
function boot(){
  initRenderer();
  refreshCoins();
  buildTrackGrid();
  buildShop();
  buildSettings();
  setHowTab(PLATFORM);
  onResize();

  // wire buttons
  var $ = function(id){ return document.getElementById(id); };
  function nav(id, fn){ $(id).onclick=function(){ Audio2.unlock(); Audio2.ui(); fn(); }; }
  nav('mQuick', function(){ World.pendingTrack = (Math.random()*Math.min(TRACKS.length, 6))|0; launchRace(); });
  nav('mCareer',function(){ 
    var next=0; for(var i=0;i<TRACKS.length;i++){ if(Save.done[i]==null){ next=i; break; } }
    World.pendingTrack=next; openPre(next);
  });
  nav('mTracks',function(){ buildTrackGrid(); show('scrTracks'); });
  nav('mShop',  function(){ buildShop(); show('scrShop'); });
  nav('mHow',   function(){ setHowTab(PLATFORM); show('scrHow'); });
  nav('mSettings',function(){ buildSettings(); show('scrSet'); });
  nav('preGo',  function(){ if(!lockTried){ lockTried=true; tryLockLandscape(); } launchRace(); });
  document.querySelectorAll('[data-back]').forEach(function(b){ b.onclick=function(){ Audio2.ui(); show('scrMenu'); }; });
  document.querySelectorAll('[data-howtab]').forEach(function(e){ e.onclick=function(){ setHowTab(e.dataset.howtab); }; });
  document.querySelectorAll('[data-shoptab]').forEach(function(e){ e.onclick=function(){
    shopTab=e.dataset.shoptab;
    document.querySelectorAll('[data-shoptab]').forEach(function(x){x.classList.toggle('on',x===e);});
    buildShop();
  };});
  nav('shopEarn', function(){ Ads.rewarded(function(ok){ if(ok){ addCoins(250); buildShop(); World.msg&&0; } }); });
  nav('pResume', togglePause);
  nav('pRestart',restartRace);
  nav('pCam',    cycleCam);
  nav('pQuit',   quitToMenu);
  nav('pHint',   function(){
    Ads.rewarded(function(ok){
      if(!ok) return;
      World.hintTime=60;
      document.getElementById('hintarrow').classList.remove('hide');
      var p=World.player;
      if(p){ p.damage=Math.max(0,p.damage-60); p.fuel=p.fuelCap; p.tyre=100; p.onFire=false; }
      togglePause();
    });
  });
  nav('resRetry',function(){ Ads.interstitial(function(){ show(null); restartRace(); }); });
  nav('resMenu', function(){ Ads.interstitial(quitToMenu); });
  nav('resNext', function(){
    Ads.interstitial(function(){
      var n=(World.trackIdx+1)%TRACKS.length; World.pendingTrack=n; buildTrackGrid(); openPre(n);
    });
  });
  ['tLeft:left','tRight:right','tGas:gas','tBrake:brake','tHand:hand'].forEach(function(s){
    var a=s.split(':'); bindTouch(a[0],a[1]);
  });
  $('tCam').addEventListener('touchstart',function(e){e.preventDefault();cycleCam();},{passive:false});
  $('tCam').addEventListener('click',function(){cycleCam();});
  $('tPause').addEventListener('touchstart',function(e){e.preventDefault();togglePause();},{passive:false});
  $('tPause').addEventListener('click',function(){togglePause();});

  // unlock audio on first interaction
  ['pointerdown','keydown','touchstart'].forEach(function(ev){
    window.addEventListener(ev, function once(){
      Audio2.unlock(); Audio2.music(World.state==='idle'||World.state==='results');
      if(!lockTried){ lockTried=true; tryLockLandscape(); }   // upgrade to a real device lock
    }, {once:true});
  });

  // build a menu backdrop scene so it isn't a black void
  Track.build(TRACKS[2]);
  buildWorld(TRACKS[2]);
  initFX();
  cam.position.set(Track.pts[40].x, Track.elev[40]+16, Track.pts[40].z-60);
  cam.lookAt(Track.pts[0].x, 4, Track.pts[0].z);

  running=true; lastT=performance.now();
  requestAnimationFrame(loop);

  var lf=document.getElementById('lfill'); lf.style.width='100%';
  setTimeout(function(){
    document.getElementById('loading').classList.add('hide');
    show('scrMenu'); inMenus(true);
  }, 420);
}

/* menu camera drift */
(function menuOrbit(){
  var a=0;
  setInterval(function(){
    if(World.state!=='idle'&&World.state!=='results') return;
    if(!cam||!Track.pts.length) return;
    a+=0.0016;
    var i=Math.floor((a%1)*SAMPLES)%SAMPLES;
    var p=Track.pts[i], r=Track.rgt[i], f=Track.fwd[i];
    cam.position.set(p.x - f.x*46 + r.x*20, Track.elev[i]+13, p.z - f.z*46 + r.z*20);
    cam.lookAt(p.x + f.x*40, Track.elev[i]+2.5, p.z + f.z*40);
    if(skyMesh) skyMesh.position.copy(cam.position);
  }, 33);
})();

if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
