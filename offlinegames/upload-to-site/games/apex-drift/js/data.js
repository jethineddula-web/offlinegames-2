import { clamp, headingFromDir, mulberry, resampleClosed, smoothClosed, wrapAngle, } from "./types.js";
export const THEMES = {
    city: {
        id: "city",
        sky: "#6a7a8c",
        sky2: "#c4ccd4",
        grass: "#3a3e3a",
        grass2: "#2c302c",
        asphalt: "#4a4c52",
        asphalt2: "#32343a",
        line: "#d8dbe0",
        curbA: "#cfcfd4",
        curbB: "#8a3a32",
        barrier: "#4a4c52",
        fog: "rgba(80,90,100,0.16)",
        hemiSky: "#c8d0d8",
        hemiGround: "#3a3c38",
        sun: "#fff0d0",
        sunI: 1.45,
        fogHex: 0x8a96a4,
        fogDensity: 0.0048,
    },
    night: {
        id: "night",
        sky: "#070b14",
        sky2: "#121a2c",
        grass: "#0c1014",
        grass2: "#080c10",
        asphalt: "#3a4250",
        asphalt2: "#242a34",
        line: "#c5cdd8",
        curbA: "#d0d4da",
        curbB: "#3d5a78",
        barrier: "#3a4250",
        fog: "rgba(8,10,16,0.28)",
        hemiSky: "#2a3a58",
        hemiGround: "#0c1018",
        sun: "#8898c8",
        sunI: 0.55,
        fogHex: 0x101820,
        fogDensity: 0.0072,
    },
    desert: {
        id: "desert",
        sky: "#e8c888",
        sky2: "#c4a068",
        grass: "#c2a074",
        grass2: "#a8885c",
        asphalt: "#4a4642",
        asphalt2: "#383430",
        line: "#e6dcc8",
        curbA: "#e8dcc8",
        curbB: "#8a5a32",
        barrier: "#6a5a48",
        fog: "rgba(180,150,110,0.12)",
        hemiSky: "#f0d8a8",
        hemiGround: "#8a6a44",
        sun: "#ffe0a0",
        sunI: 1.85,
        fogHex: 0xc4a878,
        fogDensity: 0.0038,
    },
    alpine: {
        id: "alpine",
        sky: "#7aa0c4",
        sky2: "#d8e8f4",
        grass: "#4d5c48",
        grass2: "#3a4a38",
        asphalt: "#3e4248",
        asphalt2: "#2c3036",
        line: "#e4e8ee",
        curbA: "#dfe4ea",
        curbB: "#6a3a32",
        barrier: "#5a646e",
        fog: "rgba(180,200,220,0.16)",
        hemiSky: "#d0e4f4",
        hemiGround: "#4a5848",
        sun: "#fff6e8",
        sunI: 1.5,
        fogHex: 0xa8c0d4,
        fogDensity: 0.0044,
    },
    coast: {
        id: "coast",
        sky: "#4a90c4",
        sky2: "#b8d8f0",
        grass: "#3d5a4a",
        grass2: "#2e4a3c",
        asphalt: "#3c4046",
        asphalt2: "#2c3036",
        line: "#e8eef2",
        curbA: "#f0f4f6",
        curbB: "#2a6a7a",
        barrier: "#4a6878",
        fog: "rgba(80,120,140,0.14)",
        hemiSky: "#c8e4f8",
        hemiGround: "#3a5a50",
        sun: "#fff4d0",
        sunI: 1.7,
        fogHex: 0x7aa8c4,
        fogDensity: 0.0036,
        water: "#1a6a88",
    },
    beach: {
        id: "beach",
        sky: "#5aa8d8",
        sky2: "#f0d8a0",
        grass: "#d2c08a",
        grass2: "#c4ae72",
        asphalt: "#4a4640",
        asphalt2: "#36322c",
        line: "#f4eee0",
        curbA: "#f0e8d4",
        curbB: "#2a8aaa",
        barrier: "#5a7a88",
        fog: "rgba(200,180,120,0.1)",
        hemiSky: "#ffe8b8",
        hemiGround: "#c4b07a",
        sun: "#ffe8a8",
        sunI: 1.9,
        fogHex: 0xc8c090,
        fogDensity: 0.0032,
        water: "#1e88aa",
    },
    forest: {
        id: "forest",
        sky: "#3a4a3c",
        sky2: "#6a8068",
        grass: "#2f4a32",
        grass2: "#243828",
        asphalt: "#3a3e3a",
        asphalt2: "#2a2e2a",
        line: "#d4d8d0",
        curbA: "#d8dcd4",
        curbB: "#4a6a3a",
        barrier: "#3a4a38",
        fog: "rgba(20,30,22,0.22)",
        hemiSky: "#88a080",
        hemiGround: "#243428",
        sun: "#d8e0b0",
        sunI: 1.05,
        fogHex: 0x3a4a38,
        fogDensity: 0.0065,
    },
    industrial: {
        id: "industrial",
        sky: "#5a5c60",
        sky2: "#8a8c90",
        grass: "#3a3c38",
        grass2: "#2e302c",
        asphalt: "#3c3e42",
        asphalt2: "#2c2e32",
        line: "#c8ccd0",
        curbA: "#c4c8cc",
        curbB: "#8a6a32",
        barrier: "#5a5c60",
        fog: "rgba(20,20,22,0.2)",
        hemiSky: "#a8aab0",
        hemiGround: "#3a3c38",
        sun: "#d8d0c0",
        sunI: 1.15,
        fogHex: 0x6a6c70,
        fogDensity: 0.0055,
    },
    snow: {
        id: "snow",
        sky: "#c8d4e0",
        sky2: "#eef4f8",
        grass: "#d8e0e8",
        grass2: "#c0ccd8",
        asphalt: "#4a5058",
        asphalt2: "#383e46",
        line: "#f4f7fa",
        curbA: "#f2f5f8",
        curbB: "#3a5a78",
        barrier: "#8aa0b0",
        fog: "rgba(220,230,240,0.18)",
        hemiSky: "#f4f8fc",
        hemiGround: "#c0ccd8",
        sun: "#ffffff",
        sunI: 1.35,
        fogHex: 0xd0dce8,
        fogDensity: 0.005,
    },
    canyon: {
        id: "canyon",
        sky: "#d08a5a",
        sky2: "#f0c090",
        grass: "#8a5a3a",
        grass2: "#6e462c",
        asphalt: "#3e3a38",
        asphalt2: "#2e2a28",
        line: "#e8d8c8",
        curbA: "#e6d4c4",
        curbB: "#8a3228",
        barrier: "#6a4a3a",
        fog: "rgba(160,90,50,0.12)",
        hemiSky: "#f0c090",
        hemiGround: "#6a4630",
        sun: "#ffc070",
        sunI: 1.75,
        fogHex: 0xc48458,
        fogDensity: 0.004,
    },
    volcano: {
        id: "volcano",
        sky: "#2a1c1c",
        sky2: "#4a2824",
        grass: "#3a2a24",
        grass2: "#2a1c18",
        asphalt: "#3a3434",
        asphalt2: "#2a2424",
        line: "#d8c8c4",
        curbA: "#d4c8c4",
        curbB: "#8a2a22",
        barrier: "#5a3a38",
        fog: "rgba(40,16,12,0.22)",
        hemiSky: "#6a3028",
        hemiGround: "#1a1010",
        sun: "#ff6a32",
        sunI: 1.25,
        fogHex: 0x3a201c,
        fogDensity: 0.0068,
    },
    sunset: {
        id: "sunset",
        sky: "#ff7a3a",
        sky2: "#ffb070",
        grass: "#6a5a3a",
        grass2: "#8a6a48",
        asphalt: "#3a3c42",
        asphalt2: "#2a2c32",
        line: "#f0f2f6",
        curbA: "#f4f4f5",
        curbB: "#2a2c30",
        barrier: "#1a1c20",
        fog: "rgba(255,140,70,0.12)",
        hemiSky: "#ffb080",
        hemiGround: "#5a4030",
        sun: "#ff9040",
        sunI: 1.8,
        fogHex: 0xc47848,
        fogDensity: 0.0042,
        water: "#1a4a68",
    },
};
export const CARS = [
    {
        id: "hatch",
        name: "Verde Spyder",
        className: "Supercar",
        price: 0,
        color: "#c6e000",
        accent: "#c45a28",
        body: "spyder",
        mass: 1180,
        power: 16800,
        brake: 18000,
        gripF: 1.16,
        gripR: 0.9,
        turn: 1.08,
        nitro: 1.05,
    },
    {
        id: "coupe",
        name: "Azure GT",
        className: "Grand tourer",
        price: 420,
        color: "#2a5cff",
        accent: "#1c1e22",
        body: "sedan-gt",
        mass: 1280,
        power: 15200,
        brake: 17000,
        gripF: 1.12,
        gripR: 0.92,
        turn: 1.0,
        nitro: 0.95,
    },
    {
        id: "s14",
        name: "Ember Coupe",
        className: "Street",
        price: 980,
        color: "#e24a1a",
        accent: "#1a1210",
        body: "coupe",
        mass: 1220,
        power: 14800,
        brake: 16500,
        gripF: 1.1,
        gripR: 0.78,
        turn: 1.14,
        nitro: 1.0,
    },
    {
        id: "hauler",
        name: "Ridge Hauler",
        className: "Utility",
        price: 1200,
        color: "#4a5a34",
        accent: "#e8b23a",
        body: "truck",
        mass: 1900,
        power: 17200,
        brake: 15000,
        gripF: 0.95,
        gripR: 0.68,
        turn: 0.82,
        nitro: 1.0,
    },
    {
        id: "muscle",
        name: "Crimson V8",
        className: "Muscle",
        price: 1680,
        color: "#8a1a18",
        accent: "#1a1210",
        body: "muscle",
        mass: 1480,
        power: 18600,
        brake: 16200,
        gripF: 1.0,
        gripR: 0.7,
        turn: 0.86,
        nitro: 1.12,
    },
    {
        id: "rally",
        name: "Alpine Rally",
        className: "All-surface",
        price: 2400,
        color: "#e8eaee",
        accent: "#2a5a38",
        body: "rally",
        mass: 1220,
        power: 14000,
        brake: 17000,
        gripF: 1.2,
        gripR: 1.02,
        turn: 1.08,
        nitro: 0.95,
    },
    {
        id: "gt",
        name: "Nocturne GT",
        className: "Night",
        price: 3600,
        color: "#1a2438",
        accent: "#c8ccd4",
        body: "gt",
        mass: 1320,
        power: 19600,
        brake: 19000,
        gripF: 1.18,
        gripR: 0.9,
        turn: 1.12,
        nitro: 1.15,
    },
    {
        id: "hyper",
        name: "Vesper Hyper",
        className: "Hyper",
        price: 5400,
        color: "#d8dce4",
        accent: "#2a2c32",
        body: "hyper",
        mass: 1260,
        power: 22800,
        brake: 21000,
        gripF: 1.22,
        gripR: 0.86,
        turn: 1.2,
        nitro: 1.3,
    },
    {
        id: "apex",
        name: "Apex Legend",
        className: "Prototype",
        price: 8200,
        color: "#14161a",
        accent: "#c6e000",
        body: "prototype",
        mass: 1180,
        power: 24800,
        brake: 23000,
        gripF: 1.28,
        gripR: 0.84,
        turn: 1.28,
        nitro: 1.45,
    },
];
const SPECS = [
    { id: "sunset-strip", name: "Sunset Strip", theme: "beach", locale: "Sunset beach", difficulty: 1, laps: 2, coins: 140, width: 18, shape: "stadium", seed: 7, rx: 168, ry: 52 },
    { id: "rookie-oval", name: "Rookie Oval", theme: "city", locale: "Downtown streets", difficulty: 1, laps: 3, coins: 90, width: 16, shape: "oval", seed: 11, rx: 92, ry: 56 },
    { id: "harbor-loop", name: "Harbor Loop", theme: "coast", locale: "Harbor sea", difficulty: 1, laps: 3, coins: 100, width: 15.5, shape: "stadium", seed: 21, rx: 110, ry: 52 },
    { id: "pine-ring", name: "Pine Ring", theme: "forest", locale: "Pine forest", difficulty: 1, laps: 3, coins: 110, width: 15, shape: "blob", seed: 31, rx: 96, ry: 70 },
    { id: "dust-bowl", name: "Dust Bowl", theme: "desert", locale: "Desert dunes", difficulty: 1, laps: 3, coins: 120, width: 17, shape: "wide", seed: 41, rx: 120, ry: 72 },
    { id: "dockside", name: "Dockside", theme: "industrial", locale: "Cargo docks", difficulty: 2, laps: 3, coins: 130, width: 14.5, shape: "dock", seed: 51, rx: 108, ry: 58 },
    { id: "neon-district", name: "Neon District", theme: "night", locale: "Neon city", difficulty: 2, laps: 3, coins: 140, width: 14, shape: "tech", seed: 61, rx: 100, ry: 78 },
    { id: "salt-flats", name: "Salt Flats", theme: "desert", locale: "White salt pan", difficulty: 2, laps: 4, coins: 150, width: 18, shape: "oval", seed: 71, rx: 140, ry: 64 },
    { id: "switchback", name: "Switchback", theme: "alpine", locale: "Mountain pass", difficulty: 2, laps: 3, coins: 160, width: 13.5, shape: "hairpin", seed: 81, rx: 88, ry: 110 },
    { id: "night-market", name: "Night Market", theme: "night", locale: "Lantern market", difficulty: 2, laps: 3, coins: 170, width: 13, shape: "chicane", seed: 91, rx: 96, ry: 84 },
    { id: "canyon-run", name: "Canyon Run", theme: "canyon", locale: "Red rock canyon", difficulty: 3, laps: 3, coins: 180, width: 13, shape: "hairpin", seed: 101, rx: 78, ry: 120 },
    { id: "rain-district", name: "Rain District", theme: "city", locale: "Rainy downtown", difficulty: 3, laps: 3, coins: 190, width: 14, shape: "tech", seed: 111, rx: 112, ry: 90 },
    { id: "quarry", name: "Quarry Cut", theme: "industrial", locale: "Stone quarry", difficulty: 3, laps: 3, coins: 200, width: 14.5, shape: "blob", seed: 121, rx: 104, ry: 86 },
    { id: "frozen-circuit", name: "Frozen Circuit", theme: "snow", locale: "Frozen lake", difficulty: 3, laps: 3, coins: 210, width: 15, shape: "stadium", seed: 131, rx: 118, ry: 60 },
    { id: "cliffside", name: "Cliffside", theme: "coast", locale: "Cliff beach", difficulty: 3, laps: 3, coins: 220, width: 13.2, shape: "peanut", seed: 141, rx: 120, ry: 70 },
    { id: "power-grid", name: "Power Grid", theme: "industrial", locale: "Power plant", difficulty: 3, laps: 3, coins: 230, width: 13.5, shape: "tech", seed: 151, rx: 108, ry: 96 },
    { id: "vineyard", name: "Vineyard", theme: "forest", locale: "Hill vineyard", difficulty: 3, laps: 3, coins: 240, width: 14.2, shape: "blob", seed: 161, rx: 116, ry: 88 },
    { id: "airport-run", name: "Airport Run", theme: "sunset", locale: "Airport tarmac", difficulty: 4, laps: 4, coins: 260, width: 16, shape: "trioval", seed: 171, rx: 150, ry: 58 },
    { id: "old-town", name: "Old Town", theme: "city", locale: "Plaza streets", difficulty: 4, laps: 3, coins: 270, width: 12.5, shape: "chicane", seed: 181, rx: 90, ry: 90 },
    { id: "volcano-rim", name: "Volcano Rim", theme: "volcano", locale: "Lava rim", difficulty: 4, laps: 3, coins: 280, width: 14, shape: "wide", seed: 191, rx: 128, ry: 100 },
    { id: "twin-bridges", name: "Twin Bridges", theme: "coast", locale: "Coastal bridges", difficulty: 4, laps: 3, coins: 290, width: 13.8, shape: "peanut", seed: 201, rx: 130, ry: 64 },
    { id: "stadium-gp", name: "Stadium GP", theme: "city", locale: "City stadium", difficulty: 4, laps: 4, coins: 300, width: 15, shape: "stadium", seed: 211, rx: 132, ry: 62 },
    { id: "midnight-express", name: "Midnight Express", theme: "night", locale: "Night highway", difficulty: 4, laps: 4, coins: 320, width: 14.5, shape: "trioval", seed: 221, rx: 146, ry: 70 },
    { id: "temple-grounds", name: "Temple Grounds", theme: "canyon", locale: "Desert temple", difficulty: 5, laps: 3, coins: 340, width: 12.8, shape: "tech", seed: 231, rx: 100, ry: 100 },
    { id: "grand-basin", name: "Grand Basin", theme: "alpine", locale: "Alpine lake", difficulty: 5, laps: 4, coins: 360, width: 15.5, shape: "wide", seed: 241, rx: 150, ry: 110 },
    { id: "drift-arena", name: "Drift Arena", theme: "industrial", locale: "Warehouse arena", difficulty: 5, laps: 4, coins: 380, width: 18, shape: "oval", seed: 251, rx: 80, ry: 80 },
    { id: "hairpin-peak", name: "Hairpin Peak", theme: "alpine", locale: "Snow peaks", difficulty: 5, laps: 3, coins: 400, width: 12.2, shape: "hairpin", seed: 261, rx: 86, ry: 130 },
    { id: "metro-complex", name: "Metro Complex", theme: "night", locale: "Metro tunnels", difficulty: 5, laps: 3, coins: 420, width: 12.4, shape: "chicane", seed: 271, rx: 108, ry: 108 },
    { id: "apex-final", name: "Apex Final", theme: "volcano", locale: "Caldera night", difficulty: 5, laps: 4, coins: 480, width: 13.6, shape: "blob", seed: 281, rx: 138, ry: 108 },
];
function oval(rx, ry, n = 36) {
    const pts = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry });
    }
    return pts;
}
function stadium(rx, ry) {
    const pts = [];
    const straight = rx - ry;
    for (let i = 0; i < 16; i++) {
        const a = -Math.PI / 2 + (i / 15) * Math.PI;
        pts.push({ x: straight + Math.cos(a) * ry, y: Math.sin(a) * ry });
    }
    for (let i = 0; i < 16; i++) {
        const a = Math.PI / 2 + (i / 15) * Math.PI;
        pts.push({ x: -straight + Math.cos(a) * ry, y: Math.sin(a) * ry });
    }
    return pts;
}
function dock(rx, ry, r) {
    const pts = [];
    const corners = [
        { x: rx, y: ry, a0: 0, a1: Math.PI / 2 },
        { x: -rx, y: ry, a0: Math.PI / 2, a1: Math.PI },
        { x: -rx, y: -ry, a0: Math.PI, a1: (3 * Math.PI) / 2 },
        { x: rx, y: -ry, a0: (3 * Math.PI) / 2, a1: Math.PI * 2 },
    ];
    for (const c of corners) {
        for (let i = 0; i <= 8; i++) {
            const a = c.a0 + ((c.a1 - c.a0) * i) / 8;
            pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
        }
    }
    return pts;
}
function blob(rx, ry, seed, harmonics = 4) {
    const rand = mulberry(seed);
    const ax = [];
    const ay = [];
    const px = [];
    const py = [];
    for (let k = 1; k <= harmonics; k++) {
        const decay = 1 / (k * 1.35);
        ax.push((0.12 + rand() * 0.28) * decay);
        ay.push((0.12 + rand() * 0.28) * decay);
        px.push(rand() * Math.PI * 2);
        py.push(rand() * Math.PI * 2);
    }
    const n = 48;
    const pts = [];
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        let x = Math.cos(t);
        let y = Math.sin(t);
        for (let k = 0; k < harmonics; k++) {
            x += ax[k] * Math.cos((k + 2) * t + px[k]);
            y += ay[k] * Math.sin((k + 2) * t + py[k]);
        }
        pts.push({ x: x * rx, y: y * ry });
    }
    return pts;
}
function peanut(rx, ry) {
    const pts = [];
    const n = 48;
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const pinch = 0.72 + 0.28 * Math.cos(2 * t);
        pts.push({ x: Math.cos(t) * rx * pinch, y: Math.sin(t) * ry });
    }
    return pts;
}
function tech(rx, ry, seed) {
    const rand = mulberry(seed);
    const base = dock(rx * 0.72, ry * 0.62, 26);
    return base.map((p, i) => {
        const n = 0.96 + rand() * 0.07 + 0.035 * Math.sin(i * 0.6);
        return { x: p.x * n, y: p.y * n };
    });
}
function hairpin(rx, ry, seed) {
    const rand = mulberry(seed);
    const n = 40;
    const pts = [];
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const rad = 0.72 + 0.28 * Math.sin(3 * t + seed) + 0.08 * Math.sin(7 * t);
        const jag = 1 + (rand() * 0.08 - 0.04);
        pts.push({ x: Math.cos(t) * rx * rad * jag, y: Math.sin(t) * ry * rad * jag });
    }
    return pts;
}
function chicane(rx, ry, seed) {
    const pts = stadium(rx, ry);
    const rand = mulberry(seed);
    return pts.map((p, i) => {
        const wave = Math.sin(i * 0.55 + seed) * (8 + rand() * 10);
        const nx = p.x === 0 && p.y === 0 ? 0 : -p.y / (Math.hypot(p.x, p.y) || 1);
        const ny = p.x / (Math.hypot(p.x, p.y) || 1);
        return { x: p.x + nx * wave, y: p.y + ny * wave };
    });
}
function trioval(rx, ry) {
    const pts = [];
    const n = 40;
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const k = t > Math.PI ? 1.18 : 0.88;
        pts.push({ x: Math.cos(t) * rx * k, y: Math.sin(t) * ry });
    }
    return pts;
}
function difficultyKinks(pts, spec) {
    const difficulty = spec.difficulty ?? 1;
    if (difficulty <= 1)
        return pts;
    const rand = mulberry(spec.seed + 777);
    const pinchProne = spec.shape === "hairpin" || spec.shape === "tech" || spec.shape === "dock" || spec.shape === "peanut" || spec.shape === "chicane";
    const scale = pinchProne ? 0.45 : 1;
    const freq = 1.6 + difficulty * 1.05;
    const amp = (difficulty - 1) * 0.85 * scale;
    const phase = rand() * Math.PI * 2;
    const phase2 = rand() * Math.PI * 2;
    const n = pts.length;
    return pts.map((p, i) => {
        const t = (i / n) * Math.PI * 2;
        const len = Math.hypot(p.x, p.y) || 1;
        const nx = p.x / len;
        const ny = p.y / len;
        const wob = Math.sin(t * freq + phase) * amp + Math.sin(t * (freq * 1.7) + phase2) * amp * 0.35;
        return { x: p.x + nx * wob, y: p.y + ny * wob };
    });
}
function limitCurvature(points, minRadius) {
    const n = points.length;
    const pts = points.map((p) => ({ x: p.x, y: p.y }));
    for (let iter = 0; iter < 4; iter++) {
        for (let i = 0; i < n; i++) {
            const a = pts[(i - 1 + n) % n];
            const b = pts[i];
            const c = pts[(i + 1) % n];
            const abx = b.x - a.x, aby = b.y - a.y;
            const bcx = c.x - b.x, bcy = c.y - b.y;
            const lenAB = Math.hypot(abx, aby) || 1;
            const lenBC = Math.hypot(bcx, bcy) || 1;
            const turn = Math.abs(wrapAngle(Math.atan2(bcy, bcx) - Math.atan2(aby, abx)));
            const segLen = (lenAB + lenBC) * 0.5;
            const radius = turn > 1e-4 ? segLen / turn : Infinity;
            if (radius < minRadius) {
                const mx = (a.x + c.x) * 0.5;
                const my = (a.y + c.y) * 0.5;
                const t = clamp(1 - radius / minRadius, 0, 0.55);
                b.x += (mx - b.x) * t;
                b.y += (my - b.y) * t;
            }
        }
    }
    return pts;
}
function buildShape(spec) {
    switch (spec.shape) {
        case "oval":
            return oval(spec.rx, spec.ry);
        case "stadium":
            return stadium(spec.rx, spec.ry);
        case "trioval":
            return trioval(spec.rx, spec.ry);
        case "dock":
            return dock(spec.rx * 0.7, spec.ry * 0.55, 16);
        case "blob":
            return blob(spec.rx, spec.ry, spec.seed, spec.difficulty >= 4 ? 5 : 3);
        case "peanut":
            return peanut(spec.rx, spec.ry);
        case "tech":
            return tech(spec.rx, spec.ry, spec.seed);
        case "hairpin":
            return hairpin(spec.rx, spec.ry, spec.seed);
        case "chicane":
            return chicane(spec.rx, spec.ry, spec.seed);
        case "wide":
            return blob(spec.rx, spec.ry, spec.seed, 2);
    }
}
function offsetGate(pts, i, half) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    return {
        a: { x: mx + nx * half, y: my + ny * half },
        b: { x: mx - nx * half, y: my - ny * half },
    };
}
function findStraightStart(points) {
    const n = points.length;
    let best = 0;
    let bestScore = -1;
    for (let i = 0; i < n; i++) {
        let score = 0;
        for (let k = 0; k < 14; k++) {
            const a = points[(i + k) % n];
            const b = points[(i + k + 1) % n];
            const c = points[(i + k + 2) % n];
            const h1 = headingFromDir(b.x - a.x, b.y - a.y);
            const h2 = headingFromDir(c.x - b.x, c.y - b.y);
            score += 1 - Math.min(1, Math.abs(wrapAngle(h2 - h1)) * 2.4);
        }
        if (score > bestScore) {
            bestScore = score;
            best = i;
        }
    }
    return best;
}
function compile(spec) {
    const shaped = difficultyKinks(buildShape(spec), spec);
    const sharpShape = spec.shape === "hairpin" || spec.shape === "chicane" || spec.shape === "tech";
    const smoothPasses = sharpShape ? 4 : 5;
    const smoothedRaw = smoothClosed(shaped, smoothPasses);
    const minRadius = spec.width * 0.6 + 11;
    let smoothed = smoothedRaw;
    for (let pass = 0; pass < 6; pass++) {
        smoothed = resampleClosed(limitCurvature(smoothed, minRadius), 4.4);
    }
    const startIdx = findStraightStart(smoothed);
    const points = smoothed.slice(startIdx).concat(smoothed.slice(0, startIdx));
    let length = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        length += Math.hypot(b.x - a.x, b.y - a.y);
    }
    const nCp = 8;
    const checkpoints = [];
    for (let c = 0; c < nCp; c++) {
        const idx = Math.floor((c / nCp) * points.length) % points.length;
        const g = offsetGate(points, idx, spec.width * 0.62);
        checkpoints.push({ ...g, t: c / nCp });
    }
    const p0 = points[0];
    const p1 = points[1];
    const start = {
        x: p0.x,
        y: p0.y,
        yaw: headingFromDir(p1.x - p0.x, p1.y - p0.y),
    };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    }
    const pad = spec.width + 40;
    return {
        id: spec.id,
        name: spec.name,
        theme: spec.theme,
        locale: spec.locale,
        difficulty: spec.difficulty,
        laps: spec.laps,
        coins: spec.coins,
        width: spec.width,
        seed: spec.seed,
        points,
        length,
        checkpoints,
        start,
        speedMul: 1 + (spec.difficulty - 1) * 0.1,
        bounds: { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad },
    };
}
export const MAPS = SPECS.map(compile);
export function mapById(id) {
    return MAPS.find((m) => m.id === id) ?? MAPS[0];
}
export function carById(id) {
    return CARS.find((c) => c.id === id) ?? CARS[0];
}
export function upgradeCost(level) {
    return Math.round(140 * Math.pow(1.55, level));
}
export function nextMapId(id) {
    const i = MAPS.findIndex((m) => m.id === id);
    if (i < 0)
        return MAPS[0].id;
    return MAPS[Math.min(i + 1, MAPS.length - 1)].id;
}
