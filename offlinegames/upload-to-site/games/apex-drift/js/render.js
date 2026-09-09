import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildCarVisual, disposeCar, poseCar } from "./carMesh.js";
import { createDebrisMesh, poseDebris } from "./debris.js";
import { THEMES } from "./data.js";
import { buildWorld } from "./world.js";
import { clamp, expLerp, yawToForward, yawToRight } from "./types.js";
import { lightPhase } from "./physics.js";
export function createRenderer(canvas) {
    const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "high-performance",
        alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(0xff8a4a, 1);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xc47848, 0.0085);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.2, 700);
    const hemi = new THREE.HemisphereLight(0xffc090, 0x3a2a18, 1.15);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd0a0, 1.65);
    sun.position.set(40, 28, -60);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8898c8, 0.28);
    fill.position.set(-30, 12, 20);
    scene.add(fill);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    let world = null;
    let player = null;
    let playerId = "";
    const rivals = [];
    const debrisMeshes = [];
    let camMode = 0;
    let camX = 0;
    let camY = 2.1;
    let camZ = 8;
    let lookX = 0;
    let lookY = 1;
    let lookZ = 0;
    let trauma = 0;
    let mapId = "";
    let lastClash = 0;
    const MAX_P = 280;
    const particles = [];
    const pPos = new Float32Array(MAX_P * 3);
    const pCol = new Float32Array(MAX_P * 3);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    const pMat = new THREE.PointsMaterial({
        size: 0.22,
        vertexColors: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        sizeAttenuation: true,
    });
    const pCloud = new THREE.Points(pGeo, pMat);
    pCloud.frustumCulled = false;
    scene.add(pCloud);
    const SKID_MAX = 360;
    const skidPos = new Float32Array(SKID_MAX * 3);
    const skidGeo = new THREE.BufferGeometry();
    skidGeo.setAttribute("position", new THREE.BufferAttribute(skidPos, 3));
    const skidMat = new THREE.PointsMaterial({
        color: 0x1a1a1c,
        size: 0.38,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        sizeAttenuation: true,
    });
    const skidCloud = new THREE.Points(skidGeo, skidMat);
    skidCloud.frustumCulled = false;
    scene.add(skidCloud);
    let skidI = 0;
    let skidN = 0;
    let skidAcc = 0;
    const LITTER_N = 26;
    const litter = [];
    const litPos = new Float32Array(LITTER_N * 3);
    const litCol = new Float32Array(LITTER_N * 3);
    const litGeo = new THREE.BufferGeometry();
    litGeo.setAttribute("position", new THREE.BufferAttribute(litPos, 3));
    litGeo.setAttribute("color", new THREE.BufferAttribute(litCol, 3));
    const litMat = new THREE.PointsMaterial({
        size: 0.34,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        sizeAttenuation: true,
    });
    const litCloud = new THREE.Points(litGeo, litMat);
    litCloud.frustumCulled = false;
    scene.add(litCloud);
    let windX = 1;
    let windZ = 0.3;
    function respawnLitter(item, cx, cz) {
        const a = Math.random() * Math.PI * 2;
        const r = 14 + Math.random() * 60;
        item.x = cx + Math.cos(a) * r;
        item.z = cz + Math.sin(a) * r;
        item.y = 1.4 + Math.random() * 7.5;
        item.paper = Math.random() > 0.45;
        item.spin = 1.2 + Math.random() * 2.4;
        item.bob = Math.random() * Math.PI * 2;
        item.wobAmp = 0.6 + Math.random() * 1.1;
    }
    function seedLitter(cx, cz) {
        litter.length = 0;
        for (let i = 0; i < LITTER_N; i++) {
            const item = { x: 0, y: 0, z: 0, paper: true, spin: 1, bob: 0, wobAmp: 1, t: Math.random() * 10 };
            respawnLitter(item, cx, cz);
            litter.push(item);
        }
    }
    function stepLitter(dt, cx, cz) {
        for (const item of litter) {
            item.t += dt;
            item.x += windX * item.spin * dt + Math.sin(item.t * 1.6 + item.bob) * item.wobAmp * dt;
            item.z += windZ * item.spin * dt + Math.cos(item.t * 1.3 + item.bob) * item.wobAmp * dt;
            item.y += Math.sin(item.t * 2.1 + item.bob) * 0.5 * dt;
            const dx = item.x - cx;
            const dz = item.z - cz;
            if (dx * dx + dz * dz > 130 * 130 || item.y < 0.4 || item.y > 11) {
                respawnLitter(item, cx, cz);
            }
        }
        for (let i = 0; i < LITTER_N; i++) {
            const item = litter[i];
            litPos[i * 3] = item.x;
            litPos[i * 3 + 1] = item.y;
            litPos[i * 3 + 2] = item.z;
            if (item.paper) {
                litCol[i * 3] = 0.86;
                litCol[i * 3 + 1] = 0.82;
                litCol[i * 3 + 2] = 0.7;
            }
            else {
                litCol[i * 3] = 0.62;
                litCol[i * 3 + 1] = 0.68;
                litCol[i * 3 + 2] = 0.64;
            }
        }
        litGeo.attributes.position.needsUpdate = true;
        litGeo.attributes.color.needsUpdate = true;
        litGeo.setDrawRange(0, LITTER_N);
    }
    function spawnNitroFlame(x, y, yaw) {
        const f = yawToForward(yaw);
        for (let i = 0; i < 3; i++) {
            if (particles.length >= MAX_P)
                particles.shift();
            const spread = (Math.random() - 0.5) * 0.5;
            particles.push({
                x: x - f.x * 2.1 + spread,
                y: 0.42 + Math.random() * 0.14,
                z: -y + f.y * 2.1 - spread,
                vx: -f.x * (4 + Math.random() * 3),
                vy: 0.4 + Math.random() * 0.6,
                vz: f.y * (4 + Math.random() * 3),
                life: 0.22 + Math.random() * 0.16,
                max: 0.32,
                kind: 2,
            });
        }
    }
    function spawnBurst(x, y, n, kind, speed = 8) {
        for (let i = 0; i < n; i++) {
            if (particles.length >= MAX_P)
                particles.shift();
            const a = Math.random() * Math.PI * 2;
            const s = speed * (0.35 + Math.random());
            particles.push({
                x,
                y: 0.4 + Math.random() * 0.5,
                z: -y,
                vx: Math.cos(a) * s,
                vy: 2 + Math.random() * 6,
                vz: Math.sin(a) * s,
                life: 0.28 + Math.random() * 0.35,
                max: 0.5,
                kind,
            });
        }
    }
    function spawnDrift(x, y, yaw) {
        const r = yawToRight(yaw);
        const f = yawToForward(yaw);
        for (const side of [-1, 1]) {
            if (particles.length >= MAX_P)
                particles.shift();
            const px = x + r.x * 0.85 * side - f.x * 1.4;
            const py = y + r.y * 0.85 * side - f.y * 1.4;
            particles.push({
                x: px,
                y: 0.18,
                z: -py,
                vx: (Math.random() - 0.5) * 1.2,
                vy: 0.8 + Math.random() * 1.4,
                vz: (Math.random() - 0.5) * 1.2,
                life: 0.35 + Math.random() * 0.25,
                max: 0.55,
                kind: 1,
            });
        }
    }
    function resize(w, h) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);
        camera.aspect = Math.max(0.1, w / Math.max(1, h));
        camera.updateProjectionMatrix();
    }
    function cycleCamera() {
        camMode = (camMode + 1) % 3;
    }
    function clearDebris() {
        for (const m of debrisMeshes) {
            scene.remove(m);
            m.traverse((o) => {
                const mesh = o;
                if (mesh.geometry)
                    mesh.geometry.dispose();
            });
        }
        debrisMeshes.length = 0;
    }
    function applyTheme(themeId) {
        const theme = THEMES[themeId];
        hemi.color.set(theme.hemiSky);
        hemi.groundColor.set(theme.hemiGround);
        sun.color.set(theme.sun);
        sun.intensity = theme.sunI;
        fill.intensity = themeId === "night" ? 0.12 : 0.28;
        scene.fog = new THREE.FogExp2(theme.fogHex, theme.fogDensity);
        renderer.setClearColor(theme.fogHex, 1);
        renderer.toneMappingExposure = themeId === "night" ? 0.92 : themeId === "volcano" ? 1.05 : 1.12;
    }
    function ensure(race, carId) {
        if (!world || mapId !== race.map.id) {
            if (world) {
                scene.remove(world.group);
                world.dispose();
            }
            clearDebris();
            world = buildWorld(race.map);
            scene.add(world.group);
            mapId = race.map.id;
            applyTheme(race.map.theme);
            particles.length = 0;
            skidI = 0;
            skidN = 0;
            skidPos.fill(0);
            const windAngle = Math.random() * Math.PI * 2;
            windX = Math.cos(windAngle) * (2.4 + Math.random() * 2.2);
            windZ = Math.sin(windAngle) * (2.4 + Math.random() * 2.2);
            seedLitter(race.map.start.x, -race.map.start.y);
            for (const d of race.debris) {
                const mesh = createDebrisMesh(d.kind);
                poseDebris(mesh, d);
                scene.add(mesh);
                debrisMeshes.push(mesh);
            }
        }
        if (!player || playerId !== carId) {
            if (player) {
                scene.remove(player.root);
                disposeCar(player);
            }
            player = buildCarVisual(carId);
            scene.add(player.root);
            playerId = carId;
        }
        while (rivals.length < race.rivals.length) {
            const r = race.rivals[rivals.length];
            const vis = buildCarVisual(r.carId);
            scene.add(vis.root);
            rivals.push(vis);
        }
        if (debrisMeshes.length !== race.debris.length) {
            clearDebris();
            for (const d of race.debris) {
                const mesh = createDebrisMesh(d.kind);
                poseDebris(mesh, d);
                scene.add(mesh);
                debrisMeshes.push(mesh);
            }
        }
    }
    function punch(amount) {
        trauma = clamp(trauma + amount, 0, 1);
    }
    function addSpark(x, y) {
        trauma = clamp(trauma + 0.2, 0, 1);
        spawnBurst(x, y, 18, 0, 10);
    }
    function resetFx(map) {
        trauma = 0;
        particles.length = 0;
        skidI = 0;
        skidN = 0;
        lastClash = 0;
        if (map) {
            const f = yawToForward(map.start.yaw);
            camX = map.start.x - f.x * 7.2;
            camZ = -(map.start.y - f.y * 7.2);
            camY = 2.15;
        }
    }
    function bakeMap() {
        /* world rebuilt in ensure */
    }
    function stepFx(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.z += p.vz * dt;
            p.vy -= 12 * dt;
            p.vx *= 0.92;
            p.vz *= 0.92;
        }
        pPos.fill(0);
        pCol.fill(0);
        const n = Math.min(particles.length, MAX_P);
        for (let i = 0; i < n; i++) {
            const p = particles[i];
            pPos[i * 3] = p.x;
            pPos[i * 3 + 1] = Math.max(0.05, p.y);
            pPos[i * 3 + 2] = p.z;
            const t = p.life / p.max;
            if (p.kind === 0) {
                pCol[i * 3] = 1;
                pCol[i * 3 + 1] = 0.45 + t * 0.4;
                pCol[i * 3 + 2] = 0.12;
            }
            else if (p.kind === 2) {
                pCol[i * 3] = 0.35 + t * 0.3;
                pCol[i * 3 + 1] = 0.72 + t * 0.2;
                pCol[i * 3 + 2] = 1;
            }
            else {
                pCol[i * 3] = 0.55;
                pCol[i * 3 + 1] = 0.55;
                pCol[i * 3 + 2] = 0.58;
            }
        }
        pGeo.attributes.position.needsUpdate = true;
        pGeo.attributes.color.needsUpdate = true;
        pGeo.setDrawRange(0, n);
    }
    function render(race, carId, steer, dt, shakeMul, _hud) {
        ensure(race, carId);
        const car = race.car;
        const f = yawToForward(car.yaw);
        if (player) {
            poseCar(player, car.x, car.y, car.yaw, steer, car.u, dt, steer === 0 && car.u < 8, race.boostT > 0, car.drifting);
        }
        for (let i = 0; i < race.rivals.length; i++) {
            const r = race.rivals[i];
            const vis = rivals[i];
            if (vis) {
                poseCar(vis, r.x, r.y, r.yaw, 0, r.u, dt, false, false, false);
                if (r.hitT > 0)
                    vis.root.scale.setScalar(1.04);
                else
                    vis.root.scale.setScalar(1);
            }
        }
        for (let i = 0; i < race.debris.length; i++) {
            const mesh = debrisMeshes[i];
            const d = race.debris[i];
            if (mesh)
                poseDebris(mesh, d);
        }
        if (world) {
            const phase = lightPhase(race.lightT);
            const reds = race.racing ? 0 : phase.reds;
            const green = race.racing && race.goT > 0;
            for (let i = 0; i < world.startLights.length; i++) {
                const mat = world.startLights[i];
                if (green) {
                    mat.color.set(0x3cff2a);
                    mat.emissive.set(0x3cff2a);
                    mat.emissiveIntensity = 3.4;
                }
                else if (i < reds) {
                    mat.color.set(0xff2a22);
                    mat.emissive.set(0xff2a22);
                    mat.emissiveIntensity = 3.1;
                }
                else {
                    mat.color.set(0x2a1010);
                    mat.emissive.set(0x1a0808);
                    mat.emissiveIntensity = 0.18;
                }
            }
        }
        if (car.drifting && car.speed > 6) {
            spawnDrift(car.x, car.y, car.yaw);
            skidAcc += dt;
            if (skidAcc > 0.03) {
                skidAcc = 0;
                const rr = yawToRight(car.yaw);
                const ff = yawToForward(car.yaw);
                for (const side of [-1, 1]) {
                    const sx = car.x + rr.x * 0.82 * side - ff.x * 1.35;
                    const sy = car.y + rr.y * 0.82 * side - ff.y * 1.35;
                    skidPos[skidI * 3] = sx;
                    skidPos[skidI * 3 + 1] = 0.04;
                    skidPos[skidI * 3 + 2] = -sy;
                    skidI = (skidI + 1) % SKID_MAX;
                    skidN = Math.min(SKID_MAX, skidN + 1);
                }
                skidGeo.attributes.position.needsUpdate = true;
                skidGeo.setDrawRange(0, skidN);
            }
        }
        if (race.clashT > 0 && race.clashT > lastClash - 0.05) {
            if (race.clashImpact > 4)
                spawnBurst(race.clashX, race.clashY, 22, 0, 12);
        }
        lastClash = race.clashT;
        if (race.usingNitro) {
            spawnNitroFlame(car.x, car.y, car.yaw);
        }
        stepFx(dt);
        stepLitter(dt, car.x, -car.y);
        const px = car.x;
        const pz = -car.y;
        const fx = f.x;
        const fz = -f.y;
        let dist = 7.4;
        let height = 2.15;
        let lookH = 1.05;
        let lookA = 10;
        let fov = 56 + Math.abs(car.u) * 0.18;
        if (camMode === 1) {
            dist = 11.5;
            height = 4.2;
            lookH = 0.6;
            lookA = 6;
            fov = 62;
        }
        else if (camMode === 2) {
            dist = 2.4;
            height = 1.45;
            lookH = 0.95;
            lookA = 18;
            fov = 66;
        }
        const tx = px - fx * dist;
        const ty = height;
        const tz = pz - fz * dist;
        const k = camMode === 2 ? 14 : 6.2;
        camX = expLerp(camX, tx, k, dt);
        camY = expLerp(camY, ty, k, dt);
        camZ = expLerp(camZ, tz, k, dt);
        lookX = expLerp(lookX, px + fx * lookA, 8, dt);
        lookY = expLerp(lookY, lookH, 8, dt);
        lookZ = expLerp(lookZ, pz + fz * lookA, 8, dt);
        trauma = Math.max(0, trauma - dt * 1.8);
        const shake = trauma * trauma * 0.35 * shakeMul;
        camera.fov = camera.fov + (fov - camera.fov) * 0.12;
        camera.updateProjectionMatrix();
        camera.position.set(camX + (Math.random() - 0.5) * shake, camY, camZ + (Math.random() - 0.5) * shake);
        camera.lookAt(lookX, lookY, lookZ);
        renderer.render(scene, camera);
    }
    function dispose() {
        if (world) {
            scene.remove(world.group);
            world.dispose();
        }
        if (player) {
            scene.remove(player.root);
            disposeCar(player);
        }
        for (const r of rivals) {
            scene.remove(r.root);
            disposeCar(r);
        }
        clearDebris();
        pGeo.dispose();
        pMat.dispose();
        skidGeo.dispose();
        skidMat.dispose();
        litGeo.dispose();
        litMat.dispose();
        renderer.dispose();
    }
    return { resize, render, punch, addSpark, resetFx, bakeMap, cycleCamera, dispose, getCamMode: () => camMode };
}
