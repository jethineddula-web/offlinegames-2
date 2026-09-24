/*
 * The Players' Club standalone engine. This is browser-native JavaScript with
 * no frameworks or build process: Canvas owns rendering; small DOM bindings own
 * accessible controls and overlays. It runs by opening index.html or any static host.
 */
(() => {
  "use strict";
  const W = 1280, H = 820;
  const TX = 42, TY = 142, TW = 1196, TH = 558;
  const PX = 88, PY = 188, PW = 1104, PH = 466;
  const R = 16, POCKET_R = 31, FIXED = 1 / 120, FRICTION = 305, MAX_SPEED = 1460;
  const COLORS = { 1: "#f2c230", 2: "#2964ae", 3: "#c3313e", 4: "#75439b", 5: "#dd7526", 6: "#318a57", 7: "#852e42", 8: "#17191b", 9: "#f2c230", 10: "#2964ae", 11: "#c3313e", 12: "#75439b", 13: "#dd7526", 14: "#318a57", 15: "#852e42" };
  const pockets = [{x:PX,y:PY},{x:PX+PW/2,y:PY-3},{x:PX+PW,y:PY},{x:PX,y:PY+PH},{x:PX+PW/2,y:PY+PH+3},{x:PX+PW,y:PY+PH}];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x-b.x, a.y-b.y);
  const groupOther = g => g === "solids" ? "stripes" : "solids";
  const rr = (c,x,y,w,h,r) => { r=Math.min(r,w/2,h/2); c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); };
  const segmentDistance = (p,a,b) => { const x=b.x-a.x,y=b.y-a.y,q=x*x+y*y; const t=q?clamp(((p.x-a.x)*x+(p.y-a.y)*y)/q,0,1):0; return Math.hypot(p.x-a.x-x*t,p.y-a.y-y*t); };

  /* ---------- ads (Google AdSense / H5 Games Ad Placement API) ---------- */
  // Fill in AD_CLIENT (and AD_SLOT_BANNER, for the banner unit) once
  // AdSense approves the site. Until AD_CLIENT is set, every ad call below
  // just runs its "no ad" fallback immediately, so the game is fully
  // playable during review and for anyone with an ad blocker. Nothing
  // else needs to change when ads go live — just fill in the constants.
  var AD_CLIENT = "ca-pub-4203857211510947";
  var AD_SLOT_BANNER = "7417753724";
  let adsScriptState = "idle"; // idle | loading | ready | failed
  let adPendingCbs = [];
  const adsEnabled = () => !!AD_CLIENT;

  // Wraps a (name, onDone) ad-trigger function so onDone is guaranteed to
  // fire exactly once within `ms` — even if Google's adBreak machinery (or
  // a stalled script) never calls back. A stuck ad must never be able to
  // freeze the game.
  function guardedAdCall(fn, ms) {
    return (name, onDone) => {
      let done = false;
      const finish = () => { if (done) return; done = true; onDone?.(); };
      const timer = setTimeout(finish, ms);
      fn(name, () => { clearTimeout(timer); finish(); });
    };
  }

  function loadAdScript(cb) {
    if (!adsEnabled() || adsScriptState === "failed") return cb?.(false);
    if (adsScriptState === "ready") return cb?.(true);
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adBreak || ((o) => window.adsbygoogle.push(o));
    window.adConfig = window.adConfig || ((o) => window.adsbygoogle.push(o));
    if (adsScriptState === "loading") { adPendingCbs.push(cb); return; }
    adsScriptState = "loading";
    adPendingCbs.push(cb);
    const settle = (ok) => {
      if (adsScriptState !== "loading") return; // already settled (e.g. by the timeout)
      adsScriptState = ok ? "ready" : "failed";
      if (ok) { try { window.adConfig({ preloadAdBreaks: "on", sound: "off" }); } catch {} }
      const cbs = adPendingCbs.splice(0);
      cbs.forEach((fn) => fn?.(ok));
    };
    const s = document.createElement("script");
    s.async = true;
    s.crossOrigin = "anonymous";
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${AD_CLIENT}`;
    s.onload = () => settle(true);
    s.onerror = () => settle(false);
    document.head.appendChild(s);
    // Ad blockers, restrictive networks, and sandboxed webviews can swallow
    // the request silently — no load event, no error event, ever. Never
    // let that leave the game unable to start: if it hasn't settled
    // quickly, treat it as failed and let the player continue without ads.
    setTimeout(() => settle(false), 1500);
  }

  // Full-screen interstitial (e.g. between matches). onDone always fires —
  // whether an ad actually played, was skipped, ads aren't live yet, or the
  // ad call itself stalls — so callers can just chain the next action off it.
  const showInterstitial = guardedAdCall((name, onDone) => {
    if (!adsEnabled()) return onDone();
    loadAdScript((ok) => {
      if (!ok || typeof window.adBreak !== "function") return onDone();
      window.adBreak({ type: "next", name: name || "match-transition", afterAd: onDone, adBreakDone: onDone });
    });
  }, 12000); // generous: protects against a genuine SDK hang without cutting off a real ad mid-play once ads go live

  // Rewarded ad (e.g. "watch an ad for a shot assist"). onReward fires only
  // if the ad was actually watched; onSkipped fires if the player declined,
  // the ad failed, ads aren't live yet, or the call stalls.
  function showRewardedAd(name, onReward, onSkipped) {
    let done = false;
    const reward = () => { if (done) return; done = true; clearTimeout(timer); onReward?.(); };
    const skip = () => { if (done) return; done = true; clearTimeout(timer); onSkipped?.(); };
    const timer = setTimeout(skip, 30000); // rewarded videos legitimately run up to ~30s — don't cut a real one off mid-play
    if (!adsEnabled()) return skip();
    loadAdScript((ok) => {
      if (!ok || typeof window.adBreak !== "function") return skip();
      window.adBreak({
        type: "reward",
        name: name || "shot-assist",
        beforeReward: (showAdFn) => showAdFn(),
        adViewed: reward,
        adDismissed: skip,
        adBreakDone: (info) => { if (info && info.breakStatus && info.breakStatus !== "viewed") skip(); },
      });
    });
  }

  // Banner/display ad. Renders an <ins class="adsbygoogle"> unit into the
  // given container once AdSense is live; leaves it empty until AD_CLIENT
  // and AD_SLOT_BANNER are filled in.
  function renderBannerAd(container) {
    if (!container) return;
    if (!adsEnabled() || !AD_SLOT_BANNER) { container.innerHTML = ""; return; }
    loadAdScript((ok) => {
      if (!ok) return;
      container.innerHTML = `<ins class="adsbygoogle" style="display:block" data-ad-client="${AD_CLIENT}" data-ad-slot="${AD_SLOT_BANNER}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
    });
  }

  class Game {
    constructor() {
      this.canvas = document.getElementById("poolCanvas"); this.ctx = this.canvas.getContext("2d", {alpha:false});
      this.dom = { menu:document.getElementById("menuOverlay"), result:document.getElementById("resultOverlay"), instructions:document.getElementById("instructionsOverlay"), rotate:document.getElementById("rotateOverlay"), loading:document.getElementById("loadingOverlay"), power:document.getElementById("powerFill"), hint:document.getElementById("actionHint"), msg:document.getElementById("turnMessage"), eyebrow:document.getElementById("turnEyebrow"), sound:document.getElementById("soundButton"), resultTitle:document.getElementById("resultTitle"), resultCopy:document.getElementById("resultCopy") };
      this.images = {}; this.patterns = {}; this.balls = []; this.players=[]; this.mode="bot"; this.current=0; this.breakShot=true; this.shot=null; this.aiming=false; this.aim={x:0,y:0}; this.cueDir={x:1,y:0}; this.cueStroke=0; this.acc=0; this.last=performance.now(); this.botTimer=0; this.settle=0; this.over=false; this.audioOn=true; this.audio=null; this.master=null; this.lastTone=0; this.scale=1; this.offX=0; this.offY=0; this.assist=null; this.navBusy=false;
      this.loadImages(); this.resize(); this.bind(); renderBannerAd(document.getElementById("adSlotMenu")); requestAnimationFrame(t=>this.loop(t));
    }
    loadImages() { ["felt","wood","emblem"].forEach(k=>{ const im=new Image(); im.onload=()=>{this.images[k]=im; if(k!=="emblem") this.patterns[k]=this.ctx.createPattern(im,"repeat");}; im.src=`assets/${k === "emblem" ? "eight-ball-emblem" : k === "felt" ? "evergreen-felt-texture" : "walnut-rail-texture"}.png`; }); }
    bind() {
      window.addEventListener("resize",()=>this.resize());
      window.addEventListener("orientationchange",()=>{this.resize();setTimeout(()=>this.resize(),60);setTimeout(()=>this.resize(),260);});
      if(window.visualViewport)window.visualViewport.addEventListener("resize",()=>this.resize());
      if(window.matchMedia){const mq=window.matchMedia("(orientation: portrait)");const onChange=()=>{this.resize();setTimeout(()=>this.resize(),60);};mq.addEventListener?mq.addEventListener("change",onChange):mq.addListener(onChange);}
      this.canvas.addEventListener("pointerdown",e=>this.down(e),{passive:false}); this.canvas.addEventListener("pointermove",e=>this.move(e),{passive:false}); this.canvas.addEventListener("pointerup",e=>this.up(e),{passive:false}); this.canvas.addEventListener("pointercancel",()=>this.aiming=false,{passive:false});
      document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>{this.unlock(true);this.startWithAd(b.dataset.mode);}));
      document.getElementById("restartButton").addEventListener("click",()=>this.startWithAd(this.mode)); document.getElementById("menuButton").addEventListener("click",()=>this.showMenu());
      document.getElementById("instructionsButton").addEventListener("click",()=>{this.dom.instructions.hidden=false;});
      const closeInstructions=()=>{this.dom.instructions.hidden=true;}; document.getElementById("closeInstructions").addEventListener("click",closeInstructions); document.getElementById("closeInstructionsButton").addEventListener("click",closeInstructions);
      this.dom.sound.addEventListener("click",()=>{this.audioOn=!this.audioOn; this.dom.sound.textContent=`SOUND: ${this.audioOn?"ON":"OFF"}`; if(this.audioOn){this.unlock(true);this.tone("ready");}});
      document.getElementById("assistButton").addEventListener("click",()=>this.requestAssist());
    }
    resize() { const b=this.canvas.getBoundingClientRect(), d=Math.min(devicePixelRatio||1,2); this.canvas.width=b.width*d; this.canvas.height=b.height*d; this.scale=Math.min(b.width/W,b.height/H); this.offX=(b.width-W*this.scale)/2; this.offY=(b.height-H*this.scale)/2; this.dpr=d; }
    // Route every "start a match" action through here so the interstitial
    // (when ads are live) sits at the same natural pause point, and so a
    // slow ad call can't be re-triggered by impatient repeat taps — which
    // used to be able to queue up multiple starts once the ad call finally
    // resolved. navBusy + setStartLoading() make the wait visible instead.
    startWithAd(mode){ if(this.navBusy)return; this.navBusy=true; this.setStartLoading(true); showInterstitial("match-start",()=>{ this.navBusy=false; this.setStartLoading(false); this.start(mode); }); }
    setStartLoading(on){ document.querySelectorAll("[data-mode]").forEach(b=>{b.disabled=on;}); const restart=document.getElementById("restartButton"); if(restart){restart.disabled=on; if(on){ if(restart.dataset.label===undefined)restart.dataset.label=restart.textContent; restart.textContent="LOADING…"; } else if(restart.dataset.label!==undefined){ restart.textContent=restart.dataset.label; delete restart.dataset.label; } } if(this.dom.loading)this.dom.loading.hidden=!on; }
    showMenu(){ this.dom.result.hidden=true; this.dom.menu.hidden=false; this.over=false; this.balls=[]; this.assist=null; this.setHint("Choose your seat to begin."); renderBannerAd(document.getElementById("adSlotMenu")); }
    start(mode){ this.mode=mode; this.dom.menu.hidden=true; this.dom.result.hidden=true; this.over=false; this.current=0; this.breakShot=true; this.shot=null; this.aiming=false; this.assist=null; this.players=mode==="bot"?[{name:"You",group:null},{name:"The House",group:null}]:[{name:"Player 1",group:null},{name:"Player 2",group:null}]; this.message("Break shot — rack ’em."); this.setHint("Open with a decisive break."); this.rack(); this.syncHud(); }
    rack(){ const cue={number:0,type:"cue",color:"#f3efe6",x:PX+PW*.24,y:PY+PH/2,vx:0,vy:0,pocketed:false}; const order=[1,9,2,10,8,3,11,4,12,5,7,13,14,6,15], a=[cue], ax=PX+PW*.72, mid=PY+PH/2, xs=R*Math.sqrt(3)*1.015, ys=R*2.03; let n=0; for(let row=0;row<5;row++)for(let col=0;col<=row;col++){let number=order[n++];a.push({number,type:number===8?"eight":number<8?"solids":"stripes",color:COLORS[number],x:ax+row*xs,y:mid-row*ys/2+col*ys,vx:0,vy:0,pocketed:false});} this.balls=a; }
    loop(now){ const dt=Math.min(.045,(now-this.last)/1000); this.last=now; this.acc+=dt; while(this.acc>=FIXED){this.update(FIXED);this.acc-=FIXED;} this.draw(); requestAnimationFrame(t=>this.loop(t)); }
    update(dt){ if(this.cueStroke>0)this.cueStroke=Math.max(0,this.cueStroke-dt); if(this.dom.menu.hidden===false||this.over)return; if(this.moving()){this.physics(dt);return;} if(this.shot){this.settle+=dt;if(this.settle>.16)this.resolveShot();return;} if(this.botTurn()){this.botTimer+=dt;if(this.botTimer>.82)this.botShot();} }
    moving(){return this.balls.some(b=>!b.pocketed&&Math.hypot(b.vx,b.vy)>5);}
    physics(dt){ let fastest=Math.max(...this.balls.map(b=>b.pocketed?0:Math.hypot(b.vx,b.vy))),steps=clamp(Math.ceil(fastest*dt/(R*.56)),1,4),s=dt/steps; for(let q=0;q<steps;q++){ let active=this.balls.filter(b=>!b.pocketed); active.forEach(b=>{b.x+=b.vx*s;b.y+=b.vy*s;this.pocket(b);if(!b.pocketed)this.cushion(b);let v=Math.hypot(b.vx,b.vy),r=Math.max(0,v-FRICTION*s);if(r<5){b.vx=b.vy=0;}else{b.vx=b.vx/v*r;b.vy=b.vy/v*r;}}); for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)this.collide(active[i],active[j]);active.forEach(b=>{if(!b.pocketed){this.pocket(b);if(!b.pocketed)this.cushion(b);}});} }
    pocket(b){ for(const p of pockets)if(dist(b,p)<POCKET_R+R*.55){b.pocketed=true;b.vx=b.vy=0;if(this.shot){this.shot.pocketed.push(b.number);if(b.type==="cue")this.shot.scratch=true;if(b.type==="eight")this.shot.eight=true;}this.tone("pocket");break;} }
    cushion(b){ let rebounded=false; if(b.x-R<PX){b.x=PX+R;b.vx=Math.abs(b.vx)*.82;rebounded=true;} if(b.x+R>PX+PW){b.x=PX+PW-R;b.vx=-Math.abs(b.vx)*.82;rebounded=true;} if(b.y-R<PY){b.y=PY+R;b.vy=Math.abs(b.vy)*.82;rebounded=true;} if(b.y+R>PY+PH){b.y=PY+PH-R;b.vy=-Math.abs(b.vy)*.82;rebounded=true;} if(rebounded)this.tone("rail"); }
    collide(a,b){ let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=R*2;if(!d||d>=min)return; let nx=dx/d,ny=dy/d,over=min-d;a.x-=nx*over/2;a.y-=ny*over/2;b.x+=nx*over/2;b.y+=ny*over/2;let rel=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(rel<0){let imp=-(1+.93)*rel/2;a.vx-=imp*nx;a.vy-=imp*ny;b.vx+=imp*nx;b.vy+=imp*ny;} if(this.shot&&this.shot.first===null){if(a.type==="cue"&&b.type!=="cue")this.shot.first=b.number;if(b.type==="cue"&&a.type!=="cue")this.shot.first=a.number;}this.tone("collision",Math.abs(rel)); }
    resolveShot(){ const shot=this.shot;this.shot=null;this.settle=0;this.breakShot=false;const player=this.players[this.current]; if(shot.eight){const legal=player.group&&this.remaining(player.group)===0&&!shot.scratch;this.finish(legal?this.current:1-this.current,legal?"cleared their set and finished the 8-ball.":shot.scratch?"scratched while pocketing the 8-ball.":"pocketed the 8-ball before clearing their set.");return;} const first=shot.pocketed.find(n=>n&&n!==8); if(!player.group&&first!==undefined){player.group=first<8?"solids":"stripes";this.players[1-this.current].group=groupOther(player.group);this.message(`${player.name} claims ${this.label(player.group)}.`);} if(shot.scratch){this.replaceCue();this.switch("Foul — cue ball scratched.");return;} const own=player.group?shot.pocketed.some(n=>{const b=this.balls.find(x=>x.number===n);return b&&b.type===player.group;}):first!==undefined; if(own){this.message(`${player.name}: pocketed cleanly — continue.`);this.setHint(player.group&&this.remaining(player.group)===0?"Your set is clear. The 8-ball is live.":"Choose your next shot.");}else this.switch(shot.wasBreak?"Dry break — turn changes.":"No pocket — turn changes."); this.syncHud(); }
    remaining(g){return this.balls.filter(b=>b.type===g&&!b.pocketed).length;} label(g){return g==="solids"?"SOLIDS":"STRIPES";} cue(){return this.balls[0];}
    replaceCue(){const c=this.cue(), opts=[{x:PX+PW*.24,y:PY+PH/2},{x:PX+PW*.2,y:PY+PH*.36},{x:PX+PW*.2,y:PY+PH*.64}],p=opts.find(q=>this.balls.every(b=>b===c||b.pocketed||dist(q,b)>R*2.5))||opts[0];Object.assign(c,p,{vx:0,vy:0,pocketed:false});}
    switch(prefix){this.current=1-this.current;this.botTimer=0;this.assist=null;this.message(`${prefix} ${this.players[this.current].name}'s turn.`);this.setHint(this.botTurn()?"The House is lining up a shot…":"Drag from the cue ball and release to strike.");this.syncHud();}
    botTurn(){return this.mode==="bot"&&this.current===1;}
    botShot(){ const cue=this.cue(),p=this.players[this.current],eight=p.group&&this.remaining(p.group)===0,targets=this.balls.filter(b=>!b.pocketed&&b.type!=="cue"&&(b.type===p.group||(!p.group&&b.type!=="eight")||(eight&&b.type==="eight"))); let best=targets.map(b=>({b,clear:this.balls.every(o=>o===cue||o===b||o.pocketed||segmentDistance(o,cue,b)>R*2.2),score:dist(cue,b)})).sort((a,b)=>Number(b.clear)-Number(a.clear)||a.score-b.score)[0];if(!best)return;let a=Math.atan2(best.b.y-cue.y,best.b.x-cue.x)+Math.sin(this.balls.length*1.77)*.055;this.shoot({x:Math.cos(a),y:Math.sin(a)},clamp(.57+dist(cue,best.b)/1040,.52,.88)); }
    requestAssist(){ if(this.dom.menu.hidden===false||this.over||this.shot||this.moving()||this.botTurn())return; showRewardedAd("shot-assist",()=>this.grantAssist(),()=>{ if(!adsEnabled())this.setHint("Shot assist is coming soon."); }); }
    grantAssist(){ const cue=this.cue(),p=this.players[this.current],eight=p.group&&this.remaining(p.group)===0,targets=this.balls.filter(b=>!b.pocketed&&b.type!=="cue"&&(b.type===p.group||(!p.group&&b.type!=="eight")||(eight&&b.type==="eight"))); const best=targets.map(b=>({b,clear:this.balls.every(o=>o===cue||o===b||o.pocketed||segmentDistance(o,cue,b)>R*2.2),score:dist(cue,b)})).sort((a,b)=>Number(b.clear)-Number(a.clear)||a.score-b.score)[0]; if(!best){this.setHint("No clear target right now.");return;} this.assist={ball:best.b,until:performance.now()+4200}; this.setHint("Assist: aim for the highlighted ball."); }
    shoot(dir,power){if(this.shot||this.moving()||this.over)return;const c=this.cue(),n=Math.hypot(dir.x,dir.y)||1,d={x:dir.x/n,y:dir.y/n},speed=255+MAX_SPEED*clamp(power,0,1);c.vx=d.x*speed;c.vy=d.y*speed;this.cueDir=d;this.cueStroke=.24;this.shot={pocketed:[],scratch:false,eight:false,first:null,wasBreak:this.breakShot};this.aiming=false;this.settle=0;this.botTimer=0;this.tone("cue");}
    point(e){const r=this.canvas.getBoundingClientRect();return{x:(e.clientX-r.left-this.offX)/this.scale,y:(e.clientY-r.top-this.offY)/this.scale};}
    down(e){e.preventDefault();this.unlock();if(!this.dom.menu.hidden)return;const p=this.point(e);if(this.over)return;if(!this.shot&&!this.moving()&&!this.botTurn()&&p.x>PX-20&&p.x<PX+PW+20&&p.y>PY-20&&p.y<PY+PH+20){this.aiming=true;this.aim=p;this.canvas.setPointerCapture&&this.canvas.setPointerCapture(e.pointerId);}}
    move(e){if(!this.aiming)return;e.preventDefault();this.aim=this.point(e);}
    up(e){if(!this.aiming)return;e.preventDefault();const c=this.cue(),p=this.point(e),dx=c.x-p.x,dy=c.y-p.y,pull=Math.hypot(dx,dy);this.aiming=false;if(pull>22)this.shoot({x:dx,y:dy},clamp(pull/220,.12,1));}
    message(m){this.dom.msg.textContent=m;this.dom.eyebrow.textContent=this.breakShot?"BREAK SHOT":`${this.players[this.current]?.name||"PLAYER".toUpperCase()} AT THE TABLE`;}
    setHint(t){this.dom.hint.textContent=t;}
    syncHud(){this.players.forEach((p,i)=>{const own=document.getElementById(`player${i}Card`);own.classList.toggle("active",i===this.current&&!this.over);document.getElementById(`player${i}Name`).textContent=p.name;document.getElementById(`player${i}Group`).textContent=p.group?this.label(p.group):"OPEN TABLE";const left=p.group?this.remaining(p.group):7;document.getElementById(`player${i}Score`).textContent=`SCORE ${String(7-left).padStart(2,"0")} · ${left} LEFT`;});}
    finish(win,reason){this.over=true;this.syncHud();this.dom.resultTitle.textContent=`${this.players[win].name} wins.`;this.dom.resultCopy.textContent=`${this.players[this.current].name} ${reason}`;this.dom.result.hidden=false;}
    unlock(playReady=false){if(!this.audioOn)return;const C=window.AudioContext||window.webkitAudioContext;if(!C)return;if(!this.audio){this.audio=new C();this.master=this.audio.createGain();this.master.gain.value=.96;this.master.connect(this.audio.destination);}this.audio.resume().then(()=>{if(playReady)this.tone("ready");}).catch(()=>{this.setHint("Tap Sound: On to allow table audio in this browser.");});}
    tone(kind,v=1){if(!this.audioOn||!this.audio||this.audio.state!=="running")return;const now=this.audio.currentTime;if((kind==="collision"||kind==="rail")&&now-this.lastTone<.055)return;this.lastTone=now;const cfg={ready:[440,.11,.12,"sine"],cue:[105,.09,.2,"triangle"],collision:[170+clamp(v,0,900)*.12,.045,.08,"sine"],rail:[130,.055,.07,"triangle"],pocket:[78,.16,.18,"sine"]}[kind],o=this.audio.createOscillator(),g=this.audio.createGain();o.type=cfg[3];o.frequency.setValueAtTime(cfg[0],now);g.gain.setValueAtTime(cfg[2],now);g.gain.exponentialRampToValueAtTime(.001,now+cfg[1]);o.connect(g).connect(this.master);o.start(now);o.stop(now+cfg[1]);}
    draw(){const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle="#120c0a";c.fillRect(0,0,this.canvas.width,this.canvas.height);c.setTransform(this.dpr*this.scale,0,0,this.dpr*this.scale,this.dpr*this.offX,this.dpr*this.offY);this.table(c);if(this.balls.length){this.aimCue(c);this.balls.filter(b=>!b.pocketed).forEach(b=>this.ball(c,b));}if(this.assist){if(this.assist.ball.pocketed||performance.now()>=this.assist.until)this.assist=null;else if(!this.aiming){const b=this.assist.ball,t=(performance.now()%900)/900,ring=R+7+Math.sin(t*Math.PI*2)*2.5;c.save();c.beginPath();c.arc(b.x,b.y,ring,0,Math.PI*2);c.strokeStyle="rgba(255,225,140,.85)";c.lineWidth=2.4;c.stroke();c.restore();}}this.dom.power.style.width=this.aiming?`${clamp(dist(this.cue(),this.aim)/220,0,1)*100}%`:"0%";}
    table(c){c.save();rr(c,TX-7,TY-7,TW+14,TH+14,49);c.fillStyle="rgba(0,0,0,.5)";c.fill();rr(c,TX,TY,TW,TH,43);c.fillStyle=this.patterns.wood||"#4a2617";c.fill();c.strokeStyle="#9f6d3a";c.lineWidth=2;c.stroke();rr(c,PX-10,PY-10,PW+20,PH+20,25);c.fillStyle="#093729";c.fill();rr(c,PX,PY,PW,PH,17);c.fillStyle=this.patterns.felt||"#0d5a43";c.fill();pockets.forEach(p=>{c.beginPath();c.arc(p.x,p.y,POCKET_R+7,0,Math.PI*2);c.fillStyle="#24130d";c.fill();c.beginPath();c.arc(p.x,p.y,POCKET_R,0,Math.PI*2);c.fillStyle="#050505";c.fill();});c.restore();}
    ball(c,b){c.save();c.beginPath();c.ellipse(b.x+4,b.y+6,R*.93,R*.64,0,0,Math.PI*2);c.fillStyle="rgba(0,0,0,.26)";c.fill();c.beginPath();c.arc(b.x,b.y,R,0,Math.PI*2);c.clip();if(b.type==="stripes"){c.fillStyle="#f3eee5";c.fillRect(b.x-R,b.y-R,R*2,R*2);c.fillStyle=b.color;c.fillRect(b.x-R,b.y-R*.47,R*2,R*.94);}else{c.fillStyle=b.type==="cue"?"#f6f1e7":b.color;c.fillRect(b.x-R,b.y-R,R*2,R*2);}let g=c.createRadialGradient(b.x-6,b.y-7,1,b.x,b.y,R*1.4);g.addColorStop(0,"rgba(255,255,255,.68)");g.addColorStop(.27,"rgba(255,255,255,.1)");g.addColorStop(1,"rgba(0,0,0,.28)");c.fillStyle=g;c.fillRect(b.x-R,b.y-R,R*2,R*2);c.restore();c.beginPath();c.arc(b.x,b.y,R,0,Math.PI*2);c.strokeStyle="rgba(32,18,15,.75)";c.stroke();if(b.type!=="cue"){c.beginPath();c.arc(b.x,b.y,7.7,0,Math.PI*2);c.fillStyle="#f8f2e6";c.fill();c.fillStyle="#201a17";c.font=`700 ${b.number>9?7:8}px Manrope`;c.textAlign="center";c.textBaseline="middle";c.fillText(b.number,b.x,b.y+.5);c.textBaseline="alphabetic";}}
    aimCue(c){if((!this.aiming&&!this.cueStroke)||this.over||!this.balls.length)return;const q=this.cue();let dx=this.cueDir.x,dy=this.cueDir.y,pull=0;if(this.aiming){dx=q.x-this.aim.x;dy=q.y-this.aim.y;pull=Math.hypot(dx,dy);if(pull<2)return;dx/=pull;dy/=pull;const target=this.balls.filter(b=>!b.pocketed&&b.type!=="cue").map(b=>{const forward=(b.x-q.x)*dx+(b.y-q.y)*dy,lateral=Math.abs((b.x-q.x)*dy-(b.y-q.y)*dx);return{b,forward,lateral};}).filter(hit=>hit.forward>R*2&&hit.lateral<R*1.55).sort((a,b)=>a.forward-b.forward)[0];const toContact=target?Math.max(R+7,target.forward-R-2):250;c.save();c.lineCap="round";c.setLineDash([1.2,8.2]);c.lineDashOffset=1;c.strokeStyle="rgba(255,248,221,.92)";c.lineWidth=2.1;c.beginPath();c.moveTo(q.x+dx*(R+7),q.y+dy*(R+7));c.lineTo(q.x+dx*toContact,q.y+dy*toContact);c.stroke();c.setLineDash([]);if(target){const hit=target.b,contact={x:hit.x-dx*(R+1),y:hit.y-dy*(R+1)};c.beginPath();c.arc(contact.x,contact.y,7.5,0,Math.PI*2);c.strokeStyle="rgba(252,242,203,.82)";c.lineWidth=1.15;c.stroke();c.beginPath();c.arc(contact.x,contact.y,2.1,0,Math.PI*2);c.fillStyle="rgba(255,246,213,.9)";c.fill();c.setLineDash([1.2,8.2]);c.strokeStyle="rgba(226,213,174,.68)";c.lineWidth=1.55;c.beginPath();c.moveTo(hit.x+dx*(R+5),hit.y+dy*(R+5));c.lineTo(hit.x+dx*(R+76),hit.y+dy*(R+76));c.stroke();c.setLineDash([]);}c.restore();}const phase=this.cueStroke?this.cueStroke/.24:0,recoil=this.aiming?clamp(pull*.18,0,47):phase*58;c.save();c.translate(q.x,q.y);c.rotate(Math.atan2(dy,dx));let butt=-R-27-recoil-246,shaft=c.createLinearGradient(butt,0,-R-27-recoil,0);shaft.addColorStop(0,"#4a2113");shaft.addColorStop(.44,"#b97935");shaft.addColorStop(.77,"#e5bf77");shaft.addColorStop(1,"#f1dcad");c.lineCap="round";c.strokeStyle=shaft;c.lineWidth=7;c.beginPath();c.moveTo(butt,0);c.lineTo(-R-27-recoil,0);c.stroke();c.strokeStyle="#314861";c.lineWidth=4;c.beginPath();c.moveTo(-R-27-recoil,0);c.lineTo(-R-22-recoil,0);c.stroke();c.restore();}
  }
  new Game();
})();