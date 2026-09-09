import * as THREE from "three";
import { carById } from "./data.js";
const cache = new Map();
function hex(c) {
    return new THREE.Color(c);
}
function makeMats(color, accent) {
    const key = `${color}|${accent}`;
    const hit = cache.get(key);
    if (hit)
        return hit;
    const paint = new THREE.MeshPhysicalMaterial({
        color: hex(color),
        metalness: 0.72,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.35,
    });
    const paintDark = new THREE.MeshPhysicalMaterial({
        color: hex(color).multiplyScalar(0.55),
        metalness: 0.7,
        roughness: 0.28,
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
    });
    const mats = {
        paint,
        paintDark,
        carbon: new THREE.MeshStandardMaterial({
            color: 0x121214,
            metalness: 0.45,
            roughness: 0.38,
        }),
        rubber: new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.92, metalness: 0.05 }),
        rim: new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.85, roughness: 0.28 }),
        chrome: new THREE.MeshStandardMaterial({ color: 0xc8ccd4, metalness: 1, roughness: 0.12 }),
        glass: new THREE.MeshPhysicalMaterial({
            color: 0x8aa0b4,
            metalness: 0.1,
            roughness: 0.04,
            transmission: 0.55,
            thickness: 0.12,
            transparent: true,
            opacity: 0.55,
            envMapIntensity: 1.4,
        }),
        darkGlass: new THREE.MeshPhysicalMaterial({
            color: 0x14161a,
            metalness: 0.2,
            roughness: 0.08,
            transparent: true,
            opacity: 0.72,
        }),
        interior: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.7 }),
        seat: new THREE.MeshStandardMaterial({ color: hex(accent).getHex() === 0x1c1e22 ? 0xc45a28 : hex(accent), roughness: 0.55 }),
        lightRed: new THREE.MeshStandardMaterial({
            color: 0xff2a22,
            emissive: 0xff1a12,
            emissiveIntensity: 1.8,
            roughness: 0.25,
        }),
        lightWhite: new THREE.MeshStandardMaterial({
            color: 0xf4f4f5,
            emissive: 0xf0f4ff,
            emissiveIntensity: 1.4,
            roughness: 0.2,
        }),
        glow: new THREE.MeshStandardMaterial({
            color: 0xff6a22,
            emissive: 0xff4a10,
            emissiveIntensity: 2.2,
        }),
        disc: new THREE.MeshStandardMaterial({ color: 0x3a3c42, metalness: 0.7, roughness: 0.35 }),
    };
    cache.set(key, mats);
    return mats;
}
function box(parent, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx || ry || rz)
        m.rotation.set(rx, ry, rz);
    m.castShadow = false;
    parent.add(m);
    return m;
}
function cyl(parent, mat, rTop, rBot, h, x, y, z, rx = 0, ry = 0, rz = 0, segs = 16) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
}
function makeWheel(mats, radius, width) {
    const g = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, radius * 0.28, 10, 24), mats.rubber);
    tire.rotation.y = Math.PI / 2;
    g.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.52, radius * 0.52, width * 0.55, 18), mats.rim);
    rim.rotation.z = Math.PI / 2;
    g.add(rim);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.22, radius * 0.22, width * 0.7, 12), mats.disc);
    disc.rotation.z = Math.PI / 2;
    g.add(disc);
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(width * 0.18, radius * 0.08, radius * 0.85), mats.chrome);
        spoke.position.set(0, Math.sin(a) * radius * 0.22, Math.cos(a) * radius * 0.22);
        spoke.rotation.x = a;
        g.add(spoke);
    }
    const lip = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.55, 0.025, 6, 20), mats.chrome);
    lip.rotation.y = Math.PI / 2;
    g.add(lip);
    return g;
}
// ---------------------------------------------------------------------------
// Body builders. Each takes (body, mats), fills the `body` group with meshes,
// and returns { brakeMat, wheelSpecs, flameSpecs, shadowRx, shadowRz }.
// wheelSpecs MUST list [frontLeft, frontRight, rearLeft, rearRight] in that
// order — poseCar() steers the first two entries as the front axle.
// ---------------------------------------------------------------------------
function buildSpyderBody(body, mats) {
    // Lower hull — wide supercar wedge, nose +Z
    box(body, mats.paint, 1.86, 0.38, 4.15, 0, 0.42, 0.05);
    box(body, mats.paint, 1.72, 0.22, 3.6, 0, 0.68, -0.05);
    // Side sills
    box(body, mats.carbon, 1.96, 0.14, 2.6, 0, 0.22, -0.1);
    // Front bumper / splitter
    box(body, mats.paint, 1.78, 0.22, 0.55, 0, 0.34, 2.05);
    box(body, mats.carbon, 1.7, 0.06, 0.7, 0, 0.2, 2.12);
    // Hood
    box(body, mats.paint, 1.55, 0.1, 1.15, 0, 0.78, 1.15);
    box(body, mats.carbon, 0.55, 0.04, 0.7, 0, 0.84, 1.2);
    // Front fenders
    box(body, mats.paint, 0.28, 0.32, 1.05, 0.9, 0.55, 1.25, 0, 0, -0.18);
    box(body, mats.paint, 0.28, 0.32, 1.05, -0.9, 0.55, 1.25, 0, 0, 0.18);
    // Rear fenders
    box(body, mats.paint, 0.32, 0.38, 1.2, 0.92, 0.58, -1.2, 0, 0, 0.12);
    box(body, mats.paint, 0.32, 0.38, 1.2, -0.92, 0.58, -1.2, 0, 0, -0.12);
    // Cabin / windshield
    box(body, mats.darkGlass, 1.28, 0.42, 0.08, 0, 0.98, 0.72, -0.55, 0, 0);
    box(body, mats.glass, 0.06, 0.38, 0.9, 0.62, 0.95, 0.15, 0, 0, 0.18);
    box(body, mats.glass, 0.06, 0.38, 0.9, -0.62, 0.95, 0.15, 0, 0, -0.18);
    // Convertible cockpit
    box(body, mats.interior, 1.2, 0.16, 1.15, 0, 0.72, 0.05);
    // Seats (orange, like the reference spyder)
    box(body, mats.seat, 0.42, 0.28, 0.42, 0.28, 0.82, -0.05);
    box(body, mats.seat, 0.42, 0.12, 0.38, 0.28, 1.02, -0.22, 0.4, 0, 0);
    box(body, mats.seat, 0.42, 0.28, 0.42, -0.28, 0.82, -0.05);
    box(body, mats.seat, 0.42, 0.12, 0.38, -0.28, 1.02, -0.22, 0.4, 0, 0);
    // Roll hoops
    box(body, mats.carbon, 0.08, 0.42, 0.08, 0.34, 1.18, -0.38);
    box(body, mats.carbon, 0.08, 0.42, 0.08, -0.34, 1.18, -0.38);
    box(body, mats.carbon, 0.9, 0.06, 0.08, 0, 1.38, -0.38);
    // Steering
    cyl(body, mats.carbon, 0.14, 0.14, 0.03, -0.28, 0.98, 0.28, 1.1, 0, 0, 18);
    // Rear engine deck (black vents)
    box(body, mats.carbon, 1.55, 0.16, 1.35, 0, 0.82, -1.15);
    for (let i = 0; i < 6; i++) {
        box(body, mats.rim, 1.35, 0.02, 0.06, 0, 0.91, -0.55 - i * 0.16);
    }
    // Hex engine cover ridges
    box(body, mats.paintDark, 0.7, 0.08, 0.9, 0, 0.92, -1.05);
    // Rear bumper
    box(body, mats.paint, 1.78, 0.32, 0.42, 0, 0.48, -2.05);
    box(body, mats.carbon, 1.7, 0.18, 0.38, 0, 0.28, -2.12);
    // Diffuser fins
    for (let i = -3; i <= 3; i++) {
        box(body, mats.carbon, 0.04, 0.16, 0.32, i * 0.18, 0.16, -2.18);
    }
    // Central exhausts
    cyl(body, mats.chrome, 0.07, 0.07, 0.22, 0.12, 0.2, -2.22, Math.PI / 2, 0, 0, 12);
    cyl(body, mats.chrome, 0.07, 0.07, 0.22, -0.12, 0.2, -2.22, Math.PI / 2, 0, 0, 12);
    cyl(body, mats.carbon, 0.05, 0.05, 0.08, 0.12, 0.2, -2.32, Math.PI / 2, 0, 0, 10);
    cyl(body, mats.carbon, 0.05, 0.05, 0.08, -0.12, 0.2, -2.32, Math.PI / 2, 0, 0, 10);
    // Y-style taillights
    const brakeMat = mats.lightRed.clone();
    box(body, brakeMat, 0.42, 0.08, 0.05, 0.55, 0.7, -2.24);
    box(body, brakeMat, 0.08, 0.22, 0.05, 0.38, 0.62, -2.24);
    box(body, brakeMat, 0.42, 0.08, 0.05, -0.55, 0.7, -2.24);
    box(body, brakeMat, 0.08, 0.22, 0.05, -0.38, 0.62, -2.24);
    box(body, brakeMat, 0.28, 0.04, 0.04, 0, 0.42, -2.26);
    // Rear wing
    box(body, mats.carbon, 1.55, 0.06, 0.32, 0, 1.12, -2.02);
    box(body, mats.carbon, 0.06, 0.28, 0.18, 0.62, 0.98, -1.95);
    box(body, mats.carbon, 0.06, 0.28, 0.18, -0.62, 0.98, -1.95);
    box(body, mats.carbon, 0.04, 0.14, 0.28, 0.78, 1.16, -2.02);
    box(body, mats.carbon, 0.04, 0.14, 0.28, -0.78, 1.16, -2.02);
    // Side intakes
    box(body, mats.carbon, 0.18, 0.28, 0.55, 0.98, 0.5, -0.15);
    box(body, mats.carbon, 0.18, 0.28, 0.55, -0.98, 0.5, -0.15);
    box(body, mats.paint, 0.12, 0.22, 0.7, 1.02, 0.62, 0.35, 0, 0.15, 0);
    box(body, mats.paint, 0.12, 0.22, 0.7, -1.02, 0.62, 0.35, 0, -0.15, 0);
    // Mirrors
    box(body, mats.paint, 0.18, 0.08, 0.12, 0.78, 0.92, 0.55);
    box(body, mats.paint, 0.18, 0.08, 0.12, -0.78, 0.92, 0.55);
    box(body, mats.darkGlass, 0.14, 0.06, 0.02, 0.78, 0.92, 0.48);
    box(body, mats.darkGlass, 0.14, 0.06, 0.02, -0.78, 0.92, 0.48);
    // Headlights
    box(body, mats.lightWhite, 0.38, 0.08, 0.06, 0.58, 0.58, 2.28);
    box(body, mats.lightWhite, 0.38, 0.08, 0.06, -0.58, 0.58, 2.28);
    box(body, mats.chrome, 0.42, 0.12, 0.04, 0.58, 0.58, 2.24);
    box(body, mats.chrome, 0.42, 0.12, 0.04, -0.58, 0.58, 2.24);
    return {
        brakeMat,
        wheelSpecs: [
            { x: 0.82, z: 1.32, r: 0.33, w: 0.28 },
            { x: -0.82, z: 1.32, r: 0.33, w: 0.28 },
            { x: 0.86, z: -1.38, r: 0.35, w: 0.32 },
            { x: -0.86, z: -1.38, r: 0.35, w: 0.32 },
        ],
        flameSpecs: [
            { x: 0.12, y: 0.2, z: -2.55 },
            { x: -0.12, y: 0.2, z: -2.55 },
        ],
        shadowRx: 1.35,
        shadowRz: 1.7,
    };
}
function buildCoupeBody(body, mats) {
    // Compact tuner coupe — fixed roof, short overhangs, round lights
    box(body, mats.paint, 1.78, 0.36, 3.9, 0, 0.4, 0.05);
    box(body, mats.carbon, 1.9, 0.12, 2.4, 0, 0.2, -0.1);
    box(body, mats.paint, 1.5, 0.1, 1.1, 0, 0.72, 1.35);
    box(body, mats.paintDark, 0.4, 0.03, 0.6, 0, 0.78, 1.4);
    box(body, mats.paint, 1.7, 0.24, 0.45, 0, 0.34, 2.0);
    box(body, mats.carbon, 1.55, 0.08, 0.5, 0, 0.22, 2.08);
    box(body, mats.darkGlass, 1.2, 0.4, 0.06, 0, 0.98, 0.75, -0.5, 0, 0);
    box(body, mats.paint, 1.28, 0.06, 1.3, 0, 1.16, -0.05);
    box(body, mats.darkGlass, 1.1, 0.34, 0.06, 0, 1.0, -0.68, 0.42, 0, 0);
    box(body, mats.darkGlass, 0.06, 0.32, 1.1, 0.66, 0.98, 0.05, 0, 0, 0.12);
    box(body, mats.darkGlass, 0.06, 0.32, 1.1, -0.66, 0.98, 0.05, 0, 0, -0.12);
    box(body, mats.paint, 0.3, 0.3, 1.0, 0.9, 0.5, 1.3, 0, 0, -0.15);
    box(body, mats.paint, 0.3, 0.3, 1.0, -0.9, 0.5, 1.3, 0, 0, 0.15);
    box(body, mats.paint, 0.32, 0.32, 1.0, 0.94, 0.5, -1.15, 0, 0, 0.12);
    box(body, mats.paint, 0.32, 0.32, 1.0, -0.94, 0.5, -1.15, 0, 0, -0.12);
    box(body, mats.paint, 1.5, 0.14, 0.85, 0, 0.62, -1.7);
    box(body, mats.carbon, 1.35, 0.05, 0.22, 0, 0.78, -1.92);
    box(body, mats.paint, 1.68, 0.3, 0.4, 0, 0.42, -1.98);
    box(body, mats.carbon, 1.55, 0.14, 0.35, 0, 0.26, -2.05);
    for (const sx of [0.55, -0.55]) {
        cyl(body, mats.lightWhite, 0.14, 0.14, 0.08, sx, 0.56, 2.2, Math.PI / 2, 0, 0, 14);
        cyl(body, mats.chrome, 0.17, 0.17, 0.03, sx, 0.56, 2.16, Math.PI / 2, 0, 0, 14);
    }
    const brakeMat = mats.lightRed.clone();
    box(body, brakeMat, 0.4, 0.16, 0.05, 0.55, 0.62, -2.14);
    box(body, brakeMat, 0.4, 0.16, 0.05, -0.55, 0.62, -2.14);
    cyl(body, mats.chrome, 0.09, 0.09, 0.24, 0.35, 0.2, -2.12, Math.PI / 2, 0, 0, 12);
    box(body, mats.paint, 0.16, 0.08, 0.12, 0.76, 0.92, 0.6);
    box(body, mats.paint, 0.16, 0.08, 0.12, -0.76, 0.92, 0.6);
    return {
        brakeMat,
        wheelSpecs: [
            { x: 0.78, z: 1.2, r: 0.31, w: 0.25 },
            { x: -0.78, z: 1.2, r: 0.31, w: 0.25 },
            { x: 0.8, z: -1.25, r: 0.32, w: 0.28 },
            { x: -0.8, z: -1.25, r: 0.32, w: 0.28 },
        ],
        flameSpecs: [{ x: 0.35, y: 0.2, z: -2.25 }],
        shadowRx: 1.25,
        shadowRz: 1.55,
    };
}
function buildSedanGTBody(body, mats) {
    // Long 4-door grand tourer — flat continuous roof, chrome trim
    box(body, mats.paint, 1.82, 0.38, 4.5, 0, 0.42, 0);
    box(body, mats.carbon, 1.9, 0.1, 2.8, 0, 0.2, -0.05);
    box(body, mats.paint, 1.5, 0.08, 1.4, 0, 0.76, 1.55);
    box(body, mats.paint, 1.76, 0.24, 0.4, 0, 0.36, 2.25);
    box(body, mats.chrome, 1.4, 0.06, 0.06, 0, 0.5, 2.44);
    box(body, mats.darkGlass, 1.2, 0.36, 0.06, 0, 0.98, 1.0, -0.42, 0, 0);
    box(body, mats.paint, 1.26, 0.06, 2.0, 0, 1.14, -0.15);
    box(body, mats.darkGlass, 1.1, 0.32, 0.06, 0, 0.98, -1.28, 0.4, 0, 0);
    box(body, mats.darkGlass, 0.06, 0.3, 0.85, 0.64, 0.96, 0.55, 0, 0, 0.08);
    box(body, mats.darkGlass, 0.06, 0.3, 0.85, -0.64, 0.96, 0.55, 0, 0, -0.08);
    box(body, mats.darkGlass, 0.06, 0.3, 0.8, 0.64, 0.96, -0.45, 0, 0, 0.06);
    box(body, mats.darkGlass, 0.06, 0.3, 0.8, -0.64, 0.96, -0.45, 0, 0, -0.06);
    box(body, mats.paint, 0.08, 0.32, 0.06, 0.66, 0.96, 0.05);
    box(body, mats.paint, 0.08, 0.32, 0.06, -0.66, 0.96, 0.05);
    box(body, mats.paint, 0.26, 0.3, 1.0, 0.9, 0.52, 1.4, 0, 0, -0.12);
    box(body, mats.paint, 0.26, 0.3, 1.0, -0.9, 0.52, 1.4, 0, 0, 0.12);
    box(body, mats.paint, 0.26, 0.32, 1.0, 0.92, 0.54, -1.45, 0, 0, 0.1);
    box(body, mats.paint, 0.26, 0.32, 1.0, -0.92, 0.54, -1.45, 0, 0, -0.1);
    box(body, mats.paint, 1.6, 0.14, 0.9, 0, 0.62, -2.0);
    box(body, mats.carbon, 1.4, 0.04, 0.18, 0, 0.72, -2.35);
    box(body, mats.paint, 1.78, 0.3, 0.35, 0, 0.4, -2.3);
    box(body, mats.chrome, 1.5, 0.06, 0.04, 0, 0.52, -2.48);
    box(body, mats.lightWhite, 0.5, 0.06, 0.05, 0.58, 0.56, 2.42);
    box(body, mats.lightWhite, 0.5, 0.06, 0.05, -0.58, 0.56, 2.42);
    box(body, mats.chrome, 0.54, 0.1, 0.03, 0.58, 0.56, 2.38);
    box(body, mats.chrome, 0.54, 0.1, 0.03, -0.58, 0.56, 2.38);
    const brakeMat = mats.lightRed.clone();
    box(body, brakeMat, 1.5, 0.08, 0.04, 0, 0.68, -2.47);
    cyl(body, mats.chrome, 0.08, 0.08, 0.22, 0.3, 0.2, -2.45, Math.PI / 2, 0, 0, 12);
    cyl(body, mats.chrome, 0.08, 0.08, 0.22, -0.3, 0.2, -2.45, Math.PI / 2, 0, 0, 12);
    box(body, mats.paint, 0.18, 0.08, 0.12, 0.8, 0.92, 0.75);
    box(body, mats.paint, 0.18, 0.08, 0.12, -0.8, 0.92, 0.75);
    return {
        brakeMat,
        wheelSpecs: [
            { x: 0.82, z: 1.55, r: 0.33, w: 0.26 },
            { x: -0.82, z: 1.55, r: 0.33, w: 0.26 },
            { x: 0.84, z: -1.6, r: 0.34, w: 0.28 },
            { x: -0.84, z: -1.6, r: 0.34, w: 0.28 },
        ],
        flameSpecs: [
            { x: 0.3, y: 0.2, z: -2.55 },
            { x: -0.3, y: 0.2, z: -2.55 },
        ],
        shadowRx: 1.4,
        shadowRz: 1.95,
    };
}
function buildMuscleBody(body, mats) {
    // Long hood, short deck American muscle car — wide drag-style rear
    box(body, mats.paint, 1.94, 0.4, 4.2, 0, 0.44, -0.05);
    box(body, mats.carbon, 2.0, 0.1, 2.2, 0, 0.22, 0.1);
    box(body, mats.paint, 1.6, 0.1, 2.0, 0, 0.8, 1.15);
    box(body, mats.paintDark, 0.5, 0.08, 1.3, 0, 0.88, 1.3);
    box(body, mats.carbon, 0.34, 0.08, 0.5, 0, 0.94, 1.7);
    box(body, mats.chrome, 1.86, 0.2, 0.3, 0, 0.36, 2.35);
    box(body, mats.paintDark, 1.7, 0.1, 0.06, 0, 0.5, 2.5);
    for (const sx of [0.62, 0.35, -0.35, -0.62]) {
        cyl(body, mats.lightWhite, 0.12, 0.12, 0.06, sx, 0.5, 2.42, Math.PI / 2, 0, 0, 14);
    }
    box(body, mats.darkGlass, 1.3, 0.36, 0.06, 0, 0.98, 0.15, -0.5, 0, 0);
    box(body, mats.paint, 1.36, 0.06, 1.05, 0, 1.14, -0.65);
    box(body, mats.darkGlass, 1.2, 0.32, 0.06, 0, 0.98, -1.2, 0.5, 0, 0);
    box(body, mats.darkGlass, 0.06, 0.3, 0.9, 0.7, 0.96, 0.15, 0, 0, 0.1);
    box(body, mats.darkGlass, 0.06, 0.3, 0.9, -0.7, 0.96, 0.15, 0, 0, -0.1);
    box(body, mats.paint, 0.32, 0.34, 1.0, 0.98, 0.52, 1.3, 0, 0, -0.15);
    box(body, mats.paint, 0.32, 0.34, 1.0, -0.98, 0.52, 1.3, 0, 0, 0.15);
    box(body, mats.paint, 0.42, 0.4, 1.15, 1.05, 0.56, -1.25, 0, 0, 0.12);
    box(body, mats.paint, 0.42, 0.4, 1.15, -1.05, 0.56, -1.25, 0, 0, -0.12);
    box(body, mats.paint, 1.7, 0.12, 0.55, 0, 0.66, -1.75);
    box(body, mats.chrome, 1.9, 0.26, 0.3, 0, 0.4, -2.15);
    const brakeMat = mats.lightRed.clone();
    box(body, brakeMat, 1.7, 0.14, 0.05, 0, 0.6, -2.28);
    for (const sx of [0.5, 0.2, -0.2, -0.5]) {
        cyl(body, mats.chrome, 0.06, 0.06, 0.2, sx, 0.18, -2.25, Math.PI / 2, 0, 0, 10);
    }
    box(body, mats.paint, 0.18, 0.08, 0.12, 0.84, 0.9, 0.5);
    box(body, mats.paint, 0.18, 0.08, 0.12, -0.84, 0.9, 0.5);
    return {
        brakeMat,
        wheelSpecs: [
            { x: 0.88, z: 1.35, r: 0.34, w: 0.28 },
            { x: -0.88, z: 1.35, r: 0.34, w: 0.28 },
            { x: 0.94, z: -1.25, r: 0.38, w: 0.44 },
            { x: -0.94, z: -1.25, r: 0.38, w: 0.44 },
        ],
        flameSpecs: [
            { x: 0.5, y: 0.18, z: -2.3 },
            { x: -0.5, y: 0.18, z: -2.3 },
        ],
        shadowRx: 1.45,
        shadowRz: 1.75,
    };
}
function buildRallyBody(body, mats) {
    // Raised hatchback — light bar, mud flaps, rear spare wheel
    const lift = 0.06;
    box(body, mats.paint, 1.76, 0.4, 3.5, 0, 0.46 + lift, 0);
    box(body, mats.carbon, 1.9, 0.12, 3.3, 0, 0.24 + lift, 0);
    box(body, mats.paint, 1.5, 0.1, 1.0, 0, 0.82 + lift, 1.15);
    box(body, mats.carbon, 0.9, 0.05, 0.3, 0, 0.9 + lift, 1.55);
    box(body, mats.paint, 1.7, 0.24, 0.4, 0, 0.4 + lift, 1.95);
    box(body, mats.carbon, 1.5, 0.1, 0.45, 0, 0.24 + lift, 2.02);
    for (const sx of [0.5, -0.5]) {
        cyl(body, mats.lightWhite, 0.09, 0.09, 0.1, sx, 0.62 + lift, 2.15, Math.PI / 2, 0, 0, 12);
    }
    box(body, mats.darkGlass, 1.3, 0.44, 0.06, 0, 1.02 + lift, 0.7, -0.48, 0, 0);
    box(body, mats.paint, 1.34, 0.06, 1.5, 0, 1.24 + lift, -0.35);
    box(body, mats.darkGlass, 1.3, 0.5, 0.06, 0, 1.0 + lift, -1.1, 0.35, 0, 0);
    box(body, mats.darkGlass, 0.06, 0.36, 1.15, 0.68, 1.02 + lift, 0.05, 0, 0, 0.12);
    box(body, mats.darkGlass, 0.06, 0.36, 1.15, -0.68, 1.02 + lift, 0.05, 0, 0, -0.12);
    box(body, mats.lightWhite, 0.5, 0.06, 0.1, 0, 1.3 + lift, 0.4);
    box(body, mats.carbon, 0.5, 0.03, 0.12, 0, 1.26 + lift, 0.4);
    box(body, mats.carbon, 0.05, 0.04, 1.4, 0.55, 1.28 + lift, -0.35);
    box(body, mats.carbon, 0.05, 0.04, 1.4, -0.55, 1.28 + lift, -0.35);
    box(body, mats.paintDark, 0.32, 0.3, 0.95, 0.92, 0.5 + lift, 1.2, 0, 0, -0.15);
    box(body, mats.paintDark, 0.32, 0.3, 0.95, -0.92, 0.5 + lift, 1.2, 0, 0, 0.15);
    box(body, mats.paintDark, 0.34, 0.32, 1.0, 0.94, 0.52 + lift, -1.05, 0, 0, 0.12);
    box(body, mats.paintDark, 0.34, 0.32, 1.0, -0.94, 0.52 + lift, -1.05, 0, 0, -0.12);
    box(body, mats.rubber, 0.24, 0.22, 0.05, 0.9, 0.22 + lift, 0.75);
    box(body, mats.rubber, 0.24, 0.22, 0.05, -0.9, 0.22 + lift, 0.75);
    box(body, mats.rubber, 0.26, 0.24, 0.05, 0.94, 0.24 + lift, -1.45);
    box(body, mats.rubber, 0.26, 0.24, 0.05, -0.94, 0.24 + lift, -1.45);
    box(body, mats.paint, 1.6, 0.5, 0.15, 0, 0.86 + lift, -1.78);
    cyl(body, mats.rubber, 0.28, 0.28, 0.12, 0, 0.7 + lift, -1.85, Math.PI / 2, 0, 0, 20);
    cyl(body, mats.rim, 0.14, 0.14, 0.14, 0, 0.7 + lift, -1.85, Math.PI / 2, 0, 0, 14);
    const brakeMat = mats.lightRed.clone();
    box(body, brakeMat, 0.3, 0.34, 0.05, 0.68, 0.78 + lift, -1.72);
    box(body, brakeMat, 0.3, 0.34, 0.05, -0.68, 0.78 + lift, -1.72);
    box(body, mats.paint, 0.16, 0.08, 0.12, 0.76, 0.98 + lift, 0.55);
    box(body, mats.paint, 0.16, 0.08, 0.12, -0.76, 0.98 + lift, 0.55);
    return {
        brakeMat,
        wheelSpecs: [
            { x: 0.84, z: 1.18, r: 0.37, w: 0.3 },
            { x: -0.84, z: 1.18, r: 0.37, w: 0.3 },
            { x: 0.86, z: -1.2, r: 0.37, w: 0.3 },
            { x: -0.86, z: -1.2, r: 0.37, w: 0.3 },
        ],
        flameSpecs: [
            { x: 0.14, y: 0.2 + lift, z: -1.9 },
            { x: -0.14, y: 0.2 + lift, z: -1.9 },
        ],
        shadowRx: 1.25,
        shadowRz: 1.5,
    };
}
function buildGTNightBody(body, mats) {
    // Widebody GT coupe — glow splitter, canards, big rear wing
    box(body, mats.paint, 1.98, 0.36, 4.1, 0, 0.4, 0.02);
    box(body, mats.carbon, 2.06, 0.14, 2.6, 0, 0.2, -0.1);
    box(body, mats.paint, 1.9, 0.2, 0.5, 0, 0.32, 2.05);
    box(body, mats.carbon, 1.95, 0.06, 0.7, 0, 0.18, 2.15);
    box(body, mats.glow, 1.6, 0.03, 0.05, 0, 0.24, 2.48);
    box(body, mats.carbon, 0.22, 0.04, 0.18, 0.85, 0.3, 2.15, 0, 0.3, 0);
    box(body, mats.carbon, 0.22, 0.04, 0.18, -0.85, 0.3, 2.15, 0, -0.3, 0);
    box(body, mats.paint, 1.5, 0.1, 1.1, 0, 0.76, 1.2);
    box(body, mats.carbon, 0.5, 0.04, 0.6, 0, 0.82, 1.25);
    box(body, mats.darkGlass, 1.24, 0.38, 0.06, 0, 0.94, 0.7, -0.5, 0, 0);
    box(body, mats.paint, 1.3, 0.06, 1.15, 0, 1.1, -0.05);
    box(body, mats.darkGlass, 1.15, 0.32, 0.06, 0, 0.96, -0.68, 0.42, 0, 0);
    box(body, mats.darkGlass, 0.06, 0.3, 1.1, 0.66, 0.94, 0.05, 0, 0, 0.12);
    box(body, mats.darkGlass, 0.06, 0.3, 1.1, -0.66, 0.94, 0.05, 0, 0, -0.12);
    box(body, mats.paint, 0.36, 0.32, 1.05, 1.0, 0.5, 1.25, 0, 0, -0.16);
    box(body, mats.paint, 0.36, 0.32, 1.05, -1.0, 0.5, 1.25, 0, 0, 0.16);
    box(body, mats.paint, 0.42, 0.4, 1.2, 1.05, 0.54, -1.2, 0, 0, 0.14);
    box(body, mats.paint, 0.42, 0.4, 1.2, -1.05, 0.54, -1.2, 0, 0, -0.14);
    box(body, mats.carbon, 0.2, 0.28, 0.6, 1.02, 0.48, -0.15);
    box(body, mats.carbon, 0.2, 0.28, 0.6, -1.02, 0.48, -0.15);
    box(body, mats.paint, 1.7, 0.16, 0.5, 0, 0.5, -1.9);
    box(body, mats.carbon, 1.9, 0.16, 0.4, 0, 0.24, -2.15);
    for (let i = -3; i <= 3; i++)
        box(body, mats.carbon, 0.04, 0.14, 0.3, i * 0.2, 0.16, -2.25);
    box(body, mats.carbon, 1.8, 0.06, 0.36, 0, 1.2, -2.05);
    box(body, mats.carbon, 0.07, 0.34, 0.2, 0.75, 1.0, -1.95);
    box(body, mats.carbon, 0.07, 0.34, 0.2, -0.75, 1.0, -1.95);
    box(body, mats.lightWhite, 0.5, 0.06, 0.05, 0.62, 0.56, 2.25);
    box(body, mats.lightWhite, 0.5, 0.06, 0.05, -0.62, 0.56, 2.25);
    const brakeMat = mats.lightRed.clone();
    box(body, brakeMat, 1.5, 0.08, 0.04, 0, 0.62, -2.32);
    for (const sx of [0.35, 0.15, -0.15, -0.35])
        cyl(body, mats.chrome, 0.06, 0.06, 0.2, sx, 0.2, -2.28, Math.PI / 2, 0, 0, 10);
    box(body, mats.paint, 0.18, 0.08, 0.12, 0.82, 0.9, 0.55);
    box(body, mats.paint, 0.18, 0.08, 0.12, -0.82, 0.9, 0.55);
    return {
        brakeMat,
        wheelSpecs: [
            { x: 0.94, z: 1.3, r: 0.34, w: 0.32 },
            { x: -0.94, z: 1.3, r: 0.34, w: 0.32 },
            { x: 1.0, z: -1.35, r: 0.36, w: 0.38 },
            { x: -1.0, z: -1.35, r: 0.36, w: 0.38 },
        ],
        flameSpecs: [
            { x: 0.3, y: 0.2, z: -2.35 },
            { x: -0.3, y: 0.2, z: -2.35 },
        ],
        shadowRx: 1.45,
        shadowRz: 1.75,
    };
}
function buildHyperBody(body, mats) {
    // Extreme low, wide hypercar — teardrop cabin, active wing
    const low = -0.06;
    box(body, mats.paint, 1.96, 0.3, 4.3, 0, 0.36 + low, 0);
    box(body, mats.carbon, 2.0, 0.1, 3.0, 0, 0.18 + low, -0.1);
    box(body, mats.paint, 1.86, 0.14, 0.5, 0, 0.26 + low, 2.15);
    box(body, mats.carbon, 2.0, 0.04, 0.6, 0, 0.14 + low, 2.3);
    box(body, mats.carbon, 0.24, 0.03, 0.2, 0.9, 0.22 + low, 2.2, 0, 0.35, 0);
    box(body, mats.carbon, 0.24, 0.03, 0.2, -0.9, 0.22 + low, 2.2, 0, -0.35, 0);
    box(body, mats.paint, 1.2, 0.06, 1.5, 0, 0.62 + low, 1.2);
    box(body, mats.paintDark, 0.35, 0.03, 1.2, 0, 0.66 + low, 1.25);
    box(body, mats.darkGlass, 1.1, 0.3, 0.06, 0, 0.78 + low, 0.65, -0.55, 0, 0);
    box(body, mats.paint, 1.0, 0.05, 1.0, 0, 0.92 + low, -0.05);
    box(body, mats.darkGlass, 1.0, 0.26, 0.06, 0, 0.78 + low, -0.65, 0.5, 0, 0);
    box(body, mats.darkGlass, 0.06, 0.26, 0.85, 0.6, 0.76 + low, 0.05, 0, 0, 0.16);
    box(body, mats.darkGlass, 0.06, 0.26, 0.85, -0.6, 0.76 + low, 0.05, 0, 0, -0.16);
    box(body, mats.paint, 0.4, 0.34, 1.1, 1.02, 0.5 + low, -1.1, 0, 0, 0.15);
    box(body, mats.paint, 0.4, 0.34, 1.1, -1.02, 0.5 + low, -1.1, 0, 0, -0.15);
    box(body, mats.paint, 0.3, 0.3, 1.0, 0.94, 0.48 + low, 1.25, 0, 0, -0.14);
    box(body, mats.paint, 0.3, 0.3, 1.0, -0.94, 0.48 + low, 1.25, 0, 0, 0.14);
    box(body, mats.carbon, 0.24, 0.3, 0.7, 1.04, 0.5 + low, -0.2);
    box(body, mats.carbon, 0.24, 0.3, 0.7, -1.04, 0.5 + low, -0.2);
    box(body, mats.paintDark, 1.5, 0.14, 0.6, 0, 0.5 + low, -1.85);
    box(body, mats.carbon, 1.96, 0.18, 0.4, 0, 0.2 + low, -2.2);
    for (let i = -4; i <= 4; i++)
        box(body, mats.carbon, 0.035, 0.18, 0.34, i * 0.18, 0.16 + low, -2.32);
    box(body, mats.carbon, 1.7, 0.05, 0.4, 0, 1.02 + low, -2.05);
    box(body, mats.carbon, 0.06, 0.28, 0.2, 0.7, 0.86 + low, -1.95);
    box(body, mats.carbon, 0.06, 0.28, 0.2, -0.7, 0.86 + low, -1.95);
    box(body, mats.lightWhite, 0.55, 0.04, 0.04, 0.6, 0.44 + low, 2.32);
    box(body, mats.lightWhite, 0.55, 0.04, 0.04, -0.6, 0.44 + low, 2.32);
    const brakeMat = mats.lightRed.clone();
    box(body, brakeMat, 1.7, 0.06, 0.04, 0, 0.56 + low, -2.38);
    for (const sx of [0.18, 0.06, -0.06, -0.18])
        cyl(body, mats.chrome, 0.055, 0.055, 0.2, sx, 0.16 + low, -2.35, Math.PI / 2, 0, 0, 10);
    box(body, mats.carbon, 0.16, 0.06, 0.1, 0.78, 0.72 + low, 0.5);
    box(body, mats.carbon, 0.16, 0.06, 0.1, -0.78, 0.72 + low, 0.5);
    return {
        brakeMat,
        wheelSpecs: [
            { x: 0.92, z: 1.35, r: 0.32, w: 0.3 },
            { x: -0.92, z: 1.35, r: 0.32, w: 0.3 },
            { x: 0.98, z: -1.4, r: 0.34, w: 0.4 },
            { x: -0.98, z: -1.4, r: 0.34, w: 0.4 },
        ],
        flameSpecs: [
            { x: 0.15, y: 0.16 + low, z: -2.45 },
            { x: -0.15, y: 0.16 + low, z: -2.45 },
        ],
        shadowRx: 1.5,
        shadowRz: 1.85,
    };
}
function buildPrototypeBody(body, mats) {
    // Le Mans-style closed prototype — full envelope fenders, tall rear wing
    box(body, mats.paint, 1.9, 0.3, 4.6, 0, 0.38, -0.1);
    box(body, mats.carbon, 2.0, 0.12, 3.4, 0, 0.2, -0.15);
    box(body, mats.carbon, 1.95, 0.1, 0.6, 0, 0.24, 2.3);
    box(body, mats.paint, 1.7, 0.16, 0.5, 0, 0.36, 2.15);
    box(body, mats.carbon, 0.3, 0.04, 0.24, 0.86, 0.3, 2.25, 0, 0.4, 0);
    box(body, mats.carbon, 0.3, 0.04, 0.24, -0.86, 0.3, 2.25, 0, -0.4, 0);
    box(body, mats.paint, 1.6, 0.14, 1.6, 0, 0.5, 1.4);
    box(body, mats.darkGlass, 1.0, 0.32, 0.06, 0, 0.82, 0.55, -0.55, 0, 0);
    box(body, mats.paint, 0.95, 0.05, 1.1, 0, 0.98, -0.15);
    box(body, mats.carbon, 0.18, 0.08, 0.3, 0, 1.06, -0.1);
    box(body, mats.darkGlass, 0.9, 0.28, 0.06, 0, 0.82, -0.75, 0.5, 0, 0);
    box(body, mats.darkGlass, 0.06, 0.26, 0.75, 0.56, 0.8, 0.1, 0, 0, 0.18);
    box(body, mats.darkGlass, 0.06, 0.26, 0.75, -0.56, 0.8, 0.1, 0, 0, -0.18);
    box(body, mats.paint, 0.42, 0.36, 1.1, 1.0, 0.52, 1.35, 0, 0, -0.15);
    box(body, mats.paint, 0.42, 0.36, 1.1, -1.0, 0.52, 1.35, 0, 0, 0.15);
    box(body, mats.paint, 0.46, 0.4, 1.3, 1.05, 0.54, -1.3, 0, 0, 0.14);
    box(body, mats.paint, 0.46, 0.4, 1.3, -1.05, 0.54, -1.3, 0, 0, -0.14);
    box(body, mats.paintDark, 1.3, 0.24, 1.4, 0, 0.42, -2.1);
    box(body, mats.carbon, 1.95, 0.16, 0.4, 0, 0.2, -2.55);
    for (let i = -4; i <= 4; i++)
        box(body, mats.carbon, 0.035, 0.16, 0.34, i * 0.18, 0.16, -2.65);
    box(body, mats.carbon, 1.9, 0.06, 0.42, 0, 1.3, -2.35);
    box(body, mats.carbon, 0.08, 0.5, 0.22, 0.75, 1.0, -2.2);
    box(body, mats.carbon, 0.08, 0.5, 0.22, -0.75, 1.0, -2.2);
    box(body, mats.lightWhite, 0.45, 0.05, 0.05, 0.58, 0.5, 2.5);
    box(body, mats.lightWhite, 0.45, 0.05, 0.05, -0.58, 0.5, 2.5);
    const brakeMat = mats.lightRed.clone();
    box(body, brakeMat, 1.75, 0.08, 0.04, 0, 0.46, -2.72);
    for (const sx of [0.22, 0.08, -0.08, -0.22])
        cyl(body, mats.chrome, 0.06, 0.06, 0.22, sx, 0.18, -2.68, Math.PI / 2, 0, 0, 10);
    return {
        brakeMat,
        wheelSpecs: [
            { x: 0.9, z: 1.4, r: 0.33, w: 0.3 },
            { x: -0.9, z: 1.4, r: 0.33, w: 0.3 },
            { x: 0.96, z: -1.55, r: 0.35, w: 0.36 },
            { x: -0.96, z: -1.55, r: 0.35, w: 0.36 },
        ],
        flameSpecs: [
            { x: 0.18, y: 0.2, z: -2.75 },
            { x: -0.18, y: 0.2, z: -2.75 },
        ],
        shadowRx: 1.5,
        shadowRz: 1.95,
    };
}
function buildTruckBody(body, mats) {
    // Tow-utility pickup — tall cab, flatbed, winch rig, chunky wheels
    const lift = 0.1;
    box(body, mats.paint, 1.86, 0.5, 1.6, 0, 0.62 + lift, 1.35);
    box(body, mats.carbon, 1.9, 0.14, 1.7, 0, 0.32 + lift, 1.3);
    box(body, mats.darkGlass, 1.5, 0.34, 0.06, 0, 0.98 + lift, 1.95, -0.3, 0, 0);
    box(body, mats.paint, 1.6, 0.06, 1.5, 0, 1.16 + lift, 1.3);
    box(body, mats.darkGlass, 1.4, 0.3, 0.06, 0, 0.98 + lift, 0.75, 0.2, 0, 0);
    box(body, mats.darkGlass, 0.06, 0.28, 0.9, 0.76, 0.98 + lift, 1.35, 0, 0, 0.1);
    box(body, mats.darkGlass, 0.06, 0.28, 0.9, -0.76, 0.98 + lift, 1.35, 0, 0, -0.1);
    box(body, mats.chrome, 1.7, 0.28, 0.1, 0, 0.6 + lift, 2.15);
    for (const sx of [0.62, -0.62]) {
        cyl(body, mats.lightWhite, 0.15, 0.15, 0.08, sx, 0.62 + lift, 2.22, Math.PI / 2, 0, 0, 14);
        cyl(body, mats.chrome, 0.18, 0.18, 0.03, sx, 0.62 + lift, 2.18, Math.PI / 2, 0, 0, 14);
    }
    box(body, mats.chrome, 1.9, 0.2, 0.35, 0, 0.3 + lift, 2.25);
    box(body, mats.rim, 1.5, 0.08, 0.08, 0, 0.5 + lift, 2.4);
    box(body, mats.carbon, 0.3, 0.2, 0.3, 0, 0.36 + lift, 2.42);
    box(body, mats.carbon, 1.7, 0.16, 1.4, 0, 0.3 + lift, -0.2);
    box(body, mats.paintDark, 1.8, 0.08, 2.1, 0, 0.56 + lift, -1.35);
    box(body, mats.paint, 0.08, 0.3, 2.1, 0.88, 0.72 + lift, -1.35);
    box(body, mats.paint, 0.08, 0.3, 2.1, -0.88, 0.72 + lift, -1.35);
    box(body, mats.paint, 1.8, 0.3, 0.08, 0, 0.72 + lift, -2.38);
    box(body, mats.paint, 1.86, 0.35, 0.1, 0, 0.76 + lift, 0.35);
    box(body, mats.rim, 0.14, 0.14, 1.0, 0.55, 1.0 + lift, -1.9, 0.5, 0, 0);
    cyl(body, mats.chrome, 0.05, 0.05, 0.3, 0.55, 1.35 + lift, -2.25, 0, 0, 0, 10);
    box(body, mats.carbon, 0.5, 0.35, 0.5, 0.55, 0.75 + lift, -1.6);
    cyl(body, mats.rubber, 0.3, 0.3, 0.14, -0.5, 0.72 + lift, -1.9, Math.PI / 2, 0, 0, 20);
    cyl(body, mats.rim, 0.15, 0.15, 0.16, -0.5, 0.72 + lift, -1.9, Math.PI / 2, 0, 0, 14);
    box(body, mats.carbon, 1.98, 0.06, 1.6, 0, 0.24 + lift, 0.6);
    box(body, mats.lightWhite, 0.5, 0.06, 0.1, 0, 1.32 + lift, 1.6);
    box(body, mats.carbon, 0.5, 0.03, 0.12, 0, 1.28 + lift, 1.6);
    box(body, mats.paint, 0.1, 0.24, 0.16, 0.94, 1.0 + lift, 1.75);
    box(body, mats.paint, 0.1, 0.24, 0.16, -0.94, 1.0 + lift, 1.75);
    const brakeMat = mats.lightRed.clone();
    box(body, brakeMat, 0.3, 0.24, 0.05, 0.75, 0.66 + lift, -2.4);
    box(body, brakeMat, 0.3, 0.24, 0.05, -0.75, 0.66 + lift, -2.4);
    cyl(body, mats.chrome, 0.06, 0.06, 0.5, 0.75, 1.0 + lift, 0.3, 0, 0, 0, 10);
    return {
        brakeMat,
        wheelSpecs: [
            { x: 0.88, z: 1.45, r: 0.42, w: 0.34 },
            { x: -0.88, z: 1.45, r: 0.42, w: 0.34 },
            { x: 0.9, z: -1.5, r: 0.42, w: 0.38 },
            { x: -0.9, z: -1.5, r: 0.42, w: 0.38 },
        ],
        flameSpecs: [
            { x: 0.2, y: 0.2 + lift, z: -2.5 },
            { x: -0.2, y: 0.2 + lift, z: -2.5 },
        ],
        shadowRx: 1.5,
        shadowRz: 2.0,
    };
}
const BODY_BUILDERS = {
    spyder: buildSpyderBody,
    coupe: buildCoupeBody,
    "sedan-gt": buildSedanGTBody,
    muscle: buildMuscleBody,
    rally: buildRallyBody,
    gt: buildGTNightBody,
    hyper: buildHyperBody,
    prototype: buildPrototypeBody,
    truck: buildTruckBody,
};
export function buildCarVisual(carId) {
    const def = carById(carId);
    const mats = makeMats(def.color, def.accent);
    const root = new THREE.Group();
    root.name = `car-${carId}`;
    const body = new THREE.Group();
    root.add(body);
    const builder = BODY_BUILDERS[def.body] || buildSpyderBody;
    const { brakeMat, wheelSpecs, flameSpecs, shadowRx, shadowRz } = builder(body, mats);
    // Nitro flames (hidden until boost)
    const flames = [];
    for (const f of flameSpecs) {
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.55, 8), mats.glow);
        flame.position.set(f.x, f.y, f.z);
        flame.rotation.x = Math.PI / 2;
        flame.visible = false;
        body.add(flame);
        flames.push(flame);
    }
    // Wheels — local +X is right. specs[0..1] = front axle, specs[2..3] = rear axle.
    const wheels = [];
    for (const s of wheelSpecs) {
        const w = makeWheel(mats, s.r, s.w);
        w.position.set(s.x, s.r, s.z);
        root.add(w);
        wheels.push(w);
    }
    // Blob shadow
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(shadowRx, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    shadow.scale.set(1, shadowRz, 1);
    root.add(shadow);
    return { root, wheels, brakeLights: brakeMat, flames };
}
export function poseCar(vis, x, y, yaw, steer, speed, dt, braking, boosting, drifting = false) {
    vis.root.position.set(x, 0, -y);
    vis.root.lookAt(x - Math.sin(yaw), 0, -y - Math.cos(yaw));
    const bank = steer * (drifting ? 0.18 : 0.1);
    vis.root.rotateZ(-bank);
    vis.root.rotateX(Math.min(0.04, Math.abs(speed) * 0.0007));
    const spin = (speed * dt) / 0.34;
    vis.wheels[0].rotation.x += spin;
    vis.wheels[1].rotation.x += spin;
    vis.wheels[2].rotation.x += spin;
    vis.wheels[3].rotation.x += spin;
    vis.wheels[0].rotation.y = steer * (drifting ? 0.48 : 0.38);
    vis.wheels[1].rotation.y = steer * (drifting ? 0.48 : 0.38);
    vis.brakeLights.emissiveIntensity = braking || speed < -1 ? 3.4 : 1.4;
    for (const f of vis.flames) {
        f.visible = boosting;
        if (boosting)
            f.scale.y = 0.7 + Math.random() * 0.8;
    }
}
export function disposeCar(vis) {
    vis.root.traverse((o) => {
        const m = o;
        if (m.geometry)
            m.geometry.dispose();
    });
}
