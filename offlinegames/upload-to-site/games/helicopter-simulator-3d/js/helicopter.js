/* ============================================================
   helicopter.js  —  Detailed helicopter model + flight model
   Convention: nose = -Z, up = +Y, right = +X
   ============================================================ */
'use strict';

const HELI = (function () {

  /* ------------------------------------------------------------------ */
  /*  GEOMETRY                                                           */
  /* ------------------------------------------------------------------ */

  function buildGeometry() {
    const P2 = Math.PI / 2;

    /* --- fuselage: lofted superellipse sections, nose (-Z) to tail (+Z) --- */
    const fuse = G.loft([
      { z: -4.30, w: 0.10, h: 0.10, yOff: -0.10 },
      { z: -3.95, w: 0.52, h: 0.42, yOff: -0.08 },
      { z: -3.30, w: 0.86, h: 0.70, yOff: 0.00 },
      { z: -2.40, w: 1.06, h: 0.92, yOff: 0.02 },
      { z: -1.20, w: 1.16, h: 1.02, yOff: 0.02 },
      { z: 0.00, w: 1.18, h: 1.04, yOff: 0.00 },
      { z: 1.10, w: 1.10, h: 0.98, yOff: 0.02 },
      { z: 2.05, w: 0.86, h: 0.80, yOff: 0.10 },
      { z: 2.75, w: 0.52, h: 0.50, yOff: 0.22 },
      { z: 3.30, w: 0.30, h: 0.30, yOff: 0.30 }
    ], 18);

    /* --- tail boom --- */
    const boom = G.loft([
      { z: 3.10, w: 0.30, h: 0.30, yOff: 0.30 },
      { z: 5.20, w: 0.24, h: 0.24, yOff: 0.36 },
      { z: 7.20, w: 0.19, h: 0.20, yOff: 0.42 },
      { z: 8.40, w: 0.16, h: 0.18, yOff: 0.48 }
    ], 12);

    /* --- engine cowling / transmission deck --- */
    const cowl = G.merge([
      { geom: G.loft([
          { z: -0.60, w: 0.72, h: 0.34, yOff: 1.00 },
          { z: 0.30, w: 0.86, h: 0.44, yOff: 1.06 },
          { z: 1.40, w: 0.80, h: 0.42, yOff: 1.02 },
          { z: 2.40, w: 0.50, h: 0.30, yOff: 0.92 }
        ], 14) },
      /* exhaust stacks */
      { geom: G.cylinder(0.15, 0.17, 0.9, 10), t: [0.46, 1.22, 2.05], r: [Math.PI / 2.4, 0, 0] },
      { geom: G.cylinder(0.15, 0.17, 0.9, 10), t: [-0.46, 1.22, 2.05], r: [Math.PI / 2.4, 0, 0] },
      /* air intakes */
      { geom: G.cylinder(0.22, 0.22, 0.30, 12), t: [0.52, 1.16, -0.35], r: [0, 0, P2] },
      { geom: G.cylinder(0.22, 0.22, 0.30, 12), t: [-0.52, 1.16, -0.35], r: [0, 0, P2] }
    ]);

    /* --- vertical fin + horizontal stabiliser + tail guard --- */
    const tail = G.merge([
      { geom: G.box(0.14, 1.70, 1.25), t: [0, 1.25, 7.95], r: [0.16, 0, 0] },
      { geom: G.box(0.12, 0.95, 0.70), t: [0, 0.05, 8.10], r: [-0.25, 0, 0] },
      { geom: G.box(2.30, 0.10, 0.62), t: [0, 0.62, 7.15] },
      { geom: G.box(0.10, 0.42, 0.42), t: [1.12, 0.80, 7.15] },
      { geom: G.box(0.10, 0.42, 0.42), t: [-1.12, 0.80, 7.15] }
    ]);

    /* --- landing skids --- */
    const skidTube = (side) => G.merge([
      { geom: G.cylinder(0.075, 0.075, 4.6, 10), t: [side * 1.18, -1.16, -0.15], r: [P2, 0, 0] },
      /* upturned front */
      { geom: G.cylinder(0.075, 0.075, 0.75, 10), t: [side * 1.18, -1.05, -2.65], r: [P2 - 0.5, 0, 0] },
      /* struts */
      { geom: G.cylinder(0.065, 0.065, 1.15, 8), t: [side * 0.80, -0.62, -1.25], r: [0, 0, side * 0.52] },
      { geom: G.cylinder(0.065, 0.065, 1.15, 8), t: [side * 0.80, -0.62, 1.05], r: [0, 0, side * 0.52] },
      { geom: G.cylinder(0.05, 0.05, 0.9, 8), t: [side * 1.00, -0.95, -1.25], r: [0, 0, side * 1.1] }
    ]);
    const skids = G.merge([{ geom: skidTube(1) }, { geom: skidTube(-1) }]);

    /* --- rotor mast + hub --- */
    const mast = G.merge([
      { geom: G.cylinder(0.13, 0.16, 0.70, 12), t: [0, 1.58, 0.30] },
      { geom: G.cylinder(0.34, 0.30, 0.26, 14), t: [0, 1.94, 0.30] },
      { geom: G.sphere(0.20, 12, 8), t: [0, 2.06, 0.30] }
    ]);

    /* --- main rotor blade assembly (4 blades, origin at hub) --- */
    const bladeGeoms = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      bladeGeoms.push({
        geom: G.merge([
          /* blade: long, thin, slight twist represented by tilt */
          { geom: G.box(0.44, 0.055, 5.6), t: [0, 0, -2.95], r: [0.045, 0, 0] },
          /* blade root / grip */
          { geom: G.cylinder(0.085, 0.085, 0.55, 8), t: [0, 0, -0.35], r: [P2, 0, 0] },
          /* pitch link */
          { geom: G.cylinder(0.035, 0.035, 0.34, 6), t: [0.14, -0.20, -0.30] }
        ]),
        r: [0, a, 0]
      });
    }
    const mainBlades = G.merge(bladeGeoms.concat([
      { geom: G.cylinder(0.26, 0.26, 0.16, 14) },                   /* swash plate */
      { geom: G.cylinder(0.30, 0.30, 0.06, 14), t: [0, -0.26, 0] }
    ]));

    /* --- tail rotor (2 blades, spins about local Y; placed rotated) --- */
    const tailBlades = G.merge([
      { geom: G.box(0.22, 0.035, 1.9), t: [0, 0, -0.95] },
      { geom: G.box(0.22, 0.035, 1.9), t: [0, 0, 0.95] },
      { geom: G.cylinder(0.11, 0.11, 0.20, 10) }
    ]);

    /* --- canopy glass --- */
    const glass = G.merge([
      { geom: G.loft([
          { z: -3.90, w: 0.50, h: 0.42, yOff: 0.10 },
          { z: -3.30, w: 0.88, h: 0.74, yOff: 0.16 },
          { z: -2.40, w: 1.04, h: 0.92, yOff: 0.18 },
          { z: -1.55, w: 1.10, h: 0.94, yOff: 0.16 }
        ], 16) },
      /* side windows */
      { geom: G.box(0.06, 0.66, 1.5), t: [1.14, 0.24, -0.55] },
      { geom: G.box(0.06, 0.66, 1.5), t: [-1.14, 0.24, -0.55] }
    ]);

    /* --- cockpit interior + canopy frame (what the pilot view shows) --- */
    const interior = G.merge([
      /* glare shield + instrument panel (kept low so the view stays open) */
      { geom: G.box(1.90, 0.11, 0.52), t: [0, -0.16, -2.62], r: [-0.34, 0, 0] },
      { geom: G.box(1.82, 0.36, 0.09), t: [0, -0.40, -2.40], r: [-0.08, 0, 0] },
      /* instrument bezels */
      { geom: G.cylinder(0.145, 0.145, 0.04, 14), t: [0.42, -0.34, -2.50], r: [Math.PI / 2 - 0.34, 0, 0] },
      { geom: G.cylinder(0.145, 0.145, 0.04, 14), t: [0.02, -0.34, -2.50], r: [Math.PI / 2 - 0.34, 0, 0] },
      { geom: G.cylinder(0.145, 0.145, 0.04, 14), t: [-0.38, -0.34, -2.50], r: [Math.PI / 2 - 0.34, 0, 0] },
      /* centre console */
      { geom: G.box(0.30, 0.24, 0.90), t: [0, -0.70, -1.95], r: [0.10, 0, 0] },
      /* cyclic sticks */
      { geom: G.cylinder(0.030, 0.040, 0.60, 8), t: [0.38, -0.70, -1.80], r: [0.14, 0, 0] },
      { geom: G.sphere(0.065, 8, 6), t: [0.38, -0.42, -1.85] },
      { geom: G.cylinder(0.030, 0.040, 0.60, 8), t: [-0.38, -0.70, -1.80], r: [0.14, 0, 0] },
      { geom: G.sphere(0.065, 8, 6), t: [-0.38, -0.42, -1.85] },
      /* collective levers */
      { geom: G.cylinder(0.028, 0.036, 0.72, 8), t: [0.88, -0.78, -1.45], r: [-0.28, 0, 0.16] },
      { geom: G.cylinder(0.028, 0.036, 0.72, 8), t: [-0.88, -0.78, -1.45], r: [-0.28, 0, -0.16] },
      /* seats (behind the eye, but visible in the chase-to-cockpit blend) */
      { geom: G.box(0.56, 0.10, 0.54), t: [0.44, -0.82, -0.80] },
      { geom: G.box(0.56, 0.62, 0.09), t: [0.44, -0.50, -0.52], r: [0.14, 0, 0] },
      { geom: G.box(0.56, 0.10, 0.54), t: [-0.44, -0.82, -0.80] },
      { geom: G.box(0.56, 0.62, 0.09), t: [-0.44, -0.50, -0.52], r: [0.14, 0, 0] },
      /* windscreen header + A-pillars + door rails */
      { geom: G.cylinder(0.026, 0.026, 1.70, 6), t: [0, 0.92, -3.40], r: [0, 0, Math.PI / 2] },
      { geom: G.cylinder(0.026, 0.026, 1.45, 6), t: [0.90, 0.34, -3.16], r: [0.78, 0, 0.28] },
      { geom: G.cylinder(0.026, 0.026, 1.45, 6), t: [-0.90, 0.34, -3.16], r: [0.78, 0, -0.28] },
      { geom: G.cylinder(0.024, 0.024, 1.70, 6), t: [1.14, 0.54, -1.75], r: [Math.PI / 2, 0, 0] },
      { geom: G.cylinder(0.024, 0.024, 1.70, 6), t: [-1.14, 0.54, -1.75], r: [Math.PI / 2, 0, 0] },
      /* rear bulkhead + cabin floor */
      { geom: G.box(2.05, 1.60, 0.09), t: [0, 0.05, 1.15] },
      { geom: G.box(1.85, 0.09, 1.70), t: [0, -1.02, -0.70] }
    ]);

    return {
      interior,
      body: G.merge([{ geom: fuse }, { geom: boom }, { geom: cowl }, { geom: tail },
                     { geom: skids }, { geom: mast }]),
      mainBlades,
      tailBlades,
      glass,
      discMain: G.disc(5.9, 48),
      discTail: G.disc(1.05, 24),
      light: G.sphere(0.14, 8, 6)
    };
  }

  /* ------------------------------------------------------------------ */
  /*  VARIANTS (shop)                                                    */
  /* ------------------------------------------------------------------ */

  const VARIANTS = {
    scout: {
      name: 'AeroScout R22', price: 0, scale: 0.86,
      color: [0.90, 0.91, 0.93], accent: [0.14, 0.20, 0.34],
      thrust: 17.4, agility: 1.20, drag: 0.0115, maxSpeed: 42, fuel: 100, armour: 1.0,
      desc: 'Nimble trainer. Light, forgiving, low fuel burn.'
    },
    city: {
      name: 'UrbanHawk EC-1', price: 2500, scale: 1.0,
      color: [0.15, 0.42, 0.78], accent: [0.95, 0.95, 0.96],
      thrust: 18.8, agility: 1.05, drag: 0.0098, maxSpeed: 50, fuel: 120, armour: 1.25,
      desc: 'Balanced city transport. More speed and a tougher airframe.'
    },
    rescue: {
      name: 'Guardian SAR-9', price: 6500, scale: 1.08,
      color: [0.88, 0.24, 0.14], accent: [0.96, 0.96, 0.92],
      thrust: 20.4, agility: 0.96, drag: 0.0092, maxSpeed: 54, fuel: 160, armour: 1.7,
      desc: 'Search & rescue workhorse. Big tanks, strong hull.'
    },
    stealth: {
      name: 'Nightblade X', price: 14000, scale: 0.98,
      color: [0.11, 0.12, 0.15], accent: [0.35, 0.75, 0.95],
      thrust: 22.0, agility: 1.34, drag: 0.0058, maxSpeed: 72, fuel: 140, armour: 1.5,
      desc: 'Composite airframe, whisper rotor. Fast and razor sharp.'
    },
    titan: {
      name: 'Titan HX-70', price: 30000, scale: 1.22,
      color: [0.35, 0.38, 0.34], accent: [0.85, 0.62, 0.1],
      thrust: 25.5, agility: 0.90, drag: 0.0079, maxSpeed: 62, fuel: 220, armour: 2.6,
      desc: 'Heavy lifter. Enormous power reserve and armour plating.'
    }
  };

  /* ------------------------------------------------------------------ */
  /*  HELICOPTER INSTANCE                                                */
  /* ------------------------------------------------------------------ */

  class Helicopter {
    constructor(variantKey, upgrades) {
      this.geo = buildGeometry();
      const T = WORLD.getTextures();

      this.meshBody = R.makeMesh(this.geo.body);
      this.meshInterior = R.makeMesh(this.geo.interior);
      this.meshBlades = R.makeMesh(this.geo.mainBlades);
      this.meshTail = R.makeMesh(this.geo.tailBlades);
      this.meshGlass = R.makeMesh(this.geo.glass);
      this.meshDiscM = R.makeMesh(this.geo.discMain);
      this.meshDiscT = R.makeMesh(this.geo.discTail);
      this.meshLight = R.makeMesh(this.geo.light);

      this.bBody = R.makeBatch(this.meshBody, T.metal, { capacity: 1 });
      this.bInterior = R.makeBatch(this.meshInterior, T.metal, { capacity: 1, castShadow: false });
      this.bBlades = R.makeBatch(this.meshBlades, T.metal, { capacity: 1 });
      this.bTail = R.makeBatch(this.meshTail, T.metal, { capacity: 1 });
      this.bDiscM = R.makeBatch(this.meshDiscM, T.rotorDisc, { capacity: 1, blend: true, castShadow: false, doubleSided: true, alphaTex: true, order: 5 });
      this.bDiscT = R.makeBatch(this.meshDiscT, T.rotorDisc, { capacity: 1, blend: true, castShadow: false, doubleSided: true, alphaTex: true, order: 4 });
      this.bGlass = R.makeBatch(this.meshGlass, null, { capacity: 1, blend: true, castShadow: false, order: 6 });
      this.meshGlow = R.makeMesh(G.plane(1, 1, 1, 1));
      this.bLights = R.makeBatch(this.meshLight, null, { capacity: 8, blend: true, castShadow: false, order: 3 });

      this.batches = [this.bBody, this.bInterior, this.bBlades, this.bTail,
                      this.bDiscT, this.bDiscM, this.bGlass, this.bLights];

      /* state */
      this.pos = M.v3.create(0, 2.0, 0);
      this.vel = M.v3.create(0, 0, 0);
      this.quat = M.quat.create();
      this.yaw = 0; this.pitch = 0; this.roll = 0;
      this.yawRate = 0; this.pitchRate = 0; this.rollRate = 0;
      this.rotorRpm = 0;
      this.rotorAngle = 0;
      this.tailAngle = 0;
      this.discAngle = 0;      /* slower "strobe" angle so the blur reads as motion */
      this.discAngleT = 0;
      this.engineOn = false;
      this.landed = true;
      this.crashed = false;
      this.destroyed = false;
      this.health = 100;
      this.fuel = 100;
      this.collective = 0;
      this.blinkT = 0;

      this.setVariant(variantKey || 'scout', upgrades);
    }

    setVariant(key, upgrades) {
      const v = VARIANTS[key] || VARIANTS.scout;
      this.variantKey = key;
      this.variant = v;
      const up = upgrades || {};
      const lv = (n) => (up[n] || 0);
      this.scale = v.scale;
      this.maxThrust = v.thrust * (1 + lv('engine') * 0.09);
      this.agility = v.agility * (1 + lv('rotor') * 0.07);
      this.dragK = v.drag * (1 - lv('aero') * 0.085);
      this.maxSpeed = v.maxSpeed * (1 + lv('engine') * 0.06);
      this.fuelMax = v.fuel * (1 + lv('tank') * 0.18);
      this.armour = v.armour * (1 + lv('armour') * 0.22);
      this.fuel = this.fuelMax;
      this.color = v.color.slice();
      this.accent = v.accent.slice();
      this.rotorRadius = 5.9 * this.scale;
      this.hullRadius = 2.6 * this.scale;
    }

    reset(x, y, z, yaw) {
      M.v3.set(this.pos, x, y, z);
      M.v3.set(this.vel, 0, 0, 0);
      this.yaw = yaw || 0; this.pitch = 0; this.roll = 0;
      this.yawRate = this.pitchRate = this.rollRate = 0;
      this.rotorRpm = 0; this.engineOn = false;
      this.crashed = false; this.destroyed = false; this.landed = true;
      this.health = 100; this.fuel = this.fuelMax;
      this.collective = 0;
      M.quat.fromEuler(this.quat, 0, this.yaw, 0);
    }

    startEngine() { this.engineOn = true; }

    /* ---------------- flight model ---------------- */
    update(dt, input, opts) {
      opts = opts || {};
      const gravity = 9.81;

      /* rotor spool */
      const target = this.engineOn ? 1 : 0;
      const spool = this.engineOn ? 0.42 : 0.28;
      this.rotorRpm += (target - this.rotorRpm) * Math.min(1, spool * dt * 2.2);
      if (this.crashed) this.rotorRpm *= Math.max(0, 1 - dt * 1.4);

      this.rotorAngle += dt * (2 + this.rotorRpm * 46);
      this.tailAngle += dt * (4 + this.rotorRpm * 130);
      /* the blur disc turns at a fraction of true rotor speed: fast enough to
         read as spinning, slow enough that it never strobes backwards */
      this.discAngle += dt * (1.2 + this.rotorRpm * 9.5);
      this.discAngleT += dt * (2.0 + this.rotorRpm * 16.0);

      if (this.crashed) {
        /* fall & settle */
        this.vel[1] -= gravity * dt;
        M.v3.addScaled(this.pos, this.pos, this.vel, dt);
        const ground = WORLD.supportHeight(this.pos[0], this.pos[2]);
        if (this.pos[1] < ground + 1.2) {
          this.pos[1] = ground + 1.2;
          M.v3.scale(this.vel, this.vel, 0.2);
        }
        this.roll += dt * 0.9 * (this.roll >= 0 ? 1 : -1);
        M.quat.fromEuler(this.quat, this.pitch, this.yaw, this.roll);
        return { crashedThisFrame: false };
      }

      /* ------- control inputs ------- */
      const A = this.agility;
      const coll = M.clamp(input.collective, 0, 1);
      this.collective = coll;

      // cyclic -> target attitude (stability augmented, arcade-real hybrid)
      const maxTilt = 0.86;
      const tgtPitch = -input.pitch * maxTilt;
      const tgtRoll = input.roll * maxTilt;

      const rateK = 3.4 * A;
      this.pitchRate += ((tgtPitch - this.pitch) * rateK - this.pitchRate * 2.6) * dt * 2.2;
      this.rollRate += ((tgtRoll - this.roll) * rateK - this.rollRate * 2.6) * dt * 2.2;
      this.pitch += this.pitchRate * dt;
      this.roll += this.rollRate * dt;
      this.pitch = M.clamp(this.pitch, -0.95, 0.95);
      this.roll = M.clamp(this.roll, -1.05, 1.05);

      // pedals -> yaw rate; plus a little torque coupling from collective
      const yawTgt = input.yaw * 1.75 * A;
      this.yawRate = M.damp(this.yawRate, yawTgt, 5.0, dt);
      this.yaw += this.yawRate * dt;

      M.quat.fromEuler(this.quat, this.pitch, this.yaw, this.roll);

      /* ------- forces ------- */
      const up = M.v3.create(0, 1, 0);
      M.v3.transformQuat(up, up, this.quat);

      const fuelOk = this.fuel > 0;
      const powerFactor = fuelOk ? 1 : 0.0;
      const thrust = this.maxThrust * this.rotorRpm * powerFactor *
                     (0.28 + coll * 0.95) * (opts.thrustMul || 1);

      const acc = M.v3.create(0, -gravity, 0);
      M.v3.addScaled(acc, acc, up, thrust);

      // ground effect: extra lift close to a surface
      const support = WORLD.supportHeight(this.pos[0], this.pos[2]);
      const agl = this.pos[1] - support;
      if (agl < 8 && agl > 0) acc[1] += (1 - agl / 8) * 2.4 * this.rotorRpm;

      // drag (quadratic, anisotropic-ish)
      const sp = M.v3.len(this.vel);
      if (sp > 0.001) {
        const dragMag = this.dragK * sp * sp;
        M.v3.addScaled(acc, acc, this.vel, -dragMag / sp);
      }
      // light lateral damping so it doesn't feel like ice
      acc[0] -= this.vel[0] * 0.030;
      acc[2] -= this.vel[2] * 0.030;
      acc[1] -= this.vel[1] * 0.26;

      // wind
      if (opts.wind) {
        acc[0] += opts.wind[0];
        acc[1] += opts.wind[1];
        acc[2] += opts.wind[2];
      }

      M.v3.addScaled(this.vel, this.vel, acc, dt);

      // speed cap
      const s2 = M.v3.len(this.vel);
      if (s2 > this.maxSpeed) M.v3.scale(this.vel, this.vel, this.maxSpeed / s2);

      const prevY = this.pos[1];
      M.v3.addScaled(this.pos, this.pos, this.vel, dt);

      /* ------- fuel ------- */
      if (this.engineOn && this.rotorRpm > 0.05) {
        this.fuel = Math.max(0, this.fuel - (0.42 + coll * 1.35) * dt * (opts.fuelBurn || 1));
      }

      /* ------- collisions ------- */
      let impact = 0;
      let fatal = false;
      const rotorHit = WORLD.collide(this.pos[0], this.pos[1] + 2.0 * this.scale, this.pos[2],
                                     this.rotorRadius * 0.98);
      const bodyHit = WORLD.collide(this.pos[0], this.pos[1], this.pos[2], this.hullRadius);
      const hit = bodyHit || rotorHit;
      if (hit) {
        const vn = this.vel[0] * hit.nx + this.vel[1] * hit.ny + this.vel[2] * hit.nz;
        impact = Math.max(0, -vn);

        /* A turning rotor that touches concrete is gone — always fatal.
           The hull survives only the gentlest brush. */
        if (rotorHit && this.rotorRpm > 0.25) fatal = true;
        else if (bodyHit && impact > 2.0) fatal = true;

        this.pos[0] += hit.nx * hit.depth;
        this.pos[1] += hit.ny * hit.depth;
        this.pos[2] += hit.nz * hit.depth;
        if (vn < 0) {
          this.vel[0] -= hit.nx * vn * 1.35;
          this.vel[1] -= hit.ny * vn * 1.35;
          this.vel[2] -= hit.nz * vn * 1.35;
          M.v3.scale(this.vel, this.vel, 0.55);
        }
        if (fatal) {
          this.health = 0;
          this.crashed = true;
          this.destroyed = true;
          return { crashedThisFrame: true, impact: Math.max(impact, 6), struck: true };
        }
        const dmg = Math.max(0, impact - 0.6) * 6.0 / this.armour;
        if (dmg > 0.2) this.health -= dmg;
      }

      /* ------- ground / rooftop contact ------- */
      const groundY = WORLD.supportHeight(this.pos[0], this.pos[2]);
      const skidY = 1.30 * this.scale;
      let touched = false;
      if (this.pos[1] - skidY <= groundY) {
        this.pos[1] = groundY + skidY;
        const vy = this.vel[1];
        if (vy < -0.4) {
          const hard = -vy;
          if (hard > 9.0) {
            this.health = 0; this.crashed = true; this.destroyed = true;
            return { crashedThisFrame: true, impact: hard, struck: true };
          }
          if (hard > 5.0) this.health -= (hard - 5.0) * 9 / this.armour;
          impact = Math.max(impact, hard);
        }
        this.vel[1] = Math.max(0, this.vel[1]);
        // friction
        this.vel[0] *= Math.max(0, 1 - dt * 4.5);
        this.vel[2] *= Math.max(0, 1 - dt * 4.5);
        touched = true;
        // settle attitude when resting
        if (this.rotorRpm < 0.75 || coll < 0.35) {
          this.pitch = M.damp(this.pitch, 0, 6, dt);
          this.roll = M.damp(this.roll, 0, 6, dt);
        }
      }
      this.landed = touched;
      this.agl = this.pos[1] - groundY;

      if (this.health <= 0 && !this.crashed) {
        this.health = 0;
        this.crashed = true;
        return { crashedThisFrame: true, impact };
      }
      return { impact, touched };
    }

    /* is the helicopter safely landed & stopped? */
    isSettled() {
      return this.landed &&
             Math.abs(this.vel[1]) < 1.0 &&
             Math.hypot(this.vel[0], this.vel[2]) < 1.6 &&
             Math.abs(this.pitch) < 0.22 && Math.abs(this.roll) < 0.22;
    }

    /* ---------------- rendering ---------------- */
    render(nightFactor, cockpit) {
      const q = this.quat, s = this.scale;
      const mat = new Float32Array(16);
      const sv = M.v3.create(s, s, s);

      const bodyCol = [this.color[0], this.color[1], this.color[2], 1];
      const dark = [this.accent[0], this.accent[1], this.accent[2], 1];

      const gone = !!this.destroyed;
      this.bBody.clear();
      M.m4.fromRotationTranslationScale(mat, q, this.pos, sv);
      this.bBody.push(mat, bodyCol, [1, 1, 0, 0.55]);
      /* from the pilot seat the outer shell would fill the screen */
      this.bBody.visible = !cockpit && !gone;

      this.bInterior.clear();
      M.m4.fromRotationTranslationScale(mat, q, this.pos, sv);
      this.bInterior.push(mat, [0.20, 0.21, 0.23, 1], [1, 1, 0.02, 0.25]);
      this.bInterior.visible = !gone;

      /* main rotor: hub position in local space */
      const hub = M.v3.create(0, 1.98 * s, 0.30 * s);
      M.v3.transformQuat(hub, hub, q);
      M.v3.add(hub, hub, this.pos);

      const spinQ = M.quat.create();
      const rq = M.quat.create();
      M.quat.setAxisAngle(spinQ, 0, 1, 0, this.rotorAngle);
      M.quat.multiply(rq, q, spinQ);

      this.bBlades.clear();
      M.m4.fromRotationTranslationScale(mat, rq, hub, sv);
      const bladeVis = this.rotorRpm < 0.92 ? 1 : 1;
      this.bBlades.push(mat, dark, [1, 1, 0, 0.4]);
      this.bBlades.visible = this.rotorRpm < 0.86 && !gone;

      /* main rotor blur disc */
      this.bDiscM.clear();
      if (this.rotorRpm > 0.22) {
        const a = Math.min(0.80, (this.rotorRpm - 0.22) * 1.05);
        const dq = M.quat.create(), dspin = M.quat.create();
        M.quat.setAxisAngle(dspin, 0, 1, 0, this.discAngle);
        M.quat.multiply(dq, q, dspin);
        M.m4.fromRotationTranslationScale(mat, dq, hub, sv);
        this.bDiscM.push(mat, [0.70, 0.74, 0.80, a], [1, 1, 0.03, 0]);
      }

      /* tail rotor */
      const tailPos = M.v3.create(0.34 * s, 1.30 * s, 7.95 * s);
      M.v3.transformQuat(tailPos, tailPos, q);
      M.v3.add(tailPos, tailPos, this.pos);
      const tq = M.quat.create(), tq2 = M.quat.create(), tspin = M.quat.create();
      M.quat.setAxisAngle(tq2, 0, 0, 1, Math.PI / 2);     // lay the rotor on its side
      M.quat.setAxisAngle(tspin, 0, 1, 0, this.tailAngle);
      M.quat.multiply(tq, tq2, tspin);
      M.quat.multiply(tq, q, tq);
      this.bTail.clear();
      M.m4.fromRotationTranslationScale(mat, tq, tailPos, sv);
      this.bTail.push(mat, dark, [1, 1, 0, 0.4]);
      this.bTail.visible = this.rotorRpm < 0.80 && !gone;

      this.bDiscT.clear();
      if (this.rotorRpm > 0.22) {
        const a = Math.min(0.75, (this.rotorRpm - 0.22) * 1.0);
        const dq = M.quat.create(), dspin = M.quat.create();
        M.quat.setAxisAngle(dspin, 0, 1, 0, this.discAngleT);
        M.quat.multiply(dq, tq2, dspin);
        M.quat.multiply(dq, q, dq);
        M.m4.fromRotationTranslationScale(mat, dq, tailPos, sv);
        this.bDiscT.push(mat, [0.68, 0.72, 0.78, a], [1, 1, 0.03, 0]);
      }

      /* canopy */
      this.bGlass.clear();
      M.m4.fromRotationTranslationScale(mat, q, this.pos, sv);
      this.bGlass.push(mat, [0.42, 0.58, 0.70, 0.42], [1, 1, 0.04, 0.9]);
      this.bGlass.visible = !cockpit && !gone;

      /* navigation lights */
      this.bLights.clear();
      this.bLights.visible = !cockpit && !gone;
      this.blinkT += 0.016;
      const strobe = (Math.sin(this.blinkT * 5.2) > 0.86) ? 1 : 0;
      const lights = [
        { p: [1.28, 0.10, -0.60], c: [1, 0.12, 0.10], on: 1 },      // port red
        { p: [-1.28, 0.10, -0.60], c: [0.10, 1, 0.25], on: 1 },     // starboard green
        { p: [0, 1.52, 8.30], c: [1, 1, 1], on: strobe },           // tail strobe
        { p: [0, -0.72, -3.0], c: [1, 0.95, 0.8], on: 1 },          // landing light
        { p: [0, 2.22, 0.30], c: [1, 0.2, 0.15], on: (Math.sin(this.blinkT * 3.1) > 0 ? 1 : 0) }
      ];
      for (const L of lights) {
        if (!L.on) continue;
        const lp = M.v3.create(L.p[0] * s, L.p[1] * s, L.p[2] * s);
        M.v3.transformQuat(lp, lp, q);
        M.v3.add(lp, lp, this.pos);
        M.m4.fromRotationTranslationScale(mat, q, lp, M.v3.create(s * 1.6, s * 1.6, s * 1.6));
        this.bLights.push(mat, [L.c[0], L.c[1], L.c[2], 0.92], [1, 1, 2.6, 0]);
      }
    }

    /* world-space point helper (for cameras) */
    localToWorld(out, lx, ly, lz) {
      M.v3.set(out, lx * this.scale, ly * this.scale, lz * this.scale);
      M.v3.transformQuat(out, out, this.quat);
      M.v3.add(out, out, this.pos);
      return out;
    }
  }

  return { Helicopter, VARIANTS, buildGeometry };
})();

if (typeof module !== 'undefined') module.exports = HELI;
