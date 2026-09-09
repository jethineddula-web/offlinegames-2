(() => {
  const W = 1280;
  const H = 720;
  const GROUND = 598;
  const GRAVITY = 2100;
  const SAVE_KEY = "umbra-fight-v1";
  const SPRITE_BODY = { player: 325, assassin: 325, monk: 325, ronin: 325 };
  // Source art facing: +1 = sheet looks right (player), -1 = sheet looks left (enemies).
  const SPRITE_FACE = { player: 1, assassin: -1, monk: -1, ronin: -1 };
  const COMBAT_SHEET = {
    player: {
      punch: "playerPunch",
      kick: "playerKick",
      special: "playerSpecial",
      uppercut: "playerPunch",
      hurt: "playerHurt",
      ko: "playerHurt",
      walk: "playerWalk",
    },
    assassin: {
      punch: "assassinCombat",
      kick: "assassinCombat",
      special: "assassinCombat",
      uppercut: "assassinCombat",
      hurt: "assassinCombat",
      ko: "assassinCombat",
    },
    monk: {
      punch: "monkCombat",
      kick: "monkCombat",
      special: "monkCombat",
      uppercut: "monkCombat",
      hurt: "monkCombat",
      ko: "monkCombat",
    },
    ronin: {
      punch: "roninCombat",
      kick: "roninCombat",
      special: "roninCombat",
      uppercut: "roninCombat",
      hurt: "roninCombat",
      ko: "roninCombat",
    },
  };

  let running = false;
  let raf = 0;
  let unbind = null;

  function assetUrl(src) {
    const base = window.UMBRA_BASE || "";
    return base + src;
  }

  window.startUmbraFight = function startUmbraFight() {
    if (running) return;
    const canvas = document.getElementById("game");
    if (!canvas) return;
    running = true;
    boot(canvas);
  };

  window.stopUmbraFight = function stopUmbraFight() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (typeof unbind === "function") unbind();
    unbind = null;
    if (window.AudioEngine) window.AudioEngine.stopMusic();
  };

  if (!window.UMBRA_MANUAL) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => window.startUmbraFight());
    } else {
      window.startUmbraFight();
    }
  }

  function boot(canvas) {
    const ctx = canvas.getContext("2d");
    const touchEl = document.getElementById("touch");
    const adWrap = document.getElementById("ad-wrap");
    const A = window.AudioEngine;
    const ROSTER = window.ROSTER;
    const SKILLS = window.SKILLS;
    const ELEMENTS = window.ELEMENTS;
    const TIPS = window.TIPS;
    const Ads = window.UmbraAds;

    const assets = { images: {}, ready: 0, total: 0 };
    const keys = Object.create(null);
    const held = Object.create(null);
    let pointer = { x: 0, y: 0, down: false, clicked: false };
    let canvasBox = { left: 0, top: 0, width: W, height: H };
    let buttons = [];
    let scene = "boot";
    let nextScene = null;
    let fade = 0;
    let fadeDir = 0;
    let acc = 0;
    let lastT = 0;
    let shake = 0;
    let hitstop = 0;
    let particles = [];
    let floaters = [];
    let projectiles = [];
    let ambients = [];
    let bgTime = 0;
    let save = loadSave();
    let fight = null;
    let loadProg = 0;
    let tip = TIPS[0];
    let vsTimer = 0;
    let result = null;
    let paused = false;
    let levelPage = 0;
    let bootPulse = 0;
    let adBusy = false;

    function loadSave() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      return {
        version: 1,
        level: 1,
        unlocked: 1,
        coins: 0,
        skills: {},
        mute: false,
        name: "Riven",
      };
    }
    function persist() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      } catch (e) {}
    }
    function skillRank(id) {
      return save.skills[id] || 0;
    }
    function playerStats() {
      return {
        hp: 128 + skillRank("vitality") * 16,
        atk: 10 + skillRank("power") * 1.5,
        spd: 1 + skillRank("agility") * 0.055,
        jump: 640 + skillRank("agility") * 18,
        block: Math.max(0.18, 0.4 - skillRank("guard") * 0.04),
        meterGain: 1 + skillRank("guard") * 0.08,
      };
    }

    const IMAGE_LIST = [
      ["title", "assets/bg/title.jpg"],
      ["dojo", "assets/bg/dojo.jpg"],
      ["rooftop", "assets/bg/rooftop.jpg"],
      ["temple", "assets/bg/temple.jpg"],
      ["volcano", "assets/bg/volcano.jpg"],
      ["throne", "assets/bg/throne.jpg"],
      ["player", "assets/sprites/player.png"],
      ["playerPunch", "assets/sprites/player-punch.png"],
      ["playerKick", "assets/sprites/player-kick.png"],
      ["playerSpecial", "assets/sprites/player-special.png"],
      ["playerHurt", "assets/sprites/player-hurt.png"],
      ["playerWalk", "assets/sprites/player-walk.png"],
      ["ronin", "assets/sprites/ronin.png"],
      ["roninCombat", "assets/sprites/ronin-combat.png"],
      ["monk", "assets/sprites/monk.png"],
      ["monkCombat", "assets/sprites/monk-combat.png"],
      ["assassin", "assets/sprites/assassin.png"],
      ["assassinCombat", "assets/sprites/assassin-combat.png"],
    ];

    function preload() {
      assets.total = IMAGE_LIST.length;
      IMAGE_LIST.forEach(([key, src]) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          assets.ready++;
          loadProg = assets.ready / assets.total;
        };
        img.onerror = () => {
          assets.ready++;
          loadProg = assets.ready / assets.total;
        };
        img.src = assetUrl(src);
        assets.images[key] = img;
      });
    }

    function showAds(on) {
      if (!adWrap) return;
      adWrap.classList.toggle("hidden", !on);
      if (on && Ads && typeof Ads.refreshBanner === "function") {
        try {
          Ads.refreshBanner();
        } catch (e) {}
      }
    }

    function go(name) {
      nextScene = name;
      fadeDir = 1;
    }

    function arenaKind(name) {
      if (name === "rooftop") return "rain";
      if (name === "temple") return "snow";
      if (name === "volcano") return "ember";
      if (name === "throne") return "ash";
      return "petal";
    }

    function seedAmbient(kind) {
      ambients = [];
      const n = kind === "rain" ? 90 : kind === "petal" ? 56 : 52;
      for (let i = 0; i < n; i++) {
        ambients.push(makeAmbient(kind, true));
      }
      for (let i = 0; i < 6; i++) {
        const fog = makeAmbient(kind, true);
        fog.kind = "fog";
        fog.vx = 10 + Math.random() * 16;
        fog.vy = Math.sin(i) * 4;
        fog.r = 90 + Math.random() * 160;
        fog.y = 140 + i * 70;
        fog.x = Math.random() * W;
        fog.z = 0.25 + Math.random() * 0.35;
        ambients.push(fog);
      }
    }

    function makeAmbient(kind, anywhere) {
      const p = {
        kind,
        x: Math.random() * W,
        y: anywhere ? Math.random() * H : -20,
        z: 0.4 + Math.random() * 0.8,
        r: 0,
        life: 1,
      };
      if (kind === "rain") {
        p.vx = 40 + Math.random() * 50;
        p.vy = 780 + Math.random() * 420;
        p.len = 10 + Math.random() * 16;
      } else if (kind === "snow") {
        p.vx = -18 + Math.random() * 36;
        p.vy = 28 + Math.random() * 40;
        p.r = 1.4 + Math.random() * 2.2;
      } else if (kind === "ember") {
        p.vx = -20 + Math.random() * 40;
        p.vy = -40 - Math.random() * 70;
        p.r = 1.5 + Math.random() * 2.4;
      } else if (kind === "ash") {
        p.vx = -12 + Math.random() * 24;
        p.vy = 18 + Math.random() * 28;
        p.r = 1.2 + Math.random() * 2;
      } else {
        p.vx = -34 - Math.random() * 46;
        p.vy = 14 + Math.random() * 28;
        p.r = 4 + Math.random() * 7;
        p.spin = Math.random() * Math.PI * 2;
        p.spinV = -1.2 + Math.random() * 2.4;
      }
      return p;
    }

    function enterScene(name) {
      scene = name;
      paused = false;
      buttons = [];
      pointer.clicked = false;
      if (name === "fight") showAds(false);
      else showAds(true);
      if (name === "menu" || name === "boot") {
        A.startMusic("menu");
        seedAmbient("petal");
      }
      if (name === "fight") {
        A.startMusic("fight");
        seedAmbient(arenaKind(fight && fight.arena));
      }
      if (name === "loading") {
        tip = TIPS[(Math.random() * TIPS.length) | 0];
        if (!assets.total) preload();
      }
      if (name === "vs") vsTimer = 0;
      if (name === "levels") levelPage = Math.max(0, Math.floor((save.unlocked - 1) / 10));
      if (name === "skills" || name === "result") seedAmbient(arenaKind((fight && fight.arena) || "dojo"));
    }

    function rand(a, b) {
      return a + Math.random() * (b - a);
    }
    function clamp(v, a, b) {
      return Math.max(a, Math.min(b, v));
    }
    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function addShake(v) {
      shake = Math.min(1, shake + v);
    }
    function addHitstop(t) {
      hitstop = Math.max(hitstop, t);
    }

    function burst(x, y, color, n, speed) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = rand(0.3, 1) * (speed || 280);
        particles.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s - 40,
          life: rand(0.25, 0.7),
          max: 0.7,
          r: rand(2, 6),
          color,
        });
      }
    }
    function floater(x, y, text, color) {
      floaters.push({ x, y, text, color, life: 0.8, vy: -70 });
    }

    function scaledEnemy(def) {
      const t = 1 + (def.id - 1) * 0.042;
      return {
        ...def,
        hp: Math.round(def.hp * t),
        atk: def.atk * t,
        spd: def.spd,
        def: def.def,
      };
    }

    function Fighter(def, isPlayer) {
      const stats = isPlayer ? playerStats() : null;
      this.def = def;
      this.isPlayer = isPlayer;
      this.x = isPlayer ? 360 : 920;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.facing = isPlayer ? 1 : -1;
      this.maxHp = isPlayer ? stats.hp : def.hp;
      this.hp = this.maxHp;
      this.atk = isPlayer ? stats.atk : def.atk;
      this.spd = isPlayer ? stats.spd : def.spd;
      this.defense = isPlayer ? 1 : def.def;
      this.jumpV = isPlayer ? stats.jump : 620;
      this.blockMul = isPlayer ? stats.block : 0.42;
      this.meter = isPlayer ? 20 : 10;
      this.state = "idle";
      this.stateT = 0;
      this.anim = 0;
      this.frame = 0;
      this.hitOnce = false;
      this.invuln = 0;
      this.stun = 0;
      this.freeze = 0;
      this.burn = 0;
      this.poison = 0;
      this.armor = 0;
      this.combo = 0;
      this.comboT = 0;
      this.air = false;
      this.dead = false;
      this.flash = 0;
      this.lunge = 0;
      this.think = rand(0.2, 0.6);
      this.lastDirTap = { t: -9, dir: 0 };
      this.dashT = 0;
      this.koT = 0;
      this.blocking = false;
      this.wasAir = false;
      this.ghosts = [];
      this.ghostT = 0;
      this.stepT = 0;
      this.stretch = 1;
    }

    Fighter.prototype.setState = function (s) {
      this.state = s;
      this.stateT = 0;
      this.hitOnce = false;
      this.lunge = 0;
    };

    Fighter.prototype.busy = function () {
      return ["punch", "kick", "special", "uppercut", "hurt", "dash", "ko"].includes(this.state);
    };

    const MOVES = {
      punch: { start: 0.12, active: 0.1, rec: 0.18, dmg: 1.0, range: 102, knock: 170, stun: 0.2, h: 74 },
      kick: { start: 0.16, active: 0.12, rec: 0.24, dmg: 1.45, range: 124, knock: 230, stun: 0.26, h: 56 },
      uppercut: { start: 0.12, active: 0.14, rec: 0.28, dmg: 1.7, range: 92, knock: 80, stun: 0.34, h: 150, launch: 520 },
      special: { start: 0.16, active: 0.16, rec: 0.3, dmg: 2.15, range: 138, knock: 290, stun: 0.32, h: 86 },
    };

    function dist(a, b) {
      return Math.abs(a.x - b.x);
    }

    function otherOf(f) {
      if (!fight) return null;
      return f === fight.p ? fight.e : fight.p;
    }

    function tryHit(att, move, kind) {
      const defn = otherOf(att);
      if (!defn || defn.dead || att.hitOnce) return;
      const range = move.range + (att.def.scale || 1) * 10;
      const dx = (defn.x - att.x) * att.facing;
      if (dx < 18 || dx > range) return;
      const dy = Math.abs(att.y - defn.y);
      if (dy > move.h + 40) return;
      att.hitOnce = true;
      const blocked = defn.blocking && defn.y === 0 && defn.state !== "hurt" && defn.state !== "ko";
      let dmg = att.atk * move.dmg;
      dmg /= Math.max(0.7, defn.defense);
      if (att.armor > 0) dmg *= 1.1;
      if (blocked) {
        dmg *= defn.blockMul;
        defn.meter = Math.min(100, defn.meter + 6);
        A.play("block");
        burst((att.x + defn.x) / 2, GROUND - 110, "#d4a017", 8, 180);
        addShake(0.12);
        if (defn.isPlayer && skillRank("iceveil") && Math.random() < 0.35) {
          att.freeze = 0.7;
          floater(att.x, GROUND - 180, "FREEZE", "#7ecbff");
          A.play("ice");
        }
        defn.vx += att.facing * 40;
        return;
      }
      if (defn.invuln > 0) {
        floater(defn.x, GROUND - 170, "MISS", "#9a8f7c");
        return;
      }
      dmg = Math.round(dmg);
      defn.hp = Math.max(0, defn.hp - dmg);
      defn.flash = 0.12;
      defn.stun = move.stun;
      defn.freeze = Math.max(0, defn.freeze - 0.1);
      defn.setState("hurt");
      defn.vx = att.facing * move.knock;
      defn.vy = move.launch ? -move.launch : defn.y < 0 ? -80 : 0;
      att.meter = Math.min(100, att.meter + 10 * (att.isPlayer ? playerStats().meterGain : 1));
      defn.meter = Math.min(100, defn.meter + 4);
      att.combo = (att.comboT > 0 ? att.combo : 0) + 1;
      att.comboT = 0.9;
      const col = ELEMENTS[att.def.element]?.color || "#fff";
      burst((att.x + defn.x) / 2, GROUND + Math.min(0, defn.y) - 120, col, 16, 340);
      floater(defn.x, GROUND - 160 + defn.y, String(dmg), att.combo > 1 ? "#d4a017" : "#f3ead8");
      if (att.combo > 1) floater(att.x, GROUND - 210, att.combo + " HIT", "#c41e3a");
      if (kind === "kick") A.play("kickhit");
      else if (kind === "special") A.play(ELEMENTS[att.def.element]?.sfx || "hit");
      else A.play("punchhit");
      addShake(0.22 + Math.min(0.3, dmg / 80));
      addHitstop(0.045 + Math.min(0.07, dmg / 200));
      applyOnHit(att, defn, kind);
      if (defn.hp <= 0) ko(defn, att);
    }

    function applyOnHit(att, defn, kind) {
      const el = att.def.element;
      if (kind === "special") {
        if (el === "fire" || (att.isPlayer && skillRank("firepalm"))) defn.burn = 2.4;
        if (el === "ice") defn.freeze = 1.1;
        if (el === "lightning") defn.stun = Math.max(defn.stun, 0.55);
        if (el === "poison") defn.poison = 3.2;
        if (el === "blood" || att.def.specialType === "drain") {
          att.hp = Math.min(att.maxHp, att.hp + 10);
          floater(att.x, GROUND - 200, "+HP", "#ff2d4a");
        }
      }
      if (kind === "kick" && att.isPlayer && skillRank("thunder") && Math.random() < 0.4) {
        defn.stun = Math.max(defn.stun, 0.45);
        A.play("lightning");
        floater(defn.x, GROUND - 200, "STUN", "#ffe566");
      }
    }

    function ko(loser, winner) {
      loser.dead = true;
      loser.setState("ko");
      loser.vy = -420;
      loser.vx = winner.facing * 340;
      A.play("ko");
      addShake(0.7);
      addHitstop(0.18);
      burst(loser.x, GROUND - 100, ELEMENTS[winner.def.element]?.color || "#c41e3a", 40, 520);
      fight.over = true;
      fight.winner = winner.isPlayer ? "p" : "e";
      fight.overT = 0;
      if (fight.winner === "e" && !fight.continued) fight.offerContinue = true;
    }

    function spawnProjectile(owner, type) {
      const el = ELEMENTS[owner.def.element];
      const meteor = type === "meteor";
      const tgt = otherOf(owner);
      projectiles.push({
        x: meteor && tgt ? tgt.x : owner.x + owner.facing * 50,
        y: meteor ? 70 : GROUND - 120 + owner.y,
        vx: meteor ? 0 : owner.facing * 420,
        vy: meteor ? 260 : -20,
        owner,
        life: meteor ? 1.8 : 1.4,
        r: meteor ? 26 : 12,
        color: el.color,
        dmg: owner.atk * (meteor ? 2.4 : 1.3),
        type,
      });
    }

    function doSpecial(f) {
      const cost = f.meter >= 100 && f.isPlayer && skillRank("meteor") ? 100 : 38;
      if (f.meter < 38) return;
      const superM = cost === 100;
      f.meter -= superM ? 100 : 38;
      f.setState("special");
      const sfx = ELEMENTS[f.def.element]?.sfx || "special";
      A.play(sfx);
      if (superM) A.play("special");
      const t = superM ? "meteor" : f.def.specialType;
      f.specialKind = t;
      burst(f.x, GROUND - 80, ELEMENTS[f.def.element].color, 12, 200);
      if (t === "dash" || t === "shadowStep") {
        f.invuln = 0.28;
        f.vx = f.facing * (t === "shadowStep" ? 900 : 720);
        f.dashT = 0.22;
      }
      if (t === "fireball" || t === "meteor") spawnProjectile(f, t === "meteor" ? "meteor" : "orb");
      if (t === "armor") f.armor = 2.5;
      if (t === "pull") {
        const o = otherOf(f);
        if (o) o.vx += Math.sign(f.x - o.x) * 420;
      }
    }

    function wantAttack(f, kind) {
      if (f.dead || f.stun > 0 || f.freeze > 0) return;
      if (f.state === "hurt" || f.state === "ko") return;
      if (kind === "special") {
        if (!f.busy() || f.state === "idle" || f.state === "walk") doSpecial(f);
        return;
      }
      if (f.busy() && !(f.state === "punch" && kind === "punch" && f.stateT > 0.18 && f.hitOnce && f.combo < 3)) {
        if (f.state === "punch" && kind === "kick" && f.hitOnce && f.stateT > 0.16) {
          f.setState("kick");
          A.play("kickswing");
          return;
        }
        return;
      }
      if (kind === "punch" && f.isPlayer && skillRank("uppercut") && (keys.jump || f.y < -20)) {
        f.setState("uppercut");
        A.play("punchswing");
        return;
      }
      f.setState(kind);
      A.play(kind === "kick" ? "kickswing" : "punchswing");
    }

    function tryDash(f, dir) {
      if (!f.isPlayer || !skillRank("dash")) return;
      const now = performance.now() / 1000;
      if (f.lastDirTap.dir === dir && now - f.lastDirTap.t < 0.28 && !f.busy()) {
        f.setState("dash");
        f.invuln = 0.2;
        f.vx = dir * 780 * f.spd;
        f.dashT = 0.18;
        A.play("dash");
      }
      f.lastDirTap = { t: now, dir };
    }

    function updateFighter(f, dt) {
      const o = otherOf(f);
      if (f.invuln > 0) f.invuln -= dt;
      if (f.stun > 0) f.stun -= dt;
      if (f.freeze > 0) f.freeze -= dt;
      if (f.armor > 0) f.armor -= dt;
      if (f.flash > 0) f.flash -= dt;
      if (f.comboT > 0) {
        f.comboT -= dt;
        if (f.comboT <= 0) f.combo = 0;
      }
      if (f.burn > 0) {
        f.burn -= dt;
        if (((f.burn * 10) | 0) !== (((f.burn + dt) * 10) | 0)) {
          f.hp = Math.max(1, f.hp - 1.2);
          burst(f.x, GROUND - 100 + f.y, "#ff5a1f", 3, 80);
        }
      }
      if (f.poison > 0) {
        f.poison -= dt;
        if (((f.poison * 8) | 0) !== (((f.poison + dt) * 8) | 0)) {
          f.hp = Math.max(1, f.hp - 1);
        }
      }

      const frozen = f.freeze > 0;
      const slow = frozen ? 0.45 : 1;
      f.anim += dt * (frozen ? 6 : 12);
      f.stateT += dt;
      f.ghostT -= dt;
      if (["punch", "kick", "special", "dash", "uppercut"].includes(f.state) && f.ghostT <= 0) {
        f.ghostT = 0.045;
        const pick = sheetFor(f);
        f.ghosts.push({
          x: f.x + f.facing * f.lunge,
          y: f.y,
          key: pick.key,
          fr: pick.fr,
          facing: f.facing,
          t: 0.16,
        });
        if (f.ghosts.length > 5) f.ghosts.shift();
      }
      for (let i = f.ghosts.length - 1; i >= 0; i--) {
        f.ghosts[i].t -= dt;
        if (f.ghosts[i].t <= 0) f.ghosts.splice(i, 1);
      }

      if (f.state === "ko") {
        f.koT += dt;
        f.vy += GRAVITY * dt;
        f.y += f.vy * dt;
        f.x += f.vx * dt;
        f.vx *= 0.98;
        if (f.y > 0) {
          f.y = 0;
          f.vy = 0;
        }
        f.x = clamp(f.x, 90, W - 90);
        return;
      }

      if (f.state === "hurt") {
        f.vy += GRAVITY * dt;
        f.y += f.vy * dt;
        f.x += f.vx * dt * 0.9;
        f.vx *= 0.86;
        if (f.y > 0) {
          f.y = 0;
          f.vy = 0;
        }
        if (f.stateT > 0.28 + f.stun * 0.15) f.setState("idle");
        f.x = clamp(f.x, 90, W - 90);
        return;
      }

      f.blocking = !f.busy() && f.y === 0 && (f.isPlayer ? !!(keys.block || keys.down) : f._aiBlock);

      if (f.state === "dash") {
        f.x += f.vx * dt;
        f.vx *= 0.9;
        if (f.stateT > 0.2) f.setState("idle");
        f.x = clamp(f.x, 90, W - 90);
        return;
      }

      if (["punch", "kick", "special", "uppercut"].includes(f.state)) {
        const mv = MOVES[f.state] || MOVES.special;
        const lungePeak = f.state === "special" ? 90 : 55;
        if (f.stateT < mv.start) f.lunge = lerp(f.lunge, 10, 0.2);
        else if (f.stateT < mv.start + mv.active) f.lunge = lerp(f.lunge, lungePeak, 0.45);
        else f.lunge = lerp(f.lunge, 0, 0.2);
        if (f.stateT >= mv.start && f.stateT < mv.start + mv.active) {
          if (f.state === "special" && (f.specialKind === "fireball" || f.specialKind === "meteor")) {
            /* projectile handles hit */
          } else if (f.state === "special" && f.specialKind === "whirlwind") {
            attWhirl(f, dt);
          } else {
            tryHit(f, mv, f.state === "uppercut" ? "punch" : f.state);
          }
          if (f.state === "special" && f.specialKind === "clone" && f.stateT > mv.start + 0.04 && !f._cloneHit) {
            f._cloneHit = true;
            const saved = f.x;
            f.x += f.facing * 70;
            tryHit(f, mv, "special");
            f.x = saved;
            f.hitOnce = false;
          }
        } else {
          f._cloneHit = false;
        }
        if (f.state === "uppercut" && f.stateT > 0.1 && f.y === 0) f.vy = -520;
        f.vy += GRAVITY * dt;
        f.y += f.vy * dt;
        if (f.y > 0) {
          f.y = 0;
          f.vy = 0;
        }
        f.x += f.vx * dt;
        f.vx *= 0.8;
        if (f.stateT > mv.start + mv.active + mv.rec) f.setState("idle");
        f.x = clamp(f.x, 90, W - 90);
        return;
      }

      if (f.isPlayer && f.stun <= 0 && !frozen) {
        let ax = 0;
        if (keys.left) ax -= 1;
        if (keys.right) ax += 1;
        const spd = 240 * f.spd * slow;
        f.vx = ax * spd;
        if (ax) f.facing = ax > 0 ? 1 : -1;
        if (keys.jump && f.y === 0) {
          f.vy = -f.jumpV;
          A.play("jump");
        }
        if (ax && f.y === 0) {
          f.setState("walk");
          f.stepT -= dt;
          if (f.stepT <= 0) {
            f.stepT = 0.28;
            A.play("step");
          }
        } else if (f.y === 0) f.setState(f.blocking ? "block" : "idle");
        else if (!f.busy()) f.setState("idle");
      }

      const wasAir = f.y < -2;
      f.vy += GRAVITY * dt;
      f.y += f.vy * dt;
      f.x += f.vx * dt * slow;
      if (f.y > 0) {
        if (wasAir && f.vy > 380) A.play("land");
        f.y = 0;
        f.vy = 0;
      }
      f.x = clamp(f.x, 90, W - 90);
      if (o) {
        const gap = 96 * ((f.def.scale || 1) + (o.def.scale || 1)) * 0.5;
        if (Math.abs(f.x - o.x) < gap && Math.abs(f.y - o.y) < 80) {
          const push = (gap - Math.abs(f.x - o.x)) * 0.5;
          f.x += f.x < o.x ? -push : push;
        }
        if (Math.abs(f.x - o.x) > 8) f.facing = f.x < o.x ? 1 : -1;
      }
    }

    function attWhirl(f, dt) {
      f._whirl = (f._whirl || 0) + dt;
      if (f._whirl > 0.08) {
        f._whirl = 0;
        f.hitOnce = false;
        tryHit(f, { ...MOVES.special, dmg: 0.7, range: 140 }, "special");
      }
    }

    function updateAI(e, p, dt) {
      if (e.dead || (e.busy() && e.state !== "walk")) return;
      if (e.stun > 0 || e.freeze > 0) return;
      e.think -= dt;
      const d = dist(e, p);
      const lvl = fight.level;
      const react = Math.max(0.08, 0.42 - lvl * 0.005);
      e._aiBlock = false;
      if (e.think > 0 && e.state !== "walk") {
        /* keep moving with last vx */
      } else {
        e.think = react + Math.random() * 0.12;
        const style = e.def.ai;
        const inAtk = p.state === "punch" || p.state === "kick" || p.state === "special";
        if ((style === "counter" || style === "boss") && inAtk && d < 140 && e.y === 0) {
          e._aiBlock = true;
          e.vx = 0;
        } else if (e.meter >= 38 && (style === "boss" || d < 160 || Math.random() < 0.2 + lvl * 0.004)) {
          doSpecial(e);
        } else if (d < 100) {
          if (Math.random() < 0.55) wantAttack(e, Math.random() < 0.55 ? "punch" : "kick");
          else if (style === "zoner") e.vx = -e.facing * 180 * e.spd;
          else e.vx = e.facing * 40;
        } else if (d < 220) {
          if (style === "zoner" && Math.random() < 0.4) wantAttack(e, "kick");
          else e.vx = e.facing * 210 * e.spd;
        } else {
          e.vx = e.facing * 230 * e.spd;
          if (style === "rusher" && Math.random() < 0.08) e.vy = -580;
        }
        if (style === "boss" && p.y < -40 && d < 120) wantAttack(e, "kick");
      }
      if (!e.busy()) {
        if (Math.abs(e.vx) > 20 && e.y === 0) e.setState("walk");
        else if (e.y === 0 && e._aiBlock) e.setState("block");
        else if (e.y === 0 && e.state === "walk") e.setState("idle");
      }
    }

    function updateProjectiles(dt) {
      for (let i = projectiles.length - 1; i >= 0; i--) {
        const pr = projectiles[i];
        pr.life -= dt;
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        if (pr.type === "meteor") pr.vy += 900 * dt;
        const tgt = pr.owner === fight.p ? fight.e : fight.p;
        if (tgt && !tgt.dead && Math.abs(pr.x - tgt.x) < 50 && Math.abs(pr.y - (GROUND - 110 + tgt.y)) < 70) {
          const saved = pr.owner.hitOnce;
          pr.owner.hitOnce = false;
          const oldAtk = pr.owner.atk;
          pr.owner.atk = pr.dmg;
          tryHit(pr.owner, { start: 0, active: 1, rec: 0, dmg: 1, range: 999, knock: 240, stun: 0.3, h: 200 }, "special");
          pr.owner.atk = oldAtk;
          pr.owner.hitOnce = saved;
          burst(pr.x, pr.y, pr.color, 18, 300);
          projectiles.splice(i, 1);
          continue;
        }
        if (pr.life <= 0 || pr.x < -40 || pr.x > W + 40 || pr.y > GROUND + 20) projectiles.splice(i, 1);
      }
    }

    function startFight(level) {
      const def = scaledEnemy(ROSTER[level - 1]);
      const hero = {
        id: 0,
        name: save.name || "Riven",
        title: "Shadow Disciple",
        sprite: "player",
        spriteDir: 1,
        hue: 0,
        sat: 1,
        bright: 1,
        scale: 1,
        element: skillRank("firepalm") ? "fire" : "shadow",
        special: skillRank("meteor") ? "Umbra Super" : "Shadow Burst",
        specialType: skillRank("meteor") ? "meteor" : "dash",
        hp: playerStats().hp,
        atk: playerStats().atk,
        spd: playerStats().spd,
        def: 1,
        arena: def.arena,
      };
      fight = {
        level,
        p: new Fighter(hero, true),
        e: new Fighter(def, false),
        time: 99,
        over: false,
        overT: 0,
        winner: null,
        intro: 1.1,
        arena: def.arena || "dojo",
        perfect: true,
        continued: false,
        offerContinue: false,
        healed: false,
      };
      projectiles = [];
      particles = [];
      floaters = [];
      shake = 0;
      go("vs");
    }

    function endFight() {
      const win = fight.winner === "p";
      const tLeft = Math.max(0, fight.time);
      let coins = win ? 40 + fight.level * 8 + Math.round(tLeft) : 12;
      if (win && fight.perfect) coins += 40;
      if (win && fight.level === 50) coins += 200;
      save.coins += coins;
      if (win) {
        save.level = Math.max(save.level, Math.min(50, fight.level + 1));
        save.unlocked = Math.max(save.unlocked, Math.min(50, fight.level + 1));
      }
      persist();
      result = {
        win,
        coins,
        level: fight.level,
        enemy: fight.e.def,
        perfect: fight.perfect,
        hp: Math.round((fight.p.hp / fight.p.maxHp) * 100),
        adClaimed: false,
      };
      A.play(win ? "win" : "lose");
      go("result");
    }

    function revivePlayer() {
      if (!fight || fight.continued) return;
      fight.continued = true;
      fight.offerContinue = false;
      fight.over = false;
      fight.winner = null;
      fight.overT = 0;
      const p = fight.p;
      p.dead = false;
      p.hp = Math.round(p.maxHp * 0.45);
      p.meter = Math.max(p.meter, 40);
      p.invuln = 1.2;
      p.vx = 0;
      p.vy = 0;
      p.y = 0;
      p.setState("idle");
      A.play("revive");
      burst(p.x, GROUND - 120, "#d4a017", 28, 380);
      floater(p.x, GROUND - 200, "SECOND WIND", "#d4a017");
    }

    function watchAd(kind) {
      if (adBusy || !Ads) return;
      adBusy = true;
      const specs = {
        coins: {
          title: "Shadow Offering",
          body: "A brief offering grants 80 shadow coins.",
          skipLabel: "NO THANKS",
          apply: () => {
            save.coins += 80;
            persist();
            A.play("coin");
            if (result) result.adClaimed = true;
          },
        },
        bonus: {
          title: "Victor's Tithe",
          body: "Watch an offering for +50 bonus coins.",
          skipLabel: "SKIP",
          apply: () => {
            save.coins += 50;
            persist();
            A.play("coin");
            if (result) result.adClaimed = true;
          },
        },
        life: {
          title: "Rise Again",
          body: "A shadow offering restores your life this gate.",
          skipLabel: "GIVE UP",
          apply: () => revivePlayer(),
        },
        heal: {
          title: "Blood Tithe",
          body: "Watch an offering to restore 40 health.",
          skipLabel: "NOT NOW",
          apply: () => {
            if (fight && fight.p && !fight.p.dead) {
              fight.p.hp = Math.min(fight.p.maxHp, fight.p.hp + 40);
              fight.healed = true;
              A.play("revive");
              burst(fight.p.x, GROUND - 120, "#d4a017", 18, 280);
              floater(fight.p.x, GROUND - 200, "+40 HP", "#d4a017");
            }
          },
        },
      };
      const spec = specs[kind] || specs.coins;
      Ads.showRewarded({
        title: spec.title,
        body: spec.body,
        skipLabel: spec.skipLabel,
        onReward: () => {
          adBusy = false;
          spec.apply();
        },
        onSkip: () => {
          adBusy = false;
          if (kind === "life" && fight && fight.offerContinue) {
            fight.offerContinue = false;
            endFight();
          }
        },
      });
    }

    function updateFight(dt) {
      if (paused) return;
      if (fight.intro > 0) {
        fight.intro -= dt;
        return;
      }
      if (hitstop > 0) {
        hitstop -= dt;
        return;
      }
      if (fight.offerContinue) {
        fight.overT += dt;
        return;
      }
      if (!fight.over) fight.time = Math.max(0, fight.time - dt);
      if (!fight.over && fight.time <= 0) {
        fight.over = true;
        fight.winner = fight.p.hp >= fight.e.hp ? "p" : "e";
        fight.overT = 0;
        A.play("ko");
        if (fight.winner === "e" && !fight.continued) fight.offerContinue = true;
      }
      updateFighter(fight.p, dt);
      updateAI(fight.e, fight.p, dt);
      updateFighter(fight.e, dt);
      updateProjectiles(dt);
      if (fight.p.hp < fight.p.maxHp - 0.5) fight.perfect = false;
      if (fight.over && !fight.offerContinue) {
        fight.overT += dt;
        if (fight.overT > 2.2) endFight();
      }
    }

    function updateFx(dt) {
      bgTime += dt;
      shake = Math.max(0, shake - dt * 1.8);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 420 * dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.life -= dt;
        f.y += f.vy * dt;
        if (f.life <= 0) floaters.splice(i, 1);
      }
      for (let i = 0; i < ambients.length; i++) {
        const p = ambients[i];
        p.x += p.vx * p.z * dt;
        p.y += p.vy * p.z * dt;
        if (p.spin != null) p.spin += p.spinV * dt;
        if (p.kind === "fog") {
          if (p.x > W + p.r) p.x = -p.r;
          if (p.x < -p.r) p.x = W + p.r;
          continue;
        }
        if (p.y > H + 20 || p.x < -40 || p.x > W + 40 || p.y < -80) {
          const kind = p.kind;
          ambients[i] = makeAmbient(kind, false);
          if (kind === "ember") ambients[i].y = H + 10;
        }
      }
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawBg(key) {
      const img = assets.images[key] || assets.images.dojo;
      const pan = fight
        ? ((fight.p.x + fight.e.x) / 2 - W / 2) * 0.08 + Math.sin(bgTime * 0.22) * 10
        : Math.sin(bgTime * 0.22) * 46;
      const bob = Math.sin(bgTime * 0.27) * 14;
      const zoom = 1.16 + Math.sin(bgTime * 0.13) * 0.045;
      const dw = W * zoom;
      const dh = H * zoom;
      const dx = (W - dw) / 2 + pan;
      const dy = (H - dh) / 2 + bob;
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, dx, dy, dw, dh);
      } else {
        ctx.fillStyle = "#120c14";
        ctx.fillRect(0, 0, W, H);
      }
      const pulse = 0.5 + Math.sin(bgTime * 2.1) * 0.5;
      ctx.fillStyle = "rgba(196,30,58," + (0.04 + pulse * 0.04) + ")";
      ctx.beginPath();
      ctx.arc(170, 310, 46 + pulse * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(1110, 300, 46 + pulse * 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(0, GROUND - 8, W, H - GROUND + 8);
      ctx.fillStyle = "rgba(243,234,216," + (0.03 + Math.sin(bgTime) * 0.015) + ")";
      ctx.fillRect(0, GROUND - 4, W, 3);
      drawAmbients();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(7,6,10,0.2)");
      g.addColorStop(0.55, "rgba(7,6,10,0)");
      g.addColorStop(1, "rgba(7,6,10,0.32)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    function drawAmbients() {
      for (let i = 0; i < ambients.length; i++) {
        const p = ambients[i];
        ctx.save();
        ctx.globalAlpha = 0.35 + p.z * 0.4;
        if (p.kind === "rain") {
          ctx.strokeStyle = "rgba(180,200,220,0.55)";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.02, p.y - p.len);
          ctx.stroke();
        } else if (p.kind === "fog") {
          ctx.fillStyle = "rgba(220,210,200,0.07)";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.r, p.r * 0.22, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "snow") {
          ctx.fillStyle = "#e8f4ff";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "ember") {
          ctx.fillStyle = Math.random() > 0.5 ? "#ff5a1f" : "#d4a017";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === "ash") {
          ctx.fillStyle = "rgba(200,190,180,0.7)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.translate(p.x, p.y);
          ctx.rotate(p.spin || 0);
          ctx.fillStyle = "rgba(196, 80, 90, 0.72)";
          ctx.beginPath();
          ctx.ellipse(0, 0, p.r, p.r * 0.45, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    function fighterDrawScale(f) {
      const personality = Math.max(0.98, Math.min(1.24, f.def.scale || 1));
      return 0.86 * personality;
    }

    function artFace(sprite) {
      return SPRITE_FACE[sprite] || -1;
    }

    function sheetFor(f) {
      const map = COMBAT_SHEET[f.def.sprite] || COMBAT_SHEET.ronin;
      const st = f.state;
      if (st === "walk") {
        if (f.def.sprite === "player" && assets.images.playerWalk) {
          return { key: "playerWalk", fr: (f.anim * 0.7 | 0) % 4 };
        }
        return { key: f.def.sprite, fr: (f.anim | 0) % 4 };
      }
      if (st === "jump" || (st === "idle" && f.y < -8)) {
        return { key: f.def.sprite === "player" ? "playerPunch" : f.def.sprite, fr: 0 };
      }
      if (map[st]) {
        const key = map[st];
        let fr = 0;
        if (st === "hurt" || st === "ko") {
          if (f.def.sprite === "player") {
            fr = st === "ko" ? 3 : clamp((f.stateT * 10) | 0, 0, 3);
          } else {
            fr = 2 + (f.stateT > 0.14 ? 1 : 0);
          }
        } else {
          const mv = MOVES[st] || MOVES.punch;
          if (f.stateT < mv.start * 0.5) fr = 0;
          else if (f.stateT < mv.start) fr = 1;
          else if (f.stateT < mv.start + mv.active) fr = 2;
          else fr = 3;
        }
        return { key, fr };
      }
      const idleKey = f.def.sprite;
      const fr = st === "block" ? 0 : (f.anim * 0.5 | 0) % 4;
      return { key: idleKey, fr };
    }

    function drawFighter(f) {
      const pick = sheetFor(f);
      const img = assets.images[pick.key] || assets.images[f.def.sprite];
      const cell = 384;
      const fr = clamp(pick.fr | 0, 0, 3);
      const col = fr % 2;
      const row = (fr / 2) | 0;
      const scale = fighterDrawScale(f);
      let w = cell * scale;
      let h = cell * scale;
      if (f.state === "punch" || f.state === "kick" || f.state === "special" || f.state === "uppercut") {
        const mv = MOVES[f.state] || MOVES.punch;
        if (f.stateT >= mv.start && f.stateT < mv.start + mv.active) {
          w *= 1.06;
          h *= 0.96;
        } else if (f.stateT < mv.start) {
          w *= 0.96;
          h *= 1.04;
        }
      }
      if (f.y < -10) h *= 1.04;
      const bob = f.state === "walk" ? Math.sin(f.anim * 2.2) * 4 : f.state === "idle" ? Math.sin(f.anim * 0.9) * 2 : 0;
      const x = f.x + f.facing * f.lunge;
      const y = GROUND + f.y + bob;
      const sw = img && img.naturalWidth >= cell * 2 ? cell : (img && img.naturalWidth / 2) || cell;
      const sh = img && img.naturalHeight >= cell * 2 ? cell : (img && img.naturalHeight / 2) || cell;

      for (let i = 0; i < f.ghosts.length; i++) {
        const g = f.ghosts[i];
        const gimg = assets.images[g.key] || img;
        if (!gimg || !gimg.complete) continue;
        const gc = clamp(g.fr | 0, 0, 3);
        ctx.save();
        ctx.globalAlpha = clamp(g.t / 0.16, 0, 1) * 0.32;
        ctx.translate(g.x, GROUND + g.y + bob);
        ctx.scale(g.facing * artFace(f.def.sprite), 1);
        ctx.filter = `hue-rotate(${f.def.hue || 0}deg)`;
        ctx.drawImage(gimg, (gc % 2) * sw, ((gc / 2) | 0) * sh, sw, sh, -w / 2, -h + 18, w, h);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(x, y);
      const sx = f.facing * artFace(f.def.sprite);
      ctx.scale(sx, 1);
      if (f.invuln > 0 && ((performance.now() / 80) | 0) % 2 === 0) ctx.globalAlpha = 0.45;
      if (f.flash > 0) ctx.filter = "brightness(2.2) saturate(0.4)";
      else if (f.freeze > 0) ctx.filter = `hue-rotate(${f.def.hue || 0}deg) saturate(0.6) brightness(1.3)`;
      else ctx.filter = `hue-rotate(${f.def.hue || 0}deg) saturate(${f.def.sat || 1}) brightness(${f.def.bright || 1})`;
      ctx.shadowColor = ELEMENTS[f.def.element]?.color || "#c41e3a";
      ctx.shadowBlur = f.state === "special" || f.armor > 0 ? 28 : 10;
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, col * sw, row * sh, sw, sh, -w / 2, -h + 18, w, h);
      } else {
        ctx.fillStyle = "#c41e3a";
        ctx.fillRect(-40, -160, 80, 160);
      }
      ctx.restore();

      if (["punch", "kick", "special", "uppercut"].includes(f.state)) {
        const mv = MOVES[f.state] || MOVES.punch;
        if (f.stateT >= mv.start && f.stateT < mv.start + mv.active) {
          const colr = ELEMENTS[f.def.element]?.color || "#f3ead8";
          const reach = (f.state === "kick" ? 118 : f.state === "special" ? 130 : 92) * scale;
          ctx.save();
          ctx.strokeStyle = colr;
          ctx.globalAlpha = 0.45;
          ctx.lineWidth = f.state === "kick" ? 7 : 5;
          ctx.beginPath();
          ctx.arc(x + f.facing * 10, y - h * 0.45, reach * 0.42, f.facing > 0 ? -0.9 : Math.PI - 0.4, f.facing > 0 ? 0.5 : Math.PI + 0.9);
          ctx.stroke();
          ctx.restore();
        }
      }

      ctx.save();
      ctx.translate(x, GROUND + 8);
      ctx.scale(1, 0.28);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.arc(0, 0, 56 * (f.def.scale || 1), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (f.blocking) {
        ctx.save();
        ctx.strokeStyle = "rgba(212,160,23,0.7)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + f.facing * 20, y - 110, 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    function bar(x, y, w, h, t, col, back) {
      roundRect(x, y, w, h, 6);
      ctx.fillStyle = back || "rgba(0,0,0,0.55)";
      ctx.fill();
      const ww = Math.max(0, w * clamp(t, 0, 1));
      if (ww > 2) {
        roundRect(x, y, ww, h, 6);
        ctx.fillStyle = col;
        ctx.fill();
      }
    }

    function drawHUD() {
      const p = fight.p;
      const e = fight.e;
      bar(52, 58, 420, 18, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? "#c41e3a" : "#c41e3a", "rgba(0,0,0,0.5)");
      bar(W - 472, 58, 420, 18, e.hp / e.maxHp, "#6b1a9a", "rgba(0,0,0,0.5)");
      bar(52, 80, 220, 8, p.meter / 100, "#d4a017");
      bar(W - 272, 80, 220, 8, e.meter / 100, "#d4a017");
      ctx.font = "700 14px Cinzel, serif";
      ctx.fillStyle = "#f3ead8";
      ctx.textAlign = "left";
      ctx.fillText(p.def.name, 54, 52);
      ctx.textAlign = "right";
      ctx.fillText(e.def.name, W - 54, 52);
      ctx.textAlign = "center";
      ctx.font = "800 22px Cinzel, serif";
      ctx.fillStyle = "#d4a017";
      ctx.fillText(String(Math.ceil(fight.time)).padStart(2, "0"), W / 2, 74);
      if (paused) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center";
        ctx.fillStyle = "#f3ead8";
        ctx.font = "800 48px Cinzel, serif";
        ctx.fillText("PAUSED", W / 2, 300);
      }
      if (fight.intro > 0) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center";
        ctx.fillStyle = "#c41e3a";
        ctx.font = "800 72px Cinzel, serif";
        ctx.fillText("FIGHT", W / 2, 360);
      }
      if (fight.offerContinue) {
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center";
        ctx.fillStyle = "#c41e3a";
        ctx.font = "800 64px Cinzel, serif";
        ctx.fillText("YOU FALL", W / 2, 250);
        ctx.fillStyle = "#f3ead8";
        ctx.font = "700 24px Barlow Condensed, sans-serif";
        ctx.fillText("Watch an offering to rise with half life", W / 2, 310);
      } else if (fight.over) {
        ctx.textAlign = "center";
        ctx.font = "800 84px Cinzel, serif";
        ctx.fillStyle = fight.winner === "p" ? "#d4a017" : "#c41e3a";
        ctx.fillText("K.O.", W / 2, 340);
        ctx.font = "700 28px Barlow Condensed, sans-serif";
        ctx.fillStyle = "#f3ead8";
        ctx.fillText(fight.winner === "p" ? "YOU WIN" : "YOU FALL", W / 2, 390);
      }
    }

    function uiBtn(x, y, w, h, label, fn, opts) {
      opts = opts || {};
      buttons.push({ x, y, w, h, fn });
      const hover = pointer.x >= x && pointer.x <= x + w && pointer.y >= y && pointer.y <= y + h;
      ctx.save();
      roundRect(x, y, w, h, opts.r || 10);
      ctx.fillStyle = hover ? "rgba(196,30,58,0.85)" : opts.fill || "rgba(10,8,12,0.72)";
      ctx.fill();
      ctx.strokeStyle = hover ? "#d4a017" : "rgba(212,160,23,0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#f3ead8";
      ctx.font = opts.font || "700 22px Barlow Condensed, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + w / 2, y + h / 2 + 1);
      ctx.restore();
      if (hover && pointer.clicked) {
        A.play("ui");
        fn();
      }
    }

    function drawBoot(dt) {
      bootPulse += dt;
      drawBg("title");
      ctx.fillStyle = "rgba(7,6,10,0.35)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#d4a017";
      ctx.font = "700 18px Barlow Condensed, sans-serif";
      ctx.fillText("FIFTY GATES  ·  ONE SHADOW", W / 2, 210);
      ctx.fillStyle = "#f3ead8";
      ctx.font = "800 86px Cinzel, serif";
      ctx.fillText("UMBRA FIGHT", W / 2, 300);
      ctx.font = "600 20px Barlow Condensed, sans-serif";
      ctx.fillStyle = "rgba(243,234,216," + (0.45 + Math.sin(bootPulse * 3) * 0.35) + ")";
      ctx.fillText("TAP OR PRESS ENTER TO BEGIN", W / 2, 470);
      if (pointer.clicked || keys.enter || keys.punch) {
        keys.enter = false;
        A.unlock();
        A.play("ui2");
        go("loading");
      }
    }

    function drawLoading() {
      drawBg("title");
      ctx.fillStyle = "rgba(7,6,10,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#d4a017";
      ctx.font = "800 40px Cinzel, serif";
      ctx.fillText("Forging the gates…", W / 2, 280);
      bar(W / 2 - 220, 320, 440, 16, loadProg, "#c41e3a");
      ctx.fillStyle = "#9a8f7c";
      ctx.font = "600 18px Barlow Condensed, sans-serif";
      ctx.fillText(tip, W / 2, 380);
      ctx.fillText(Math.round(loadProg * 100) + "%", W / 2, 348);
      if (loadProg >= 1) {
        loadProg = 1;
        go("menu");
      }
    }

    function drawMenu() {
      drawBg("title");
      ctx.fillStyle = "rgba(7,6,10,0.42)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f3ead8";
      ctx.font = "800 70px Cinzel, serif";
      ctx.fillText("UMBRA FIGHT", W / 2, 150);
      ctx.fillStyle = "#d4a017";
      ctx.font = "600 18px Barlow Condensed, sans-serif";
      ctx.fillText("Gate " + save.unlocked + " / 50   ·   " + save.coins + " shadow coins", W / 2, 186);
      const cx = W / 2 - 160;
      uiBtn(cx, 230, 320, 54, save.unlocked > 1 ? "CONTINUE  ·  GATE " + save.level : "ENTER THE SHADOW", () =>
        startFight(Math.min(50, save.level || 1)),
      );
      uiBtn(cx, 298, 320, 54, "CHAPTER SELECT", () => go("levels"));
      uiBtn(cx, 366, 320, 54, "SKILLS  &  POWERS", () => go("skills"));
      uiBtn(cx, 434, 320, 54, save.mute ? "SOUND  OFF" : "SOUND  ON", () => {
        save.mute = A.toggleMute();
        persist();
      });
      uiBtn(cx, 502, 320, 54, "WATCH AD  ·  +80 COINS", () => watchAd("coins"));
      ctx.fillStyle = "#9a8f7c";
      ctx.font = "600 16px Barlow Condensed, sans-serif";
      ctx.fillText("A/D move  ·  W jump  ·  S block  ·  J punch  ·  K kick  ·  L special", W / 2, 590);
    }

    function drawSkills() {
      drawBg("dojo");
      ctx.fillStyle = "rgba(7,6,10,0.62)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "left";
      ctx.fillStyle = "#f3ead8";
      ctx.font = "800 40px Cinzel, serif";
      ctx.fillText("Skills", 64, 70);
      ctx.fillStyle = "#d4a017";
      ctx.font = "700 20px Barlow Condensed, sans-serif";
      ctx.fillText(save.coins + " coins", 64, 100);
      SKILLS.forEach((sk, i) => {
        const col = i % 2;
        const row = (i / 2) | 0;
        const x = 64 + col * 580;
        const y = 130 + row * 92;
        const rank = skillRank(sk.id);
        const cost = sk.cost + rank * 40;
        roundRect(x, y, 550, 80, 12);
        ctx.fillStyle = "rgba(12,10,14,0.75)";
        ctx.fill();
        ctx.strokeStyle = "rgba(212,160,23,0.35)";
        ctx.stroke();
        ctx.fillStyle = "#f3ead8";
        ctx.font = "700 22px Cinzel, serif";
        ctx.textAlign = "left";
        ctx.fillText(sk.name, x + 18, y + 32);
        ctx.fillStyle = "#9a8f7c";
        ctx.font = "600 16px Barlow Condensed, sans-serif";
        ctx.fillText(sk.desc, x + 18, y + 56);
        ctx.fillStyle = "#d4a017";
        ctx.fillText(rank + " / " + sk.max, x + 18, y + 74);
        if (rank < sk.max) {
          uiBtn(x + 400, y + 18, 130, 44, cost + "  BUY", () => {
            if (save.coins >= cost && rank < sk.max) {
              save.coins -= cost;
              save.skills[sk.id] = rank + 1;
              persist();
              A.play("ui2");
            } else A.play("hurt");
          });
        } else {
          ctx.fillStyle = "#d4a017";
          ctx.font = "700 16px Barlow Condensed, sans-serif";
          ctx.textAlign = "right";
          ctx.fillText("MASTERED", x + 530, y + 46);
        }
      });
      uiBtn(64, 640, 160, 46, "BACK", () => go("menu"));
      uiBtn(250, 640, 220, 46, "WATCH AD  ·  +80", () => watchAd("coins"));
    }

    function drawLevels() {
      drawBg("throne");
      ctx.fillStyle = "rgba(7,6,10,0.6)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "left";
      ctx.fillStyle = "#f3ead8";
      ctx.font = "800 40px Cinzel, serif";
      ctx.fillText("Fifty Gates", 64, 64);
      const chapters = ["Street Shadows", "Frozen Temple", "Neon Rain", "Inferno Path", "Umbra Court"];
      ctx.fillStyle = "#d4a017";
      ctx.font = "700 20px Barlow Condensed, sans-serif";
      ctx.fillText(chapters[levelPage] + "  ·  " + (levelPage * 10 + 1) + "–" + (levelPage * 10 + 10), 64, 96);
      for (let i = 0; i < 10; i++) {
        const id = levelPage * 10 + i + 1;
        const f = ROSTER[id - 1];
        const col = i % 5;
        const row = (i / 5) | 0;
        const x = 70 + col * 230;
        const y = 130 + row * 230;
        const locked = id > save.unlocked;
        roundRect(x, y, 210, 210, 14);
        ctx.fillStyle = locked ? "rgba(10,8,12,0.7)" : "rgba(18,12,16,0.8)";
        ctx.fill();
        ctx.strokeStyle = id % 10 === 0 ? "#d4a017" : "rgba(196,30,58,0.45)";
        ctx.stroke();
        ctx.save();
        ctx.beginPath();
        roundRect(x + 24, y + 16, 162, 120, 8);
        ctx.clip();
        const img = assets.images[f.sprite];
        if (img && img.complete) {
          ctx.filter = `hue-rotate(${f.hue}deg) saturate(${f.sat}) brightness(${locked ? 0.35 : f.bright})`;
          ctx.drawImage(img, 0, 0, 384, 384, x + 24, y + 8, 162, 162);
        }
        ctx.restore();
        ctx.fillStyle = locked ? "#6a6258" : "#f3ead8";
        ctx.font = "700 16px Cinzel, serif";
        ctx.textAlign = "center";
        ctx.fillText(locked ? "???" : f.name, x + 105, y + 158);
        ctx.font = "600 13px Barlow Condensed, sans-serif";
        ctx.fillStyle = ELEMENTS[f.element].color;
        ctx.fillText(locked ? "Locked" : f.special, x + 105, y + 178);
        ctx.fillStyle = "#9a8f7c";
        ctx.fillText("Gate " + id, x + 105, y + 196);
        if (!locked) {
          buttons.push({
            x,
            y,
            w: 210,
            h: 210,
            fn: () => startFight(id),
          });
          if (pointer.clicked && pointer.x >= x && pointer.x <= x + 210 && pointer.y >= y && pointer.y <= y + 210) {
            A.play("ui2");
            startFight(id);
          }
        }
      }
      uiBtn(64, 640, 140, 46, "BACK", () => go("menu"));
      if (levelPage > 0)
        uiBtn(980, 640, 100, 46, "◀", () => {
          levelPage--;
        });
      if (levelPage < 4)
        uiBtn(1090, 640, 100, 46, "▶", () => {
          levelPage++;
        });
    }

    function drawVs() {
      const e = fight.e.def;
      drawBg(fight.arena);
      ctx.fillStyle = "rgba(7,6,10,0.55)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#9a8f7c";
      ctx.font = "700 18px Barlow Condensed, sans-serif";
      ctx.fillText("GATE " + fight.level + "  ·  " + e.chapter, W / 2, 80);
      ctx.fillStyle = "#f3ead8";
      ctx.font = "800 34px Cinzel, serif";
      ctx.fillText(fight.p.def.name, 320, 160);
      ctx.fillText(e.name, 960, 160);
      ctx.font = "600 18px Barlow Condensed, sans-serif";
      ctx.fillStyle = "#d4a017";
      ctx.fillText(fight.p.def.title, 320, 190);
      ctx.fillText(e.title, 960, 190);
      const pImg = assets.images.player;
      const eImg = assets.images[e.sprite];
      if (pImg) {
        ctx.save();
        ctx.filter = "none";
        ctx.drawImage(pImg, 0, 0, 384, 384, 140, 210, 340, 340);
        ctx.restore();
      }
      if (eImg) {
        ctx.save();
        ctx.filter = `hue-rotate(${e.hue}deg) saturate(${e.sat}) brightness(${e.bright})`;
        if (artFace(e.sprite) > 0) {
          ctx.translate(800 + 340, 210);
          ctx.scale(-1, 1);
          ctx.drawImage(eImg, 0, 0, 384, 384, 0, 0, 340, 340);
        } else {
          ctx.drawImage(eImg, 0, 0, 384, 384, 800, 210, 340, 340);
        }
        ctx.restore();
      }
      ctx.fillStyle = "#c41e3a";
      ctx.font = "800 64px Cinzel, serif";
      ctx.fillText("VS", W / 2, 400);
      ctx.fillStyle = "#f3ead8";
      ctx.font = "600 20px Barlow Condensed, sans-serif";
      ctx.fillText('"' + e.quote + '"', W / 2, 560);
      ctx.fillStyle = ELEMENTS[e.element].color;
      ctx.fillText(e.special + "  ·  " + ELEMENTS[e.element].label, W / 2, 590);
    }

    function drawFight() {
      const sx = (Math.random() * 2 - 1) * shake * shake * 14;
      const sy = (Math.random() * 2 - 1) * shake * shake * 10;
      ctx.save();
      ctx.translate(sx, sy);
      drawBg(fight.arena);
      drawFighter(fight.p);
      drawFighter(fight.e);
      projectiles.forEach((pr) => {
        ctx.save();
        ctx.fillStyle = pr.color;
        ctx.shadowColor = pr.color;
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      particles.forEach((p) => {
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      floaters.forEach((f) => {
        ctx.globalAlpha = clamp(f.life / 0.8, 0, 1);
        ctx.fillStyle = f.color;
        ctx.font = "800 22px Barlow Condensed, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
      });
      ctx.restore();
      drawHUD();
      if (fight.offerContinue) {
        ctx.fillStyle = "rgba(7,6,10,0.55)";
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center";
        ctx.fillStyle = "#f3ead8";
        ctx.font = "800 40px Cinzel, serif";
        ctx.fillText("FALLEN", W / 2, 300);
        ctx.fillStyle = "#d4a017";
        ctx.font = "600 18px Barlow Condensed, sans-serif";
        ctx.fillText("Watch an offering to rise with half life", W / 2, 338);
        uiBtn(W / 2 - 170, 360, 340, 54, "WATCH AD  ·  EXTRA LIFE", () => watchAd("life"));
        uiBtn(W / 2 - 170, 430, 340, 54, "GIVE UP", () => {
          fight.offerContinue = false;
          endFight();
        });
      } else if (!paused) {
        uiBtn(W - 120, 80, 80, 36, "PAUSE", () => {
          paused = true;
        }, { font: "700 14px Barlow Condensed, sans-serif" });
        if (fight.p.hp / fight.p.maxHp < 0.35 && !fight.healed && !fight.over) {
          uiBtn(W / 2 - 150, 84, 300, 40, "WATCH AD  ·  +40 HP", () => watchAd("heal"));
        }
      } else {
        uiBtn(W / 2 - 110, 340, 220, 50, "RESUME", () => {
          paused = false;
        });
        uiBtn(W / 2 - 110, 404, 220, 50, "QUIT", () => go("menu"));
      }
    }

    function drawResult() {
      drawBg(result.enemy.arena);
      ctx.fillStyle = "rgba(7,6,10,0.62)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = result.win ? "#d4a017" : "#c41e3a";
      ctx.font = "800 64px Cinzel, serif";
      ctx.fillText(result.win ? "GATE CLEARED" : "DEFEATED", W / 2, 170);
      ctx.fillStyle = "#f3ead8";
      ctx.font = "700 24px Barlow Condensed, sans-serif";
      ctx.fillText((result.win ? "Defeated " : "Fallen to ") + result.enemy.name, W / 2, 220);
      ctx.font = "600 20px Barlow Condensed, sans-serif";
      ctx.fillStyle = "#d4a017";
      ctx.fillText("+" + result.coins + " shadow coins", W / 2, 268);
      if (result.perfect && result.win) ctx.fillText("PERFECT  ·  bonus paid", W / 2, 298);
      ctx.fillStyle = "#9a8f7c";
      ctx.fillText("HP remaining " + result.hp + "%", W / 2, 338);
      if (result.win && result.level < 50) {
        uiBtn(W / 2 - 150, 390, 300, 50, "NEXT GATE", () => startFight(result.level + 1));
      } else if (result.win && result.level === 50) {
        ctx.fillStyle = "#d4a017";
        ctx.font = "800 28px Cinzel, serif";
        ctx.fillText("You are the last shadow.", W / 2, 400);
      } else {
        uiBtn(W / 2 - 150, 390, 300, 50, "RETRY", () => startFight(result.level));
      }
      if (!result.adClaimed) {
        uiBtn(W / 2 - 150, 452, 300, 50, "WATCH AD  ·  +50 COINS", () => watchAd("bonus"));
      }
      uiBtn(W / 2 - 150, 514, 300, 50, "SKILLS", () => go("skills"));
      uiBtn(W / 2 - 150, 576, 300, 50, "MENU", () => go("menu"));
    }

    function render(dt) {
      buttons = [];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (scene === "boot") drawBoot(dt);
      else if (scene === "loading") drawLoading();
      else if (scene === "menu") drawMenu();
      else if (scene === "skills") drawSkills();
      else if (scene === "levels") drawLevels();
      else if (scene === "vs") drawVs();
      else if (scene === "fight") drawFight();
      else if (scene === "result") drawResult();
      if (fade > 0) {
        ctx.fillStyle = "rgba(7,6,10," + fade + ")";
        ctx.fillRect(0, 0, W, H);
      }
    }

    function step(dt) {
      if (fadeDir !== 0) {
        fade += fadeDir * dt * 3.2;
        if (fadeDir > 0 && fade >= 1) {
          fade = 1;
          fadeDir = -1;
          if (nextScene) {
            enterScene(nextScene);
            nextScene = null;
          }
        }
        if (fadeDir < 0 && fade <= 0) {
          fade = 0;
          fadeDir = 0;
        }
      }
      if (scene === "vs") {
        vsTimer += dt;
        if (vsTimer > 2.1) go("fight");
      }
      if (scene === "fight" && fight) updateFight(dt);
      updateFx(dt);
      const showTouch = scene === "fight" && (matchMedia("(pointer: coarse)").matches || window.innerWidth < 900);
      if (touchEl) touchEl.classList.toggle("show", showTouch);
    }

    function loop(t) {
      if (!running) return;
      const now = t * 0.001;
      let dt = Math.min(0.1, now - (lastT || now));
      lastT = now;
      acc += dt;
      const stepDt = 1 / 60;
      while (acc >= stepDt) {
        step(stepDt);
        acc -= stepDt;
      }
      render(dt);
      pointer.clicked = false;
      raf = requestAnimationFrame(loop);
    }

    function applyCodes(codes) {
      const set = new Set(codes || []);
      keys.left = set.has("KeyA") || set.has("ArrowLeft");
      keys.right = set.has("KeyD") || set.has("ArrowRight");
      keys.jump = set.has("KeyW") || set.has("ArrowUp");
      keys.block = set.has("KeyS") || set.has("ArrowDown");
      keys.punch = set.has("KeyJ") || set.has("KeyZ");
      keys.kick = set.has("KeyK") || set.has("KeyX");
      keys.special = set.has("KeyL") || set.has("KeyC") || set.has("Space");
    }

    window.__controlsTest = {
      getYaw: () => (fight && fight.p.facing < 0 ? Math.PI : 0),
      getSpeed: () => (fight ? Math.abs(fight.p.vx) : 0),
      getX: () => (fight ? fight.p.x : 0),
      setKeys: (codes) => applyCodes(codes),
      setSteer: (v) => {
        keys.left = v > 0.2;
        keys.right = v < -0.2;
      },
    };
    window.__umbraQA = {
      tap(x, y) {
        pointer.x = x;
        pointer.y = y;
        pointer.down = true;
        pointer.clicked = true;
      },
      scene: () => scene,
      start: (level) => startFight(level || 1),
      player: () => fight && fight.p,
      enemy: () => fight && fight.e,
    };

    function mapKey(e, down) {
      const k = e.code;
      const set = (name) => {
        if (down && !held[name] && scene === "fight" && fight && !paused && fight.intro <= 0) {
          if (name === "punch") wantAttack(fight.p, "punch");
          if (name === "kick") wantAttack(fight.p, "kick");
          if (name === "special") wantAttack(fight.p, "special");
          if (name === "left") tryDash(fight.p, -1);
          if (name === "right") tryDash(fight.p, 1);
        }
        keys[name] = down;
        held[name] = down;
      };
      if (k === "KeyA" || k === "ArrowLeft") set("left");
      else if (k === "KeyD" || k === "ArrowRight") set("right");
      else if (k === "KeyW" || k === "ArrowUp") set("jump");
      else if (k === "KeyS" || k === "ArrowDown") set("block");
      else if (k === "KeyJ" || k === "KeyZ") set("punch");
      else if (k === "KeyK" || k === "KeyX") set("kick");
      else if (k === "KeyL" || k === "KeyC" || k === "Space") set("special");
      else if (k === "Enter") keys.enter = down;
      else if (k === "Escape" && down && scene === "fight") paused = !paused;
      else return;
      e.preventDefault();
    }

    function isRotated() {
      const wrap = document.getElementById("wrap");
      return !!(wrap && wrap.classList.contains("rot90"));
    }

    function toGame(e) {
      // We deliberately do NOT use canvas.getBoundingClientRect() here.
      // Several mobile browsers report touch/pointer clientX/clientY
      // relative to the page's pre-transform layout rather than the
      // visually rotated result, which makes rect-based math wrong
      // whenever #wrap has the "rot90" forced-landscape class applied.
      // Instead we undo the known 90deg CSS rotation ourselves, then
      // map into the canvas using the box layout() already computed.
      let cx = e.clientX;
      let cy = e.clientY;
      if (isRotated()) {
        const vw = window.innerWidth;
        const lx = cy;
        const ly = vw - cx;
        cx = lx;
        cy = ly;
      }
      const x = ((cx - canvasBox.left) / canvasBox.width) * W;
      const y = ((cy - canvasBox.top) / canvasBox.height) * H;
      return { x, y };
    }

    const onKeyDown = (e) => mapKey(e, true);
    const onKeyUp = (e) => mapKey(e, false);
    const onPointerDown = (e) => {
      A.unlock();
      canvas.focus();
      const p = toGame(e);
      pointer.x = p.x;
      pointer.y = p.y;
      pointer.down = true;
      pointer.clicked = true;
    };
    const onPointerMove = (e) => {
      const p = toGame(e);
      pointer.x = p.x;
      pointer.y = p.y;
    };
    const onPointerUp = () => {
      pointer.down = false;
    };
    const onTouchDown = (e) => {
      const b = e.target.closest("[data-k]");
      if (!b) return;
      e.preventDefault();
      A.unlock();
      const name = b.dataset.k;
      b.classList.add("down");
      if (scene === "fight" && fight) {
        if (name === "punch") wantAttack(fight.p, "punch");
        if (name === "kick") wantAttack(fight.p, "kick");
        if (name === "special") wantAttack(fight.p, "special");
        if (name === "left") tryDash(fight.p, -1);
        if (name === "right") tryDash(fight.p, 1);
      }
      keys[name] = true;
    };
    const clearTouch = (e) => {
      const b = e.target.closest("[data-k]");
      if (!b) return;
      b.classList.remove("down");
      keys[b.dataset.k] = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("mousedown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("mousemove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("mouseup", onPointerUp);
    if (touchEl) {
      touchEl.addEventListener("pointerdown", onTouchDown);
      touchEl.addEventListener("pointerup", clearTouch);
      touchEl.addEventListener("pointerleave", clearTouch);
      touchEl.addEventListener("pointercancel", clearTouch);
    }

    function layout() {
      // NOTE: orientation.js owns the #wrap "rot90" class (it flips the
      // whole app sideways with CSS on portrait phones) — this function
      // only has to fit the fixed 1280x720 canvas into whatever box
      // #stage ends up with.
      //
      // We scale to COVER the available space (fill it completely,
      // cropping a sliver off the long edge if the screen's aspect
      // ratio isn't exactly 16:9) rather than to CONTAIN it (which
      // letterboxes with black bars and makes the game look small on
      // phones that are wider/taller than 16:9). #stage has
      // overflow:hidden so the cropped edges are simply clipped.
      const stage = document.getElementById("stage");
      const availW = (stage && stage.clientWidth) || window.innerWidth;
      const availH = (stage && stage.clientHeight) || window.innerHeight;
      const scale = Math.min(availW / W, availH / H);

      const w = Math.round(W * scale);
      const h = Math.round(H * scale);
      const left = Math.round((availW - w) / 2);
      const top = Math.round((availH - h) / 2);

      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      canvas.style.left = left + "px";
      canvas.style.top = top + "px";
      canvas.style.right = "auto";
      canvas.style.bottom = "auto";

      // Used by toGame() so pointer/touch mapping never has to trust
      // getBoundingClientRect() through the CSS rotation transform.
      canvasBox.left = left;
      canvasBox.top = top;
      canvasBox.width = w;
      canvasBox.height = h;
    }
    window.__umbraLayout = layout;
    canvas.setAttribute("tabindex", "0");
    canvas.style.outline = "none";
    window.addEventListener("resize", layout);
    window.addEventListener("orientationchange", function () {
      layout();
      setTimeout(layout, 80);
      setTimeout(layout, 280);
    });
    if (window.visualViewport) window.visualViewport.addEventListener("resize", layout);
    layout();
    try {
      canvas.focus();
    } catch (e) {}

    unbind = () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("mousedown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("resize", layout);
      if (touchEl) {
        touchEl.removeEventListener("pointerdown", onTouchDown);
        touchEl.removeEventListener("pointerup", clearTouch);
        touchEl.removeEventListener("pointerleave", clearTouch);
        touchEl.removeEventListener("pointercancel", clearTouch);
      }
    };

    A.muted = !!save.mute;
    enterScene("boot");
    raf = requestAnimationFrame(loop);
  }
})();