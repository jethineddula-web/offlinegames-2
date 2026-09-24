export const SAVE_VERSION = 3;
export const SAVE_KEY = "apex-drift-save-v2";
export const AD_CLIENT = "ca-pub-4203857211510947";
export const AD_SLOT_BANNER = "7417753724";
export function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}
export function lerp(a, b, t) {
    return a + (b - a) * t;
}
export function expLerp(current, target, k, dt) {
    return current + (target - current) * (1 - Math.exp(-k * dt));
}
export function wrapAngle(a) {
    return Math.atan2(Math.sin(a), Math.cos(a));
}
export function lerpAngle(a, b, t) {
    return a + wrapAngle(b - a) * t;
}
export function dist2(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}
export function mulberry(seed) {
    let s = seed | 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) | 0;
        return (s >>> 0) / 4294967296;
    };
}
export function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return {
        x: 0.5 *
            (2 * p1.x +
                (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 *
            (2 * p1.y +
                (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    };
}
export function resampleClosed(src, spacing) {
    if (src.length < 3)
        return src.slice();
    const closed = src.slice();
    const out = [];
    const n = closed.length;
    const segLen = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
        const a = closed[i];
        const b = closed[(i + 1) % n];
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        segLen.push(l);
        total += l;
    }
    const count = Math.max(48, Math.round(total / spacing));
    const step = total / count;
    let si = 0;
    let acc = 0;
    for (let i = 0; i < count; i++) {
        const target = i * step;
        while (si < n && acc + segLen[si] < target) {
            acc += segLen[si];
            si++;
        }
        const a = closed[si % n];
        const b = closed[(si + 1) % n];
        const sl = segLen[si % n] || 1;
        const t = (target - acc) / sl;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    return out;
}
export function smoothClosed(src, samplesPerSeg = 6) {
    const n = src.length;
    const out = [];
    for (let i = 0; i < n; i++) {
        const p0 = src[(i - 1 + n) % n];
        const p1 = src[i];
        const p2 = src[(i + 1) % n];
        const p3 = src[(i + 2) % n];
        for (let s = 0; s < samplesPerSeg; s++) {
            out.push(catmull(p0, p1, p2, p3, s / samplesPerSeg));
        }
    }
    return resampleClosed(out, 4.2);
}
export function yawToForward(yaw) {
    return { x: -Math.sin(yaw), y: Math.cos(yaw) };
}
export function yawToRight(yaw) {
    return { x: Math.cos(yaw), y: Math.sin(yaw) };
}
export function headingFromDir(dx, dy) {
    return Math.atan2(-dx, dy);
}
export function segmentsIntersect(a, b, c, d) {
    const den = (d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y);
    if (Math.abs(den) < 1e-8)
        return false;
    const ua = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / den;
    const ub = ((b.x - a.x) * (a.y - c.y) - (b.y - a.y) * (a.x - c.x)) / den;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}
export function closestOnTrack(p, pts) {
    let best = 1e12;
    let x = pts[0].x;
    let y = pts[0].y;
    let nx = 0;
    let ny = 1;
    let idx = 0;
    let tAlong = 0;
    let acc = 0;
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const len2 = abx * abx + aby * aby || 1;
        const len = Math.sqrt(len2);
        let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
        t = clamp(t, 0, 1);
        const qx = a.x + abx * t;
        const qy = a.y + aby * t;
        const dx = p.x - qx;
        const dy = p.y - qy;
        const d = dx * dx + dy * dy;
        if (d < best) {
            best = d;
            x = qx;
            y = qy;
            const inv = 1 / len;
            nx = -aby * inv;
            ny = abx * inv;
            idx = i;
            tAlong = acc + t * len;
        }
        acc += len;
    }
    return { x, y, dist: Math.sqrt(best), nx, ny, idx, tAlong, length: acc };
}
