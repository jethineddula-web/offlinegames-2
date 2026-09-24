import { spawnDebris, hitDebris, stepDebrisItem } from "./debris.js";
import { carById } from "./data.js";
import { clamp, closestOnTrack, lerp, lerpAngle, segmentsIntersect, wrapAngle, yawToForward, yawToRight, } from "./types.js";
export const LIGHT_BEAT = 0.85;
export const LIGHT_HOLD = 0.55;
export const LIGHT_TOTAL = LIGHT_BEAT * 3 + LIGHT_HOLD;
export const CAR_HALF_W = 0.95;
export const CAR_HALF_L = 2.15;
export const BARRIER_FACE = 0.44;
export function lightPhase(t) {
    if (t >= LIGHT_TOTAL)
        return { reds: 0, count: "GO", racing: true };
    if (t < LIGHT_BEAT)
        return { reds: 1, count: 3, racing: false };
    if (t < LIGHT_BEAT * 2)
        return { reds: 2, count: 2, racing: false };
    return { reds: 3, count: 1, racing: false };
}
const STEP = 1 / 60;
const RIVAL_CARS = ["coupe", "s14", "muscle", "gt"];
function wrapDist(dist, length) {
    if (length <= 0)
        return 0;
    let d = dist % length;
    if (d < 0)
        d += length;
    return d;
}
export function pointAlong(pts, dist, length) {
    const n = pts.length;
    dist = wrapDist(dist, length);
    let acc = 0;
    for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        if (acc + len >= dist) {
            const t = (dist - acc) / len;
            return {
                x: a.x + (b.x - a.x) * t,
                y: a.y + (b.y - a.y) * t,
                yaw: Math.atan2(-(b.x - a.x), b.y - a.y),
            };
        }
        acc += len;
    }
    const a = pts[0];
    const b = pts[1];
    return { x: a.x, y: a.y, yaw: Math.atan2(-(b.x - a.x), b.y - a.y) };
}
function headingFrom(dx, dy) {
    return Math.atan2(-dx, dy);
}
function carExtentAlong(yaw, nx, ny) {
    const f = yawToForward(yaw);
    const r = yawToRight(yaw);
    return Math.abs(f.x * nx + f.y * ny) * CAR_HALF_L + Math.abs(r.x * nx + r.y * ny) * CAR_HALF_W;
}
function carCircles(x, y, yaw) {
    const f = yawToForward(yaw);
    return [
        { x: x + f.x * 1.2, y: y + f.y * 1.2, r: 1.02 },
        { x: x - f.x * 1.15, y: y - f.y * 1.15, r: 1.02 },
    ];
}
function spawnRivals(map) {
    const out = [];
    const half = map.width * 0.5;
    const speedMul = map.speedMul ?? 1;
    const slots = [
        { along: 12, side: 1 },
        { along: 12, side: -1 },
        { along: -14, side: 1 },
        { along: -14, side: -1 },
    ];
    for (let i = 0; i < 4; i++) {
        const slot = slots[i];
        const p = pointAlong(map.points, slot.along, map.length);
        const right = yawToRight(p.yaw);
        const lane = slot.side * half * 0.28;
        out.push({
            id: i,
            carId: RIVAL_CARS[i],
            x: p.x + right.x * lane,
            y: p.y + right.y * lane,
            yaw: p.yaw,
            u: 0,
            speed: 0,
            tAlong: slot.along,
            lap: 1,
            nextCp: 1,
            maxSpeed: (34 + i * 2.4) * speedMul,
            accel: (16 + i * 0.9) * speedMul,
            lane,
            hitT: 0,
        });
    }
    return out;
}
export function makeCarState(map) {
    const f = yawToForward(map.start.yaw);
    const r = yawToRight(map.start.yaw);
    const lane = map.width * 0.18;
    return {
        x: map.start.x + r.x * lane + f.x * 1.4,
        y: map.start.y + r.y * lane + f.y * 1.4,
        yaw: map.start.yaw,
        u: 0,
        v: 0,
        r: 0,
        nitro: 0.45,
        drifting: false,
        slip: 0,
        speed: 0,
        offTrack: 0,
        lastOn: { x: map.start.x + r.x * lane + f.x * 1.4, y: map.start.y + r.y * lane + f.y * 1.4 },
        lastYaw: map.start.yaw,
    };
}
export function makeRace(map) {
    const car = makeCarState(map);
    const race = {
        map,
        car,
        prev: { x: car.x, y: car.y },
        lap: 1,
        nextCp: 1,
        time: 0,
        lives: 3,
        driftScore: 0,
        combo: 1,
        comboT: 0,
        finished: false,
        lost: false,
        boostT: 0,
        offTimer: 0,
        wrongWay: false,
        lastCp: 0,
        rivals: spawnRivals(map),
        place: 1,
        lightT: 0,
        racing: false,
        goT: 0,
        clashT: 0,
        clashX: car.x,
        clashY: car.y,
        clashImpact: 0,
        debris: spawnDebris(map),
        gear: "N",
        gearNum: 1,
        usingNitro: false,
        driftHold: 0,
    };
    updatePlace(race);
    return race;
}
export function tunedStats(owned) {
    const base = carById(owned.id);
    const e = 1 + owned.engine * 0.09;
    const t = 1 + owned.tires * 0.07;
    const c = 1 + owned.chassis * 0.07;
    const n = 1 + owned.nitro * 0.1;
    return {
        ...base,
        power: base.power * e,
        brake: base.brake * (1 + owned.engine * 0.03),
        gripF: base.gripF * t,
        gripR: base.gripR * t,
        turn: base.turn * c,
        nitro: base.nitro * n,
        mass: base.mass * (1 - owned.chassis * 0.015),
    };
}
function resolveBarrier(x, y, yaw, map) {
    const hit = closestOnTrack({ x, y }, map.points);
    const face = map.width * 0.5 + BARRIER_FACE;
    const side = (x - hit.x) * hit.nx + (y - hit.y) * hit.ny;
    const sgn = side >= 0 ? 1 : -1;
    const nx = hit.nx * sgn;
    const ny = hit.ny * sgn;
    const ext = carExtentAlong(yaw, nx, ny);
    const limit = face - ext;
    const pen = hit.dist - limit;
    return { hit, nx, ny, pen, limit, inside: hit.dist + 0.35 <= map.width * 0.5 };
}
function markClash(race, x, y, impact) {
    if (impact < 3)
        return;
    if (impact >= race.clashImpact || race.clashT <= 0) {
        race.clashX = x;
        race.clashY = y;
        race.clashImpact = Math.max(race.clashImpact, impact);
    }
    race.clashT = Math.max(race.clashT, 0.22);
}
function separateCircles(ax, ay, bx, by, ar, br) {
    const dx = bx - ax;
    const dy = by - ay;
    const d2 = dx * dx + dy * dy;
    const minD = ar + br;
    if (d2 >= minD * minD || d2 < 1e-8)
        return null;
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, pen: minD - d };
}
function collideBodies(a, b, massA, massB) {
    const ca = carCircles(a.x, a.y, a.yaw);
    const cb = carCircles(b.x, b.y, b.yaw);
    let best = null;
    for (const p of ca) {
        for (const q of cb) {
            const hit = separateCircles(p.x, p.y, q.x, q.y, p.r, q.r);
            if (!hit)
                continue;
            if (!best || hit.pen > best.pen) {
                best = {
                    nx: hit.nx,
                    ny: hit.ny,
                    pen: hit.pen,
                    ix: (p.x + q.x) * 0.5,
                    iy: (p.y + q.y) * 0.5,
                };
            }
        }
    }
    if (!best)
        return 0;
    const shareA = massB / (massA + massB);
    const shareB = massA / (massA + massB);
    a.x -= best.nx * best.pen * shareA;
    a.y -= best.ny * best.pen * shareA;
    b.x += best.nx * best.pen * shareB;
    b.y += best.ny * best.pen * shareB;
    const fa = yawToForward(a.yaw);
    const ra = yawToRight(a.yaw);
    const fb = yawToForward(b.yaw);
    const rb = yawToRight(b.yaw);
    let avx = a.u * fa.x + a.v * ra.x;
    let avy = a.u * fa.y + a.v * ra.y;
    let bvx = b.u * fb.x + b.v * rb.x;
    let bvy = b.u * fb.y + b.v * rb.y;
    const rel = (avx - bvx) * best.nx + (avy - bvy) * best.ny;
    if (rel < 0) {
        const e = 0.28;
        const j = (-(1 + e) * rel) / (1 / massA + 1 / massB);
        avx += (j / massA) * best.nx;
        avy += (j / massA) * best.ny;
        bvx -= (j / massB) * best.nx;
        bvy -= (j / massB) * best.ny;
        a.u = avx * fa.x + avy * fa.y;
        a.v = avx * ra.x + avy * ra.y;
        b.u = bvx * fb.x + bvy * fb.y;
        b.v = bvx * rb.x + bvy * rb.y;
    }
    return Math.max(0, -rel) + best.pen * 8;
}
export function stepCar(race, owned, act, dt, steerScale) {
    const st = tunedStats(owned);
    const car = race.car;
    const map = race.map;
    const throttle = act.throttle;
    const brake = act.brake;
    const steerIn = clamp(act.steer * steerScale, -1, 1);
    const hb = act.handbrake;
    let accel = 0;
    if (throttle > 0) {
        if (car.u < -0.85)
            accel += throttle * (st.brake / st.mass);
        else
            accel += throttle * (st.power / st.mass);
    }
    if (brake > 0) {
        if (car.u > 0.85)
            accel -= brake * (st.brake / st.mass);
        else
            accel -= brake * ((st.power * 0.42) / st.mass);
    }
    if (hb)
        accel -= 14 * Math.sign(car.u || 1);
    const speedMul = map.speedMul ?? 1;
    race.usingNitro = false;
    if (act.nitro && car.nitro > 0.05 && car.u > -0.5) {
        accel += 14 * st.nitro;
        car.nitro = Math.max(0, car.nitro - dt * 0.35);
        race.boostT = 0.25;
        race.usingNitro = true;
    }
    if (race.boostT > 0) {
        accel += 7.5 * st.nitro;
        race.boostT -= dt;
        race.usingNitro = true;
    }
    accel -= (0.42 * car.u * Math.abs(car.u) + 18 * car.u) / st.mass;
    if (car.offTrack > 0.45)
        accel -= (2600 * car.u) / st.mass;
    car.u += accel * dt;
    const speedCap = 78 * speedMul;
    if (car.u > speedCap)
        car.u = speedCap;
    if (car.u < -24 * speedMul)
        car.u = -24 * speedMul;
    const speedAbs = Math.abs(car.u);
    const speed = Math.hypot(car.u, car.v);
    car.speed = speed;
    race.gear = car.u < -1.1 ? "R" : speedAbs < 0.55 ? "N" : "D";
    race.gearNum = race.gear !== "D" ? 0 : Math.min(6, Math.max(1, Math.ceil(clamp(speedAbs / speedCap, 0, 1) * 6)));
    const speedFactor = clamp(speedAbs / 5.5, 0, 1) * clamp(1.18 - speedAbs / 78, 0.42, 1);
    const turnRate = 2.2 * st.turn;
    const reverseSign = car.u >= 0 ? 1 : -1;
    const autoDrift = Math.abs(steerIn) > 0.2 && car.u > 7 && car.offTrack < 0.95;
    const drifting = (hb && car.u > 5) || autoDrift;
    car.drifting = drifting;
    let yawRate = steerIn * turnRate * speedFactor * reverseSign;
    if (drifting) {
        yawRate *= hb ? 1.55 : 1.28;
        const wantV = -steerIn * Math.min(car.u * (hb ? 0.48 : 0.36), hb ? 16 : 12);
        car.v += (wantV - car.v) * Math.min(1, 7.2 * dt);
        car.u *= 1 - (hb ? 0.55 : 0.22) * dt;
    }
    else {
        car.v *= 1 - 9.5 * dt;
        if (Math.abs(steerIn) < 0.08)
            car.v *= 1 - 6 * dt;
    }
    car.r = yawRate;
    car.yaw = wrapAngle(car.yaw + car.r * dt);
    const f2 = yawToForward(car.yaw);
    const r2 = yawToRight(car.yaw);
    car.x += (car.u * f2.x + car.v * r2.x) * dt;
    car.y += (car.u * f2.y + car.v * r2.y) * dt;
    const slip = Math.abs(Math.atan2(car.v, Math.max(speedAbs, 0.4)));
    car.slip = slip;
    if (drifting) {
        const add = (14 + slip * 48) * race.combo * dt;
        race.driftScore += add;
        race.driftHold += add;
        race.comboT = 1.1;
        race.combo = clamp(race.combo + dt * 0.4, 1, 8);
        car.nitro = clamp(car.nitro + dt * (0.14 + race.combo * 0.012), 0, 1);
    }
    else {
        if (race.driftHold > 20) {
            race.boostT = Math.max(race.boostT, 0.4);
            race.usingNitro = true;
        }
        race.driftHold = 0;
        race.comboT -= dt;
        if (race.comboT <= 0)
            race.combo = 1;
    }
    const wall = resolveBarrier(car.x, car.y, car.yaw, map);
    car.offTrack = clamp((wall.hit.dist - (map.width * 0.5 - 1.1)) / 4, 0, 1);
    if (wall.inside) {
        car.lastOn = { x: car.x, y: car.y };
        car.lastYaw = car.yaw;
        race.offTimer = 0;
    }
    else {
        race.offTimer += dt;
    }
    let event = drifting ? "drift" : "ok";
    if (wall.pen > 0) {
        car.x -= wall.nx * (wall.pen + 0.04);
        car.y -= wall.ny * (wall.pen + 0.04);
        const vx = car.u * f2.x + car.v * r2.x;
        const vy = car.u * f2.y + car.v * r2.y;
        const nDot = vx * wall.nx + vy * wall.ny;
        const tx = vx - nDot * wall.nx;
        const ty = vy - nDot * wall.ny;
        const bounce = nDot > 0 ? -nDot * 0.22 : 0;
        const nvx = tx * 0.62 + wall.nx * bounce;
        const nvy = ty * 0.62 + wall.ny * bounce;
        car.u = nvx * f2.x + nvy * f2.y;
        car.v = nvx * r2.x + nvy * r2.y;
        car.r *= 0.4;
        const aHit = map.points[wall.hit.idx];
        const bHit = map.points[(wall.hit.idx + 1) % map.points.length];
        const trackYaw = headingFrom(bHit.x - aHit.x, bHit.y - aHit.y);
        car.yaw = wrapAngle(car.yaw + wrapAngle(trackYaw - car.yaw) * 0.18);
        markClash(race, car.x, car.y, Math.max(0, nDot));
        const impact = Math.max(0, nDot);
        if (impact > 26 && speed > 28 && !race.finished) {
            race.lives -= 1;
            respawn(race);
            return "crash";
        }
        event = "wall";
    }
    const aDir = map.points[wall.hit.idx];
    const bDir = map.points[(wall.hit.idx + 1) % map.points.length];
    const trackDir = headingFrom(bDir.x - aDir.x, bDir.y - aDir.y);
    race.wrongWay = speed > 4 && Math.abs(wrapAngle(car.yaw - trackDir)) > 2.1;
    return event;
}
export function respawn(race) {
    const car = race.car;
    const cp = race.map.checkpoints[race.lastCp] ?? race.map.checkpoints[0];
    const mx = (cp.a.x + cp.b.x) * 0.5;
    const my = (cp.a.y + cp.b.y) * 0.5;
    const idx = Math.floor(cp.t * race.map.points.length) % race.map.points.length;
    const a = race.map.points[idx];
    const b = race.map.points[(idx + 1) % race.map.points.length];
    car.x = mx;
    car.y = my;
    car.yaw = headingFrom(b.x - a.x, b.y - a.y);
    car.u = 6;
    car.v = 0;
    car.r = 0;
    car.offTrack = 0;
    race.offTimer = 0;
    if (race.lives <= 0)
        race.lost = true;
}
export function skipLights(race) {
    race.lightT = LIGHT_TOTAL;
    race.racing = true;
    race.goT = 0;
}
function keepRivalOnTrack(r, map) {
    const wall = resolveBarrier(r.x, r.y, r.yaw, map);
    if (wall.pen > 0) {
        r.x -= wall.nx * (wall.pen + 0.05);
        r.y -= wall.ny * (wall.pen + 0.05);
        const ta = map.points[wall.hit.idx];
        const tb = map.points[(wall.hit.idx + 1) % map.points.length];
        r.yaw = lerpAngle(r.yaw, headingFrom(tb.x - ta.x, tb.y - ta.y), 0.65);
    }
}
export function stepRivals(race, dt) {
    if (!race.racing)
        return;
    const pts = race.map.points;
    const length = race.map.length;
    const half = race.map.width * 0.5;
    const laneMax = half * 0.36;
    for (const r of race.rivals) {
        if (r.hitT > 0)
            r.hitT -= dt;
        const here = pointAlong(pts, r.tAlong, length);
        const ahead = pointAlong(pts, r.tAlong + 16, length);
        const further = pointAlong(pts, r.tAlong + 28, length);
        const kappa = Math.abs(wrapAngle(further.yaw - here.yaw));
        const slow = clamp(kappa / 1.35, 0, 0.32);
        const vmax = r.maxSpeed * (1 - slow);
        if (r.u < vmax)
            r.u += r.accel * (1 - slow * 0.25) * dt;
        else
            r.u -= r.accel * 0.8 * dt;
        r.u = clamp(r.u, 18, r.maxSpeed);
        const prevAlong = r.tAlong;
        r.tAlong += r.u * dt;
        if (r.tAlong >= length) {
            r.tAlong -= length;
            r.lap += 1;
        }
        else if (prevAlong > length * 0.78 && r.tAlong < length * 0.22) {
            r.lap += 1;
        }
        const pos = pointAlong(pts, r.tAlong, length);
        const rr = yawToRight(pos.yaw);
        r.lane = clamp(r.lane, -laneMax, laneMax);
        const wantX = pos.x + rr.x * r.lane;
        const wantY = pos.y + rr.y * r.lane;
        r.x = lerp(r.x, wantX, Math.min(1, 9.5 * dt));
        r.y = lerp(r.y, wantY, Math.min(1, 9.5 * dt));
        const lookYaw = lerpAngle(pos.yaw, ahead.yaw, 0.45);
        r.yaw = lerpAngle(r.yaw, lookYaw, Math.min(1, 12 * dt));
        r.speed = r.u;
        keepRivalOnTrack(r, race.map);
    }
    for (let i = 0; i < race.rivals.length; i++) {
        for (let j = i + 1; j < race.rivals.length; j++) {
            const a = race.rivals[i];
            const b = race.rivals[j];
            const dummyA = { x: a.x, y: a.y, yaw: a.yaw, u: a.u, v: 0 };
            const dummyB = { x: b.x, y: b.y, yaw: b.yaw, u: b.u, v: 0 };
            const impact = collideBodies(dummyA, dummyB, 1300, 1300);
            a.x = dummyA.x;
            a.y = dummyA.y;
            a.u = Math.max(18, dummyA.u);
            a.yaw = dummyA.yaw;
            b.x = dummyB.x;
            b.y = dummyB.y;
            b.u = Math.max(18, dummyB.u);
            b.yaw = dummyB.yaw;
            if (impact > 4) {
                a.lane = clamp(a.lane - 0.7, -laneMax, laneMax);
                b.lane = clamp(b.lane + 0.7, -laneMax, laneMax);
            }
        }
    }
}
function updatePlace(race) {
    const pts = race.map.points;
    const length = race.map.length;
    const playerHit = closestOnTrack({ x: race.car.x, y: race.car.y }, pts);
    let playerAlong = playerHit.tAlong;
    if (race.nextCp <= 1 && playerAlong > length * 0.8)
        playerAlong -= length;
    // On the frame the player crosses the finish line, checkGates() sets
    // race.finished without bumping race.lap (the race is over, there's no
    // "next lap"), while playerAlong has already wrapped back down near 0
    // for that same frame. Treat a finished race as having completed the
    // lap so the player's final progress isn't understated by ~1 lap,
    // which used to make every finish register as last place.
    const lapsDone = race.finished ? race.lap : race.lap - 1;
    const playerProg = lapsDone * length + playerAlong;
    let place = 1;
    for (const r of race.rivals) {
        const rp = (r.lap - 1) * length + r.tAlong;
        if (rp > playerProg + 0.4)
            place += 1;
    }
    race.place = place;
}
function collidePlayerRivals(race) {
    const car = race.car;
    const player = { x: car.x, y: car.y, yaw: car.yaw, u: car.u, v: car.v };
    let bestImpact = 0;
    let hx = car.x;
    let hy = car.y;
    const half = race.map.width * 0.5;
    const laneMax = half * 0.36;
    for (const r of race.rivals) {
        const rival = { x: r.x, y: r.y, yaw: r.yaw, u: r.u, v: 0 };
        const impact = collideBodies(player, rival, 1250, 1320);
        r.x = rival.x;
        r.y = rival.y;
        r.yaw = rival.yaw;
        r.u = Math.max(16, rival.u);
        if (impact > 2) {
            r.hitT = 0.28;
            const side = Math.sign((r.x - car.x) * yawToRight(car.yaw).x + (r.y - car.y) * yawToRight(car.yaw).y) || 1;
            r.lane = clamp(r.lane + side * 0.85, -laneMax, laneMax);
            keepRivalOnTrack(r, race.map);
            if (impact > bestImpact) {
                bestImpact = impact;
                hx = (player.x + r.x) * 0.5;
                hy = (player.y + r.y) * 0.5;
            }
        }
    }
    car.x = player.x;
    car.y = player.y;
    car.yaw = player.yaw;
    car.u = player.u;
    car.v = player.v;
    const wall = resolveBarrier(car.x, car.y, car.yaw, race.map);
    if (wall.pen > 0) {
        car.x -= wall.nx * (wall.pen + 0.04);
        car.y -= wall.ny * (wall.pen + 0.04);
    }
    if (bestImpact > 3)
        markClash(race, hx, hy, bestImpact);
    return bestImpact;
}
function stepAllDebris(race) {
    const car = race.car;
    for (const d of race.debris) {
        const slow = hitDebris(d, car.x, car.y, car.u, car.yaw);
        if (slow > 0)
            car.u -= Math.sign(car.u || 1) * slow;
        for (const r of race.rivals) {
            hitDebris(d, r.x, r.y, r.u, r.yaw);
        }
        stepDebrisItem(d, FIXED_DT);
    }
}
export function stepRace(race, owned, act, dt, steerScale) {
    if (race.finished || race.lost)
        return { event: "idle" };
    if (race.clashT > 0)
        race.clashT -= dt;
    else
        race.clashImpact = 0;
    if (!race.racing) {
        const before = lightPhase(race.lightT);
        race.lightT += dt;
        const after = lightPhase(race.lightT);
        race.car.u = 0;
        race.car.v = 0;
        race.car.r = 0;
        race.car.speed = 0;
        for (const r of race.rivals) {
            r.u = 0;
            r.speed = 0;
        }
        let event = "countdown";
        if (after.reds > before.reds)
            event = "red";
        if (after.racing && !before.racing) {
            race.racing = true;
            race.goT = 0.9;
            event = "green";
        }
        return { event };
    }
    if (race.goT > 0)
        race.goT -= dt;
    race.prev = { x: race.car.x, y: race.car.y };
    let event = stepCar(race, owned, act, dt, steerScale);
    stepRivals(race, dt);
    const clash = collidePlayerRivals(race);
    if (clash > 6 && event !== "crash")
        event = "clash";
    stepAllDebris(race);
    race.time += dt;
    if (race.offTimer > 4.2) {
        race.lives -= 1;
        race.offTimer = 0;
        respawn(race);
        return { event: "crash" };
    }
    checkGates(race);
    // Recompute place after checkGates so it reflects this frame's
    // lap/finish state (fixes place being wrong at the exact moment a
    // race finishes - see the comment in updatePlace()).
    updatePlace(race);
    if (race.lives <= 0)
        race.lost = true;
    return { event };
}
function checkGates(race) {
    const map = race.map;
    const from = race.prev;
    const to = { x: race.car.x, y: race.car.y };
    const n = map.checkpoints.length;
    const expect = race.nextCp % n;
    const gate = map.checkpoints[expect];
    if (segmentsIntersect(from, to, gate.a, gate.b)) {
        if (expect === 0 && race.nextCp > 0) {
            if (race.lap >= map.laps) {
                race.finished = true;
                return;
            }
            race.lap += 1;
            race.nextCp = 1;
            race.lastCp = 0;
            return;
        }
        race.lastCp = expect;
        race.nextCp = expect + 1;
    }
}
export const FIXED_DT = STEP;