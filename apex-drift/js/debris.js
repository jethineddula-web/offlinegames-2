import * as THREE from "three";
import { mulberry, yawToForward } from "./types.js";
const KINDS = {
    beach: ["barrier", "cone", "bin", "tire"],
    coast: ["barrier", "barrel", "cone", "tire"],
    city: ["barrier", "sign", "bin", "cone"],
    night: ["barrier", "sign", "bin", "cone"],
    desert: ["barrel", "crate", "cone"],
    alpine: ["barrier", "cone", "crate"],
    forest: ["crate", "cone", "bin"],
    industrial: ["barrel", "crate", "cone", "bin", "tire"],
    snow: ["barrier", "cone", "crate"],
    canyon: ["barrel", "crate", "cone"],
    volcano: ["barrel", "crate", "cone"],
    sunset: ["barrier", "sign", "cone"],
};
function emptyDebris(kind, x, y, yaw) {
    const r = kind === "barrier" ? 0.95 : kind === "sign" ? 0.4 : kind === "tire" ? 0.55 : kind === "crate" ? 0.7 : kind === "barrel" ? 0.55 : 0.48;
    return {
        kind,
        x,
        y,
        h: 0,
        yaw,
        pitch: 0,
        roll: 0,
        vx: 0,
        vy: 0,
        vh: 0,
        wx: 0,
        wy: 0,
        wz: 0,
        r,
        flying: false,
    };
}
export function spawnDebris(map) {
    const rand = mulberry(map.seed + 91);
    const kinds = KINDS[map.theme] ?? KINDS.city;
    const pts = map.points;
    const n = pts.length;
    const half = map.width * 0.5;
    const out = [];
    const count = 28;
    for (let i = 0; i < count; i++) {
        const idx = Math.floor(((i + 0.37) / count) * n) % n;
        const a = pts[idx];
        const b = pts[(idx + 1) % n];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const side = i % 2 === 0 ? 1 : -1;
        const inset = 1.15 + rand() * 1.35;
        const along = (rand() - 0.5) * 2.4;
        const x = a.x + nx * side * (half - inset) + (dx / len) * along;
        const y = a.y + ny * side * (half - inset) + (dy / len) * along;
        const kind = kinds[Math.floor(rand() * kinds.length)];
        const yaw = Math.atan2(dy, dx) + (rand() - 0.5) * 0.8;
        out.push(emptyDebris(kind, x, y, yaw));
    }
    return out;
}
function mat(color, rough = 0.7, metal = 0.05) {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
function barrierMesh() {
    const g = new THREE.Group();
    const board = mat(0xe8541a, 0.6);
    const stripe = mat(0xf4f4f5, 0.55);
    const foot = mat(0x1a1c20, 0.7);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.32, 0.06), board);
    panel.position.y = 0.55;
    g.add(panel);
    for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.062), stripe);
        s.position.set(-0.4 + i * 0.4, 0.55, 0.001);
        g.add(s);
    }
    for (const x of [-0.5, 0.5]) {
        const legA = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.5), foot);
        legA.position.set(x, 0.3, 0);
        legA.rotation.x = 0.55;
        g.add(legA);
        const legB = legA.clone();
        legB.rotation.x = -0.55;
        g.add(legB);
    }
    return g;
}
function signMesh() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.7, 8), mat(0x8a8c90, 0.4, 0.6));
    pole.position.y = 0.85;
    g.add(pole);
    const board = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 3), mat(0xffb020, 0.5));
    board.rotation.x = Math.PI / 2;
    board.rotation.z = Math.PI;
    board.position.y = 1.55;
    g.add(board);
    return g;
}
function tireMesh() {
    const g = new THREE.Group();
    const rubber = mat(0x1c1c1e, 0.9);
    for (let i = 0; i < 3; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.16, 8, 16), rubber);
        t.rotation.x = Math.PI / 2;
        t.position.y = 0.18 + i * 0.32;
        g.add(t);
    }
    return g;
}
function coneMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 10), mat(0xff5a1a, 0.45));
    body.position.y = 0.42;
    g.add(body);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.08, 10), mat(0xf4f4f5, 0.5));
    stripe.position.y = 0.38;
    g.add(stripe);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), mat(0x1a1c20, 0.7));
    base.position.y = 0.03;
    g.add(base);
    return g;
}
function barrelMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.78, 12), mat(0x8a4a18, 0.55, 0.15));
    body.position.y = 0.39;
    g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.03, 6, 12), mat(0xc8ccd0, 0.35, 0.7));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.55;
    g.add(ring);
    const ring2 = ring.clone();
    ring2.position.y = 0.22;
    g.add(ring2);
    return g;
}
function crateMesh() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mat(0x8a6a38, 0.75));
    box.position.y = 0.35;
    g.add(box);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.08, 0.74), mat(0x5a4020, 0.7));
    edge.position.y = 0.68;
    g.add(edge);
    return g;
}
function binMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.7, 10), mat(0x2a6a48, 0.55, 0.2));
    body.position.y = 0.35;
    g.add(body);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 10), mat(0x1a1c20, 0.5, 0.3));
    lid.position.y = 0.72;
    g.add(lid);
    return g;
}
export function createDebrisMesh(kind) {
    switch (kind) {
        case "barrier":
            return barrierMesh();
        case "sign":
            return signMesh();
        case "tire":
            return tireMesh();
        case "cone":
            return coneMesh();
        case "barrel":
            return barrelMesh();
        case "crate":
            return crateMesh();
        case "bin":
            return binMesh();
    }
}
export function poseDebris(mesh, d) {
    mesh.position.set(d.x, d.h, -d.y);
    mesh.rotation.set(d.pitch, d.yaw, d.roll);
}
export function hitDebris(d, cx, cy, cu, yaw) {
    const dx = d.x - cx;
    const dy = d.y - cy;
    const dist = Math.hypot(dx, dy);
    const reach = d.r + 1.55;
    if (dist > reach)
        return 0;
    const speed = Math.abs(cu);
    if (speed < 2.2 && dist > d.r + 0.85)
        return 0;
    const f = yawToForward(yaw);
    const nx = dist > 1e-3 ? dx / dist : f.x;
    const ny = dist > 1e-3 ? dy / dist : f.y;
    const push = 5.5 + speed * 0.95;
    d.vx = nx * push + f.x * speed * 0.55;
    d.vy = ny * push + f.y * speed * 0.55;
    d.vh = 6.5 + speed * 0.28;
    d.wx = (Math.random() - 0.5) * 16;
    d.wy = (Math.random() - 0.5) * 20;
    d.wz = (Math.random() - 0.5) * 16;
    d.flying = true;
    const pen = reach - dist;
    if (pen > 0) {
        d.x += nx * (pen + 0.05);
        d.y += ny * (pen + 0.05);
    }
    return Math.min(4.5, speed * 0.12);
}
export function stepDebrisItem(d, dt) {
    if (!d.flying && Math.hypot(d.vx, d.vy, d.vh) < 0.05)
        return;
    d.vh -= 22 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.h += d.vh * dt;
    d.yaw += d.wy * dt;
    d.pitch += d.wx * dt;
    d.roll += d.wz * dt;
    d.vx *= 1 - 0.55 * dt;
    d.vy *= 1 - 0.55 * dt;
    if (d.h <= 0) {
        d.h = 0;
        if (d.vh < -3.2) {
            d.vh *= -0.38;
            d.vx *= 0.55;
            d.vy *= 0.55;
            d.wx *= 0.55;
            d.wy *= 0.55;
            d.wz *= 0.55;
            d.flying = true;
        }
        else {
            d.vh = 0;
            d.vx *= 0.72;
            d.vy *= 0.72;
            d.wx *= 0.6;
            d.wy *= 0.6;
            d.wz *= 0.6;
            d.pitch *= 0.72;
            d.roll *= 0.72;
            if (Math.hypot(d.vx, d.vy) < 0.35 && Math.abs(d.wx) + Math.abs(d.wy) + Math.abs(d.wz) < 0.9) {
                d.vx = 0;
                d.vy = 0;
                d.wx = 0;
                d.wy = 0;
                d.wz = 0;
                d.flying = false;
            }
        }
    }
}
