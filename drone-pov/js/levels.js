/**
 * Level catalogue — 12 real-world flying locations.
 * Every entry drives lighting, palette, terrain, buildings, roads, hazards and music.
 */
const MINOR = [0, 3, 5, 7, 10, 12, 15];
const DORIAN = [0, 2, 3, 5, 7, 9, 10, 12];
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11, 12];
const AEOLIAN = [0, 2, 3, 5, 7, 8, 10, 12];

export const LEVELS = [
  { id: 0, name: "Sunset Downtown", subtitle: "City Centre · Golden Hour", biome: "downtown", seed: 10427,
    fog: 0xd8c6ad, fogDensity: 0.0034, skyTop: 0x3c6ea8, skyBottom: 0xf3c890, sun: 0xffd9a2, sunIntensity: 1.7, ambient: 0xaec4da, ambientIntensity: 0.85,
    accent: 0xff8a2b, accent2: 0xf7f7f2, gem: 0xffc94a, groundTex: "concrete", water: false, ceiling: false, night: false,
    segments: 22, segLength: 118, curviness: 0.5, verticality: 0.34, baseAltitude: 58, corridor: 68, gateRadius: 12,
    speedScale: 1, gravity: 6, drag: 0.88, gems: 90, obstacles: 22, movers: 6, turrets: 0, enemies: 0, windZones: 0, empZones: 0,
    parTime: 80, timeLimit: 170, reward: 120, brief: "Low pass along the glass towers above the freeway. Learning route, wide gates.",
    music: { root: 110, scale: MAJOR, bpm: 118, wave: "triangle", padWave: "sine", mood: 0.35 } },
  { id: 1, name: "Red Rock Canyon", subtitle: "Canyon · Sedimentary Cliffs", biome: "canyon", seed: 22881,
    fog: 0xd6ae83, fogDensity: 0.0038, skyTop: 0x467fb5, skyBottom: 0xf2d6a8, sun: 0xfff2d6, sunIntensity: 1.85, ambient: 0xc0a483, ambientIntensity: 0.8,
    accent: 0xe8631f, accent2: 0xfbf7ee, gem: 0xffcf5a, groundTex: "strata", water: false, ceiling: false, night: false,
    segments: 24, segLength: 124, curviness: 0.95, verticality: 0.28, baseAltitude: 26, corridor: 50, gateRadius: 11,
    speedScale: 1.04, gravity: 7.4, drag: 0.88, gems: 95, obstacles: 28, movers: 6, turrets: 0, enemies: 2, windZones: 2, empZones: 0,
    parTime: 88, timeLimit: 185, reward: 145, brief: "Tight banked racing below the canyon rim. Afternoon thermals shove you into the rock.",
    music: { root: 98, scale: AEOLIAN, bpm: 112, wave: "triangle", padWave: "sine", mood: 0.3 } },
  { id: 2, name: "Alpine Pass", subtitle: "Mountains · Snow Line", biome: "alpine", seed: 33714,
    fog: 0xdde9f3, fogDensity: 0.0043, skyTop: 0x2f6fb5, skyBottom: 0xdceaf5, sun: 0xffffff, sunIntensity: 1.95, ambient: 0xcfe0ee, ambientIntensity: 0.95,
    accent: 0xd93b2b, accent2: 0xffffff, gem: 0xffd766, groundTex: "snow", water: false, ceiling: false, night: false,
    segments: 24, segLength: 126, curviness: 0.68, verticality: 0.78, baseAltitude: 72, corridor: 56, gateRadius: 11,
    speedScale: 1.06, gravity: 6.6, drag: 0.86, gems: 92, obstacles: 24, movers: 8, turrets: 0, enemies: 3, windZones: 4, empZones: 0,
    parTime: 90, timeLimit: 190, reward: 165, brief: "Climb the snow line between cable-car pylons. Rotor icing costs you lift up high.",
    music: { root: 130.8, scale: LYDIAN, bpm: 104, wave: "sine", padWave: "sine", mood: 0.2 } },
  { id: 3, name: "Cedar Valley", subtitle: "Forest · River Gorge", biome: "forest", seed: 44092,
    fog: 0xa9c4a0, fogDensity: 0.005, skyTop: 0x3d78b4, skyBottom: 0xcfe3d2, sun: 0xfff6e2, sunIntensity: 1.55, ambient: 0x9dbb96, ambientIntensity: 0.9,
    accent: 0x1f7a3d, accent2: 0xf6f2e6, gem: 0xffd166, groundTex: "grass", water: true, ceiling: false, night: false,
    segments: 25, segLength: 112, curviness: 1.15, verticality: 0.4, baseAltitude: 24, corridor: 42, gateRadius: 10,
    speedScale: 1.02, gravity: 7.6, drag: 0.86, gems: 100, obstacles: 40, movers: 10, turrets: 4, enemies: 3, windZones: 0, empZones: 0,
    parTime: 96, timeLimit: 200, reward: 185, brief: "Weave through cedar crowns and under the old rail bridge. Watch the river gorge.",
    music: { root: 87.3, scale: DORIAN, bpm: 100, wave: "triangle", padWave: "sine", mood: 0.25 } },
  { id: 4, name: "Ironworks District", subtitle: "Industry · Works & Rail Yard", biome: "factory", seed: 55231,
    fog: 0x9aa5ae, fogDensity: 0.0052, skyTop: 0x5a6b7d, skyBottom: 0xc3ccd2, sun: 0xffe6c0, sunIntensity: 1.45, ambient: 0xa8b2b8, ambientIntensity: 0.95,
    accent: 0xff7a1a, accent2: 0xf2efe4, gem: 0xffc247, groundTex: "asphalt", water: false, ceiling: false, night: false,
    segments: 26, segLength: 104, curviness: 0.82, verticality: 0.48, baseAltitude: 20, corridor: 36, gateRadius: 9.5,
    speedScale: 1.05, gravity: 8, drag: 0.84, gems: 96, obstacles: 46, movers: 18, turrets: 6, enemies: 2, windZones: 0, empZones: 2,
    parTime: 100, timeLimit: 205, reward: 210, brief: "Brick sheds, chimneys and gantry cranes. Swing loads and live cabling everywhere.",
    music: { root: 82.4, scale: AEOLIAN, bpm: 126, wave: "sawtooth", padWave: "sine", mood: 0.55 } },
  { id: 5, name: "Container Harbor", subtitle: "Port · Cranes & Docks", biome: "harbor", seed: 66158,
    fog: 0xbfd3e0, fogDensity: 0.0042, skyTop: 0x3f79b0, skyBottom: 0xe6eef3, sun: 0xfff2dc, sunIntensity: 1.6, ambient: 0xbcd0de, ambientIntensity: 0.95,
    accent: 0xe23b2f, accent2: 0xffffff, gem: 0xffce55, groundTex: "concrete", water: true, ceiling: false, night: false,
    segments: 26, segLength: 138, curviness: 0.95, verticality: 0.7, baseAltitude: 30, corridor: 54, gateRadius: 11,
    speedScale: 1.12, gravity: 7, drag: 0.9, gems: 104, obstacles: 38, movers: 16, turrets: 6, enemies: 5, windZones: 3, empZones: 0,
    parTime: 104, timeLimit: 210, reward: 240, brief: "Fly the container stacks between moving gantry cranes, then out over the channel.",
    music: { root: 65.4, scale: PENTA, bpm: 118, wave: "square", padWave: "sine", mood: 0.5 } },
  { id: 6, name: "Cliffside Coast", subtitle: "Sea Cliffs · Lighthouse", biome: "coast", seed: 77345,
    fog: 0xc6dbe8, fogDensity: 0.0044, skyTop: 0x3673b0, skyBottom: 0xe9f1f6, sun: 0xfff0d4, sunIntensity: 1.65, ambient: 0xc3d6e2, ambientIntensity: 1,
    accent: 0xc62828, accent2: 0xfbfbf6, gem: 0xffd264, groundTex: "grass", water: true, ceiling: false, night: false,
    segments: 26, segLength: 110, curviness: 1.05, verticality: 0.6, baseAltitude: 34, corridor: 40, gateRadius: 10,
    speedScale: 1.06, gravity: 7.6, drag: 0.88, gems: 98, obstacles: 42, movers: 14, turrets: 5, enemies: 4, windZones: 5, empZones: 0,
    parTime: 106, timeLimit: 212, reward: 260, brief: "Sea spray and cliff thermals. Round the headland past the lighthouse keepers' cottages.",
    music: { root: 73.4, scale: MAJOR, bpm: 96, wave: "triangle", padWave: "sine", mood: 0.25 } },
  { id: 7, name: "Route 66 Basin", subtitle: "Desert · Interstate & Mesas", biome: "desert", seed: 88463,
    fog: 0xdcc49a, fogDensity: 0.0032, skyTop: 0x4a86bd, skyBottom: 0xecd9b0, sun: 0xffffff, sunIntensity: 1.9, ambient: 0xd8c8a8, ambientIntensity: 0.95,
    accent: 0xf0a41c, accent2: 0xffffff, gem: 0xffc23c, groundTex: "sand", water: false, ceiling: false, night: false,
    segments: 27, segLength: 120, curviness: 0.88, verticality: 0.55, baseAltitude: 30, corridor: 48, gateRadius: 10,
    speedScale: 1.1, gravity: 8, drag: 0.86, gems: 102, obstacles: 40, movers: 18, turrets: 8, enemies: 5, windZones: 4, empZones: 0,
    parTime: 108, timeLimit: 215, reward: 285, brief: "Heat shimmer off the tarmac, mesas and semi-trucks. Dust devils will push you sideways.",
    music: { root: 77.8, scale: PENTA, bpm: 132, wave: "square", padWave: "sine", mood: 0.6 } },
  { id: 8, name: "Thunder Fields", subtitle: "Farmland · Storm Front", biome: "farmland", seed: 99571,
    fog: 0x8d97a3, fogDensity: 0.006, skyTop: 0x47505d, skyBottom: 0xa3adb8, sun: 0xcad6e2, sunIntensity: 0.75, ambient: 0x8b95a2, ambientIntensity: 0.95,
    accent: 0xe03e2f, accent2: 0xf4f4ee, gem: 0xffd45e, groundTex: "grass", water: false, ceiling: false, night: false,
    segments: 27, segLength: 132, curviness: 1, verticality: 0.95, baseAltitude: 86, corridor: 52, gateRadius: 10,
    speedScale: 1.12, gravity: 7, drag: 0.87, gems: 100, obstacles: 34, movers: 22, turrets: 6, enemies: 6, windZones: 8, empZones: 2,
    parTime: 112, timeLimit: 220, reward: 310, brief: "Squall line over the wind farm — eight shear zones between the turbine blades.",
    music: { root: 92.5, scale: AEOLIAN, bpm: 124, wave: "sawtooth", padWave: "triangle", mood: 0.65 } },
  { id: 9, name: "Glacier Bay", subtitle: "Fjord · Fishing Village", biome: "glacier", seed: 101893,
    fog: 0xd6e7f4, fogDensity: 0.0048, skyTop: 0x3c74ad, skyBottom: 0xe4f0f8, sun: 0xffffff, sunIntensity: 1.75, ambient: 0xd4e6f4, ambientIntensity: 1,
    accent: 0x1b6f9c, accent2: 0xffffff, gem: 0xffd76e, groundTex: "snow", water: true, ceiling: false, night: false,
    segments: 28, segLength: 112, curviness: 1.2, verticality: 0.8, baseAltitude: 34, corridor: 38, gateRadius: 9,
    speedScale: 1.14, gravity: 6.4, drag: 0.89, gems: 106, obstacles: 48, movers: 22, turrets: 8, enemies: 6, windZones: 5, empZones: 2,
    parTime: 114, timeLimit: 225, reward: 340, brief: "Blue ice towers, wooden jetties and fishing boats. Cold air means thin lift reserves.",
    music: { root: 69.3, scale: LYDIAN, bpm: 104, wave: "sine", padWave: "sine", mood: 0.2 } },
  { id: 10, name: "Ashfall Summit", subtitle: "Volcano · Lava Fields", biome: "volcano", seed: 112047,
    fog: 0x8f8177, fogDensity: 0.0046, skyTop: 0x5b5a63, skyBottom: 0xb2a396, sun: 0xffd0a0, sunIntensity: 1.3, ambient: 0x8f8378, ambientIntensity: 1,
    accent: 0xe1481f, accent2: 0xffe7c2, gem: 0xffbf3a, groundTex: "rock", water: false, ceiling: false, night: false,
    segments: 28, segLength: 114, curviness: 1.18, verticality: 0.68, baseAltitude: 28, corridor: 38, gateRadius: 9,
    speedScale: 1.16, gravity: 8, drag: 0.85, gems: 108, obstacles: 52, movers: 22, turrets: 12, enemies: 7, windZones: 5, empZones: 3,
    parTime: 118, timeLimit: 230, reward: 375, brief: "Ash haze, lava channels and research masts. Ridge lift is strong — use it.",
    music: { root: 61.7, scale: AEOLIAN, bpm: 130, wave: "sawtooth", padWave: "triangle", mood: 0.75 } },
  { id: 11, name: "Midnight Metropolis", subtitle: "City Centre · After Dark", biome: "nightcity", seed: 123771,
    fog: 0x1b2739, fogDensity: 0.005, skyTop: 0x080f1c, skyBottom: 0x2e3d54, sun: 0x93b3d8, sunIntensity: 0.4, ambient: 0x40506a, ambientIntensity: 0.85,
    accent: 0xffb347, accent2: 0xdce8f5, gem: 0xffd06a, groundTex: "asphalt", water: false, ceiling: false, night: true,
    segments: 30, segLength: 116, curviness: 1.28, verticality: 1.05, baseAltitude: 38, corridor: 34, gateRadius: 8.5,
    speedScale: 1.2, gravity: 6, drag: 0.91, gems: 120, obstacles: 56, movers: 28, turrets: 14, enemies: 9, windZones: 4, empZones: 3,
    parTime: 122, timeLimit: 240, reward: 500, brief: "Everything at once: lit windows, street lights, cranes and security turrets. Flat out.",
    music: { root: 55, scale: MINOR, bpm: 146, wave: "sawtooth", padWave: "triangle", mood: 0.85 } },
];

// Par / limit derived from track length so pacing stays honest.
export const estimateTrackLength = (l) => l.segments * l.segLength * 1.07;
export const parFor = (l) => Math.round((estimateTrackLength(l) / (64 * l.speedScale)) * 1.5 + l.gems * 0.05);
export const limitFor = (l) => Math.round(parFor(l) * 2.15);
LEVELS.forEach((l) => {
  l.parTime = parFor(l);
  l.timeLimit = limitFor(l);
});

export const BIOME_ICON = {
  downtown: "🏙️", canyon: "🏜️", alpine: "🏔️", forest: "🌲", factory: "🏭", harbor: "🚢",
  coast: "🌊", desert: "🛣️", farmland: "🚜", glacier: "🧊", volcano: "🌋", nightcity: "🌆",
};
