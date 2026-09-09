(function (N) {
'use strict';

const STORAGE_KEY = 'numberly.progress.v1';
const DEFAULT_PROFILE = {
  gems: 25, currentLevel: 1, records: {}, highScores: [], muted: false, sound: true,
  music: false, haptics: true, mode: 'relaxed', playerName: 'You', rounds: 0,
};

const validNumber = (value, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

function loadProfile() {
  if (N.testMode) return { ...DEFAULT_PROFILE, records: {}, highScores: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE, records: {}, highScores: [] };
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') throw new Error('Invalid progress');
    const records = {};
    if (data.records && typeof data.records === 'object') {
      for (const [key, entry] of Object.entries(data.records)) {
        const record = entry;
        if (Number.isInteger(Number(key)) && validNumber(Number(key), 1, 200) && record &&
          validNumber(record.score) && validNumber(record.time) && validNumber(record.stars, 1, 3)) {
          records[Number(key)] = record;
        }
      }
    }
    const highScores = Array.isArray(data.highScores) ? data.highScores.filter((entry) =>
      entry && typeof entry.id === 'string' && typeof entry.name === 'string' &&
      validNumber(entry.level, 1, 200) && validNumber(entry.score) && validNumber(entry.time) &&
      (entry.mode === 'relaxed' || entry.mode === 'timed') && typeof entry.date === 'string',
    ).sort((a, b) => b.score - a.score).slice(0, 10) : [];
    return {
      gems: validNumber(data.gems) ? Math.floor(data.gems) : 25,
      currentLevel: validNumber(data.currentLevel, 1, 200) ? Math.floor(data.currentLevel) : 1,
      records, highScores,
      muted: typeof data.muted === 'boolean' ? data.muted : false,
      sound: typeof data.sound === 'boolean' ? data.sound : true,
      music: typeof data.music === 'boolean' ? data.music : false,
      haptics: typeof data.haptics === 'boolean' ? data.haptics : true,
      mode: data.mode === 'timed' ? 'timed' : 'relaxed',
      playerName: typeof data.playerName === 'string' ? data.playerName.slice(0, 16) || 'You' : 'You',
      rounds: validNumber(data.rounds) ? Math.floor(data.rounds) : 0,
    };
  } catch {
    return { ...DEFAULT_PROFILE, records: {}, highScores: [] };
  }
}

function saveProfile(profile) {
  if (N.testMode) return true;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

function levelLabel(id) { return id.toString().padStart(3, '0'); }

Object.assign(N, { DEFAULT_PROFILE, loadProfile, saveProfile, formatTime, levelLabel });
})(globalThis.Numberly = globalThis.Numberly || {});