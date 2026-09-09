import * as THREE from "three";
import { THEMES } from "./data.js";
import { addThemeScenery, groundTex } from "./scenery.js";
import { yawToForward, yawToRight } from "./types.js";
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
function asphaltTex() {
    return canvasTex((ctx, s) => {
        ctx.fillStyle = "#2c2e34";
        ctx.fillRect(0, 0, s, s);
        const img = ctx.getImageData(0, 0, s, s);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const n = (Math.random() - 0.5) * 28;
            d[i] = Math.max(0, Math.min(255, d[i] + n));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.9));
        }
        ctx.putImageData(img, 0, 0);
    }, 256);
}
function chevronTex() {
    return canvasTex((ctx, s) => {
        ctx.fillStyle = "#0c1010";
        ctx.fillRect(0, 0, s, s);
        const drawChevron = (x, y, lit) => {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 28, y + 22);
            ctx.lineTo(x + 18, y + 22);
            ctx.lineTo(x - 10, y);
            ctx.lineTo(x + 18, y - 22);
            ctx.lineTo(x + 28, y - 22);
            ctx.closePath();
            ctx.fillStyle = lit ? "#7CFF4A" : "#1a3a18";
            ctx.fill();
        };
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 5; col++) {
                drawChevron(18 + col * 48, 32 + row * 64, (col + row) % 2 === 0);
            }
        }
    }, 256);
}
function skyMesh(theme) {
    const geo = new THREE.SphereGeometry(420, 32, 16);
    const sunDir = theme.id === "night"
        ? [0.1, 0.55, 0.4]
        : theme.id === "volcano"
            ? [0.2, 0.05, -0.6]
            : [0.35, 0.12, -0.9];
    const sunCol = theme.id === "night"
        ? [0.7, 0.75, 0.9]
        : theme.id === "volcano"
            ? [1.0, 0.25, 0.08]
            : [1.0, 0.55, 0.2];
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            top: { value: new THREE.Color(theme.sky) },
            mid: { value: new THREE.Color(theme.sky2) },
            bot: { value: new THREE.Color(theme.grass) },
            sunD: { value: new THREE.Vector3(sunDir[0], sunDir[1], sunDir[2]) },
            sunC: { value: new THREE.Vector3(sunCol[0], sunCol[1], sunCol[2]) },
        },
        vertexShader: `
      varying vec3 vN;
      void main() {
        vN = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
        fragmentShader: `
      varying vec3 vN;
      uniform vec3 top;
      uniform vec3 mid;
      uniform vec3 bot;
      uniform vec3 sunD;
      uniform vec3 sunC;
      void main() {
        float h = vN.y;
        vec3 c = mix(bot, mid, smoothstep(-0.2, 0.08, h));
        c = mix(c, top, smoothstep(0.08, 0.78, h));
        float sun = pow(max(0.0, dot(normalize(vN), normalize(sunD))), 28.0);
        c += sunC * sun * 0.9;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
    });
    return new THREE.Mesh(geo, mat);
}
function addRoad(group, map, theme) {
    const pts = map.points;
    const n = pts.length;
    const half = map.width * 0.5;
    const pos = [];
    const uv = [];
    const nrm = [];
    let dist = 0;
    for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        pos.push(a.x + nx * half, 0.02, -(a.y + ny * half), a.x - nx * half, 0.02, -(a.y - ny * half));
        uv.push(0, dist / 8, 1, dist / 8);
        nrm.push(0, 1, 0, 0, 1, 0);
        dist += len;
    }
    pos.push(pos[0], pos[1], pos[2], pos[3], pos[4], pos[5]);
    uv.push(0, dist / 8, 1, dist / 8);
    nrm.push(0, 1, 0, 0, 1, 0);
    const idx = [];
    for (let i = 0; i < n; i++) {
        const i0 = i * 2;
        idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    geo.setIndex(idx);
    const tex = asphaltTex();
    tex.repeat.set(1, 24);
    group.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, color: theme.asphalt, roughness: 0.92, metalness: 0.04 })));
    const dashPos = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const dx = (b.x - a.x) / (len || 1);
        const dy = (b.y - a.y) / (len || 1);
        if (Math.floor(acc / 5) % 2 === 0) {
            dashPos.push(a.x, 0.045, -a.y, a.x + dx * Math.min(2.4, len), 0.045, -(a.y + dy * Math.min(2.4, len)));
        }
        acc += len;
    }
    const dashGeo = new THREE.BufferGeometry();
    dashGeo.setAttribute("position", new THREE.Float32BufferAttribute(dashPos, 3));
    group.add(new THREE.LineSegments(dashGeo, new THREE.LineBasicMaterial({ color: 0xe8eaee })));
    const left = [];
    const right = [];
    for (let i = 0; i <= n; i++) {
        const a = pts[i % n];
        const b = pts[(i + 1) % n];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        left.push(a.x + nx * (half - 0.28), 0.05, -(a.y + ny * (half - 0.28)));
        right.push(a.x - nx * (half - 0.28), 0.05, -(a.y - ny * (half - 0.28)));
    }
    const mkLine = (arr) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
        return new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xf0f2f6 }));
    };
    group.add(mkLine(left), mkLine(right));
}
function addBarriers(group, map) {
    const pts = map.points;
    const n = pts.length;
    const half = map.width * 0.5 + 0.55;
    const chev = chevronTex();
    chev.repeat.set(2, 1);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.55, metalness: 0.2 });
    const ledMat = new THREE.MeshStandardMaterial({
        map: chev,
        emissive: 0x3cff2a,
        emissiveMap: chev,
        emissiveIntensity: 0.9,
        roughness: 0.4,
    });
    const ledMatFlip = ledMat.clone();
    const chev2 = chev.clone();
    chev2.repeat.set(-2, 1);
    ledMatFlip.map = chev2;
    ledMatFlip.emissiveMap = chev2;
    const wallGeo = new THREE.BoxGeometry(1.8, 1.15, 0.22);
    const ledGeo = new THREE.PlaneGeometry(1.7, 0.7);
    const wallL = new THREE.InstancedMesh(wallGeo, wallMat, n);
    const wallR = new THREE.InstancedMesh(wallGeo, wallMat, n);
    const ledL = new THREE.InstancedMesh(ledGeo, ledMat, n);
    const ledR = new THREE.InstancedMesh(ledGeo, ledMatFlip, n);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % n];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const heading = Math.atan2(dy, dx);
        const sx = Math.max(0.7, Math.min(2.2, len * 0.55));
        dummy.scale.set(sx, 1, 1);
        dummy.position.set(a.x + nx * half, 0.58, -(a.y + ny * half));
        dummy.rotation.set(0, heading, 0);
        dummy.updateMatrix();
        wallL.setMatrixAt(i, dummy.matrix);
        dummy.position.set(a.x + nx * (half - 0.13), 0.72, -(a.y + ny * (half - 0.13)));
        dummy.updateMatrix();
        ledL.setMatrixAt(i, dummy.matrix);
        dummy.position.set(a.x - nx * half, 0.58, -(a.y - ny * half));
        dummy.rotation.set(0, heading, 0);
        dummy.updateMatrix();
        wallR.setMatrixAt(i, dummy.matrix);
        dummy.position.set(a.x - nx * (half - 0.13), 0.72, -(a.y - ny * (half - 0.13)));
        dummy.rotation.set(0, heading + Math.PI, 0);
        dummy.updateMatrix();
        ledR.setMatrixAt(i, dummy.matrix);
    }
    group.add(wallL, wallR, ledL, ledR);
}
function addStart(group, map) {
    const g = map.checkpoints[0];
    const mx = (g.a.x + g.b.x) * 0.5;
    const my = (g.a.y + g.b.y) * 0.5;
    const dx = g.b.x - g.a.x;
    const dy = g.b.y - g.a.y;
    const len = Math.hypot(dx, dy) || 1;
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 32;
    const ctx = c.getContext("2d");
    for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 2; j++) {
            ctx.fillStyle = (i + j) % 2 === 0 ? "#f4f4f5" : "#141416";
            ctx.fillRect((i * 128) / 10, j * 16, 12.8, 16);
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = Math.atan2(dx, dy);
    mesh.position.set(mx, 0.04, -my);
    group.add(mesh);
}
function addStartLights(group, map) {
    const f = yawToForward(map.start.yaw);
    const r = yawToRight(map.start.yaw);
    const half = map.width * 0.5 + 1.35;
    const gx = map.start.x + f.x * 7.2;
    const gy = map.start.y + f.y * 7.2;
    const gantry = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x1c1e22, metalness: 0.55, roughness: 0.4 });
    const poleGeo = new THREE.CylinderGeometry(0.16, 0.2, 5.2, 8);
    const poleL = new THREE.Mesh(poleGeo, steel);
    poleL.position.set(gx + r.x * half, 2.6, -(gy + r.y * half));
    const poleR = new THREE.Mesh(poleGeo, steel);
    poleR.position.set(gx - r.x * half, 2.6, -(gy - r.y * half));
    gantry.add(poleL, poleR);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.4, 0.22, 0.22), steel);
    bar.position.set(gx, 5.15, -gy);
    const along = new THREE.Vector3(r.x, 0, -r.y);
    if (along.lengthSq() > 0.0001) {
        along.normalize();
        bar.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), along);
    }
    gantry.add(bar);
    const mats = [];
    for (let i = 0; i < 3; i++) {
        const mat = new THREE.MeshStandardMaterial({
            color: 0x2a1010,
            emissive: 0x1a0808,
            emissiveIntensity: 0.2,
            roughness: 0.35,
        });
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), mat);
        const t = (i - 1) * 1.15;
        bulb.position.set(gx + r.x * t - f.x * 0.2, 4.72, -(gy + r.y * t - f.y * 0.2));
        gantry.add(bulb);
        mats.push(mat);
    }
    group.add(gantry);
    return { mats };
}
export function buildWorld(map) {
    const theme = THEMES[map.theme];
    const group = new THREE.Group();
    group.add(skyMesh(theme));
    const gtex = groundTex(theme);
    gtex.repeat.set(40, 40);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardMaterial({ map: gtex, color: theme.grass, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    group.add(ground);
    addRoad(group, map, theme);
    addBarriers(group, map);
    addStart(group, map);
    const startLights = addStartLights(group, map);
    addThemeScenery(group, map, theme);
    return {
        group,
        startLights: startLights.mats,
        theme,
        dispose() {
            group.traverse((o) => {
                const mesh = o;
                if (mesh.geometry)
                    mesh.geometry.dispose();
                const mat = mesh.material;
                if (Array.isArray(mat))
                    mat.forEach((m) => m.dispose());
                else if (mat) {
                    const std = mat;
                    std.map?.dispose();
                    std.emissiveMap?.dispose();
                    mat.dispose();
                }
            });
        },
    };
}
