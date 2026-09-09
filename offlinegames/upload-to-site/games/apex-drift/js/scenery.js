import * as THREE from "three";
import { closestOnTrack, mulberry } from "./types.js";
function canvasTex(draw, size = 256) {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    draw(ctx, size);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
}
export function groundTex(theme) {
    return canvasTex((ctx, s) => {
        ctx.fillStyle = theme.grass;
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = theme.grass2;
        const n = theme.id === "city" || theme.id === "industrial" ? 40 : 160;
        for (let i = 0; i < n; i++) {
            ctx.globalAlpha = 0.2 + Math.random() * 0.35;
            ctx.beginPath();
            ctx.arc(Math.random() * s, Math.random() * s, 3 + Math.random() * 16, 0, Math.PI * 2);
            ctx.fill();
        }
        if (theme.id === "beach" || theme.id === "desert") {
            const img = ctx.getImageData(0, 0, s, s);
            const d = img.data;
            for (let i = 0; i < d.length; i += 4) {
                const k = (Math.random() - 0.5) * 22;
                d[i] = Math.max(0, Math.min(255, d[i] + k));
                d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + k * 0.9));
                d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + k * 0.6));
            }
            ctx.putImageData(img, 0, 0);
        }
        ctx.globalAlpha = 1;
    }, 256);
}
function windowTex() {
    return canvasTex((ctx, s) => {
        ctx.fillStyle = "#161820";
        ctx.fillRect(0, 0, s, s);
        for (let y = 6; y < s; y += 10) {
            for (let x = 5; x < s; x += 8) {
                if (Math.random() > 0.38) {
                    ctx.fillStyle = Math.random() > 0.22 ? "#e8c878" : "#88c8ff";
                    ctx.globalAlpha = 0.55 + Math.random() * 0.45;
                    ctx.fillRect(x, y, 4, 6);
                }
            }
        }
        ctx.globalAlpha = 1;
    }, 64);
}
function alongTrack(map, count, minDist, maxDist, seed, fn) {
    const rand = mulberry(seed);
    const pts = map.points;
    const n = pts.length;
    for (let i = 0; i < count; i++) {
        const idx = Math.floor(((i + rand()) / count) * n) % n;
        const a = pts[idx];
        const b = pts[(idx + 1) % n];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const side = i % 2 === 0 ? 1 : -1;
        const dist = minDist + rand() * (maxDist - minDist);
        fn(a.x + nx * side * dist, a.y + ny * side * dist, Math.atan2(dy, dx), i, rand);
    }
}
function addWater(group, theme, ox, oz, r = 320) {
    const color = new THREE.Color(theme.water ?? "#1a6a88");
    const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.12,
        metalness: 0.42,
        transparent: true,
        opacity: 0.92,
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(ox, -0.35, oz);
    group.add(mesh);
    const foam = new THREE.Mesh(new THREE.RingGeometry(r * 0.92, r, 48), new THREE.MeshStandardMaterial({ color: 0xe8f4f8, transparent: true, opacity: 0.35, roughness: 1 }));
    foam.rotation.x = -Math.PI / 2;
    foam.position.set(ox, -0.28, oz);
    group.add(foam);
    return mesh;
}
function palm() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 6.2, 6), new THREE.MeshStandardMaterial({ color: 0x8a6238, roughness: 0.85 }));
    trunk.position.y = 3.1;
    trunk.rotation.z = 0.08;
    g.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a7a3a, roughness: 0.7, flatShading: true });
    for (let i = 0; i < 7; i++) {
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 2.4), leafMat);
        leaf.position.set(0, 6.1, 0.7);
        const wrap = new THREE.Group();
        wrap.position.y = 6.05;
        wrap.rotation.y = (i / 7) * Math.PI * 2;
        wrap.rotation.x = 0.45;
        wrap.add(leaf);
        g.add(wrap);
    }
    return g;
}
function pine() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.9 }));
    trunk.position.y = 1.1;
    g.add(trunk);
    const green = new THREE.MeshStandardMaterial({ color: 0x2a5a32, roughness: 0.85, flatShading: true });
    for (let i = 0; i < 3; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.6 - i * 0.35, 2.4, 7), green);
        cone.position.y = 2.4 + i * 1.35;
        g.add(cone);
    }
    return g;
}
function cactus() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a7a42, roughness: 0.7, flatShading: true });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 2.6, 8), mat);
    stem.position.y = 1.3;
    g.add(stem);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.1, 6), mat);
    arm.position.set(0.45, 1.6, 0);
    arm.rotation.z = Math.PI / 2;
    g.add(arm);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6), mat);
    up.position.set(0.9, 1.95, 0);
    g.add(up);
    return g;
}
function lamp(neon = false) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.2, 6), new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.5, roughness: 0.4 }));
    pole.position.y = 2.6;
    g.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.22), new THREE.MeshStandardMaterial({
        color: neon ? 0xff4ad2 : 0xf0e0a8,
        emissive: neon ? 0xff4ad2 : 0xf0e0a8,
        emissiveIntensity: neon ? 2.2 : 1.4,
    }));
    head.position.y = 5.2;
    g.add(head);
    return g;
}
function addBuildings(group, map, opts) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0);
    const win = opts.windows ? windowTex() : null;
    const dummy = new THREE.Object3D();
    const per = Math.ceil(opts.count / opts.colors.length);
    opts.colors.forEach((col, ci) => {
        const mat = new THREE.MeshStandardMaterial({
            color: col,
            roughness: 0.62,
            metalness: 0.12,
            map: win ?? undefined,
            emissive: opts.neon ? new THREE.Color(col).multiplyScalar(0.15) : undefined,
            emissiveIntensity: opts.neon ? 0.6 : 0,
        });
        const mesh = new THREE.InstancedMesh(geo, mat, per);
        let n = 0;
        alongTrack(map, per, opts.minDist, opts.minDist + 38, opts.seed + ci * 17, (x, y, yaw, i, rand) => {
            if (n >= per)
                return;
            const hit = closestOnTrack({ x, y }, map.points);
            if (hit.dist < map.width * 0.5 + 6)
                return;
            const h = opts.minH + rand() * (opts.maxH - opts.minH);
            const w = 6 + rand() * 10;
            const d = 6 + rand() * 8;
            dummy.position.set(x, 0, -y);
            dummy.rotation.set(0, yaw + (rand() - 0.5) * 0.4, 0);
            dummy.scale.set(w, h, d);
            dummy.updateMatrix();
            mesh.setMatrixAt(n, dummy.matrix);
            n++;
        });
        mesh.count = n;
        group.add(mesh);
    });
}
function addPalms(group, map, count, seed, minD, maxD) {
    alongTrack(map, count, minD, maxD, seed, (x, y, yaw, i) => {
        const t = palm();
        t.position.set(x, 0, -y);
        t.rotation.y = yaw + i;
        t.scale.setScalar(0.85 + (i % 5) * 0.12);
        group.add(t);
    });
}
function addPines(group, map, count, seed, minD, maxD) {
    alongTrack(map, count, minD, maxD, seed, (x, y, _yaw, i, rand) => {
        const t = pine();
        t.position.set(x, 0, -y);
        t.rotation.y = rand() * 6;
        t.scale.setScalar(0.8 + (i % 4) * 0.22);
        group.add(t);
    });
}
function addLamps(group, map, neon, seed) {
    alongTrack(map, 22, map.width * 0.5 + 2.2, map.width * 0.5 + 3.4, seed, (x, y, yaw) => {
        const l = lamp(neon);
        l.position.set(x, 0, -y);
        l.rotation.y = yaw;
        group.add(l);
    });
}
function addMountains(group, color, n, radius, h0) {
    for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(new THREE.ConeGeometry(22 + (i % 14), h0 + (i % 18), 5), new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }));
        const ang = (i / n) * Math.PI * 2;
        m.position.set(Math.cos(ang) * radius, h0 * 0.35, Math.sin(ang) * radius);
        m.scale.set(1.3 + (i % 3) * 0.4, 1 + (i % 2) * 0.45, 1.3);
        group.add(m);
    }
}
function warehouse() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 9), new THREE.MeshStandardMaterial({ color: 0x8a8c90, roughness: 0.7, metalness: 0.2 }));
    body.position.y = 3;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.4, 10), new THREE.MeshStandardMaterial({ color: 0x4a3a32, roughness: 0.6 }));
    roof.position.y = 6.2;
    g.add(roof);
    return g;
}
function mesa(color, w, h, d) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true }));
    m.position.y = h * 0.45;
    return m;
}
export function addThemeScenery(group, map, theme) {
    const id = theme.id;
    addLamps(group, map, id === "night", map.seed + 3);
    if (id === "beach") {
        addWater(group, theme, 240, -40, 340);
        addPalms(group, map, 28, map.seed, map.width * 0.5 + 8, 36);
        addMountains(group, 0xc4ae72, 6, 260, 18);
    }
    else if (id === "coast") {
        addWater(group, theme, 220, 80, 300);
        addPalms(group, map, 18, map.seed, map.width * 0.5 + 10, 32);
        addPines(group, map, 10, map.seed + 4, 28, 50);
        addMountains(group, 0x3a5a48, 7, 250, 22);
    }
    else if (id === "sunset") {
        addWater(group, theme, 260, -20, 320);
        addPalms(group, map, 16, map.seed, 16, 40);
        addBuildings(group, map, {
            count: 12,
            minH: 8,
            maxH: 22,
            colors: [0xc8c4bc, 0xa8a49c, 0x8a8680],
            seed: map.seed,
            minDist: 28,
        });
        addMountains(group, 0x6a4a32, 6, 270, 16);
    }
    else if (id === "city") {
        addBuildings(group, map, {
            count: 48,
            minH: 10,
            maxH: 42,
            colors: [0xb8bcc4, 0x9aa0a8, 0xd0c8bc, 0x6a7080],
            seed: map.seed,
            minDist: 14,
            windows: true,
        });
        addMountains(group, 0x4a4e52, 5, 280, 28);
    }
    else if (id === "night") {
        addBuildings(group, map, {
            count: 52,
            minH: 12,
            maxH: 48,
            colors: [0x1a2438, 0x243044, 0x121820, 0x2a1a38],
            seed: map.seed,
            minDist: 12,
            windows: true,
            neon: true,
        });
        const starsGeo = new THREE.BufferGeometry();
        const starPos = new Float32Array(240 * 3);
        for (let i = 0; i < 240; i++) {
            const a = Math.random() * Math.PI * 2;
            const h = 0.15 + Math.random() * 0.7;
            starPos[i * 3] = Math.cos(a) * 380 * Math.cos(h);
            starPos[i * 3 + 1] = 40 + Math.sin(h) * 220;
            starPos[i * 3 + 2] = Math.sin(a) * 380 * Math.cos(h);
        }
        starsGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
        group.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2 })));
    }
    else if (id === "desert") {
        alongTrack(map, 22, 16, 48, map.seed, (x, y, _yaw, i, rand) => {
            const c = cactus();
            c.position.set(x, 0, -y);
            c.scale.setScalar(0.8 + rand());
            group.add(c);
            if (i % 3 === 0) {
                const dune = new THREE.Mesh(new THREE.SphereGeometry(10 + rand() * 8, 8, 6), new THREE.MeshStandardMaterial({ color: 0xc2a074, roughness: 1 }));
                dune.position.set(x + 8, -4, -y);
                dune.scale.set(1.6, 0.45, 1.2);
                group.add(dune);
            }
        });
        addMountains(group, 0xa8885c, 8, 240, 20);
    }
    else if (id === "alpine") {
        addPines(group, map, 40, map.seed, 12, 42);
        addMountains(group, 0x8aa0b0, 10, 230, 36);
        addWater(group, { ...theme, water: "#4a7a98" }, -40, 210, 90);
    }
    else if (id === "forest") {
        addPines(group, map, 70, map.seed, 10, 48);
        addMountains(group, 0x2a4a32, 8, 240, 24);
    }
    else if (id === "industrial") {
        alongTrack(map, 14, 18, 40, map.seed, (x, y, yaw, i) => {
            const w = warehouse();
            w.position.set(x, 0, -y);
            w.rotation.y = yaw;
            w.scale.setScalar(0.7 + (i % 3) * 0.15);
            group.add(w);
        });
        alongTrack(map, 8, 22, 36, map.seed + 9, (x, y) => {
            const chim = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 16, 8), new THREE.MeshStandardMaterial({ color: 0x6a4a42, roughness: 0.7 }));
            chim.position.set(x, 8, -y);
            group.add(chim);
        });
        addMountains(group, 0x4a4c50, 5, 260, 18);
    }
    else if (id === "snow") {
        addPines(group, map, 36, map.seed, 12, 40);
        addMountains(group, 0xe8eef4, 10, 230, 34);
        addWater(group, { ...theme, water: "#b8d0e0" }, 30, 200, 80);
    }
    else if (id === "canyon") {
        alongTrack(map, 18, 16, 40, map.seed, (x, y, yaw, i, rand) => {
            const m = mesa(0x8a4a2a, 10 + rand() * 12, 8 + rand() * 14, 8 + rand() * 8);
            m.position.set(x, m.position.y, -y);
            m.rotation.y = yaw;
            group.add(m);
        });
        addMountains(group, 0x8a5a3a, 8, 240, 28);
    }
    else if (id === "volcano") {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(48, 52, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.9, flatShading: true }));
        cone.position.set(-40, 20, -220);
        group.add(cone);
        const lava = new THREE.Mesh(new THREE.CircleGeometry(10, 16), new THREE.MeshStandardMaterial({ color: 0xff4a18, emissive: 0xff2a10, emissiveIntensity: 2.4, roughness: 0.4 }));
        lava.rotation.x = -Math.PI / 2;
        lava.position.set(-40, 45, -220);
        group.add(lava);
        alongTrack(map, 16, 14, 36, map.seed, (x, y, _yaw, i, rand) => {
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 + rand() * 1.8, 0), new THREE.MeshStandardMaterial({ color: 0x2a1c18, roughness: 0.9, flatShading: true }));
            rock.position.set(x, 0.8, -y);
            group.add(rock);
        });
        addMountains(group, 0x2a1c18, 7, 250, 22);
    }
}
