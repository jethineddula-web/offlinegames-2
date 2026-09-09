(function (global) {
  const ELEMENTS = {
    fire: { color: "#ff5a1f", sfx: "fire", label: "Flame" },
    ice: { color: "#7ecbff", sfx: "ice", label: "Frost" },
    lightning: { color: "#ffe566", sfx: "lightning", label: "Storm" },
    poison: { color: "#7dff6a", sfx: "poison", label: "Venom" },
    shadow: { color: "#a46bff", sfx: "dash", label: "Umbra" },
    wind: { color: "#b8fff0", sfx: "whoosh", label: "Gale" },
    earth: { color: "#d4a373", sfx: "earth", label: "Stone" },
    blood: { color: "#ff2d4a", sfx: "kickhit", label: "Crimson" },
    light: { color: "#ffe9a8", sfx: "special", label: "Radiant" },
    chaos: { color: "#ff4fd8", sfx: "special", label: "Void" },
  };

  function F(o) {
    const out = Object.assign(
      {
        sprite: "ronin",
        spriteDir: -1,
        hue: 0,
        sat: 1,
        bright: 1,
        scale: 1,
        ai: "mixed",
        arena: "dojo",
        chapter: "Street Shadows",
      },
      o,
    );
    if (o.spriteDir == null) out.spriteDir = out.sprite === "player" ? 1 : -1;
    return out;
  }

  const ROSTER = [
    F({ id: 1, name: "Scrap Kid", title: "Alley Rat", sprite: "assassin", hue: 18, sat: 0.85, scale: 1, hp: 88, atk: 7, spd: 1.18, def: 0.88, element: "wind", special: "Gale Cut", specialType: "dash", ai: "rusher", quote: "Dojo kids don't last a night out here.", arena: "rooftop", chapter: "Street Shadows" }),
    F({ id: 2, name: "Iron Knuckle", title: "Dock Brawler", sprite: "monk", hue: -18, sat: 0.7, bright: 0.92, scale: 1.08, hp: 120, atk: 10, spd: 0.86, def: 1.15, element: "earth", special: "Anchor Blow", specialType: "slam", ai: "rusher", quote: "I break boards. Then I break people.", arena: "rooftop", chapter: "Street Shadows" }),
    F({ id: 3, name: "Red Sash", title: "Fallen Disciple", sprite: "ronin", hue: 0, sat: 1.15, hp: 100, atk: 11, spd: 1.02, def: 1, element: "fire", special: "Crimson Arc", specialType: "whirlwind", ai: "mixed", quote: "The sash remembers every oath I broke.", arena: "dojo", chapter: "Street Shadows" }),
    F({ id: 4, name: "Night Needle", title: "Roof Stitcher", sprite: "assassin", hue: 210, sat: 1.2, hp: 86, atk: 12, spd: 1.22, def: 0.84, element: "poison", special: "Needle Storm", specialType: "barrage", ai: "zoner", quote: "One cut. Then the fever does the rest.", arena: "rooftop", chapter: "Street Shadows" }),
    F({ id: 5, name: "Brick Jaw", title: "Pit Champion", sprite: "monk", hue: 28, sat: 0.9, scale: 1.12, hp: 135, atk: 9, spd: 0.8, def: 1.25, element: "earth", special: "Guard Breaker", specialType: "armor", ai: "counter", quote: "Hit me first. I insist.", arena: "dojo", chapter: "Street Shadows" }),
    F({ id: 6, name: "Silk Fang", title: "Lotus Thief", sprite: "assassin", hue: 300, sat: 1.25, hp: 92, atk: 11, spd: 1.2, def: 0.9, element: "wind", special: "Silk Lash", specialType: "pull", ai: "rusher", quote: "Pretty things cut the deepest.", arena: "rooftop", chapter: "Street Shadows" }),
    F({ id: 7, name: "Ember Palm", title: "Kiln Monk", sprite: "monk", hue: -8, sat: 1.35, bright: 1.08, hp: 108, atk: 12, spd: 0.98, def: 1.02, element: "fire", special: "Kiln Breath", specialType: "burn", ai: "mixed", quote: "My hands remember the furnace.", arena: "dojo", chapter: "Street Shadows" }),
    F({ id: 8, name: "Glass Blade", title: "Mirror Ronin", sprite: "ronin", hue: 180, sat: 0.4, bright: 1.2, hp: 96, atk: 13, spd: 1.1, def: 0.92, element: "light", special: "Shatter Step", specialType: "clone", ai: "zoner", quote: "You will fight your own reflection.", arena: "dojo", chapter: "Street Shadows" }),
    F({ id: 9, name: "Crow Sister", title: "Grave Messenger", sprite: "assassin", hue: 260, sat: 0.8, bright: 0.88, hp: 98, atk: 12, spd: 1.16, def: 0.95, element: "shadow", special: "Black Wing", specialType: "shadowStep", ai: "mixed", quote: "Crows already know your name.", arena: "rooftop", chapter: "Street Shadows" }),
    F({ id: 10, name: "Dojo Warden", title: "First Gate", sprite: "ronin", hue: 12, sat: 1.05, scale: 1.08, hp: 150, atk: 14, spd: 1.0, def: 1.12, element: "earth", special: "Gate Crash", specialType: "slam", ai: "boss", quote: "None pass the first gate unbroken.", arena: "dojo", chapter: "Street Shadows" }),

    F({ id: 11, name: "Prayer Fist", title: "Dawn Acolyte", sprite: "monk", hue: 40, sat: 1.1, hp: 112, atk: 12, spd: 1.0, def: 1.05, element: "light", special: "Sun Palm", specialType: "barrage", ai: "mixed", quote: "Every strike is a sutra.", arena: "temple", chapter: "Frozen Temple" }),
    F({ id: 12, name: "Ice Nun", title: "Silent Cloister", sprite: "assassin", hue: 195, sat: 0.7, bright: 1.15, hp: 104, atk: 13, spd: 1.12, def: 0.98, element: "ice", special: "Vesper Freeze", specialType: "freeze", ai: "counter", quote: "Warmth is a sin I already paid for.", arena: "temple", chapter: "Frozen Temple" }),
    F({ id: 13, name: "Staff of Dawn", title: "Bell Keeper", sprite: "monk", hue: 50, sat: 1.2, hp: 118, atk: 13, spd: 0.94, def: 1.08, element: "light", special: "Bell Shock", specialType: "quake", ai: "zoner", quote: "The mountain hears this staff.", arena: "temple", chapter: "Frozen Temple" }),
    F({ id: 14, name: "Silent Vow", title: "Mute Blade", sprite: "assassin", hue: 230, sat: 0.55, bright: 0.9, hp: 100, atk: 14, spd: 1.18, def: 0.9, element: "shadow", special: "Unspoken Cut", specialType: "dash", ai: "rusher", quote: "…", arena: "temple", chapter: "Frozen Temple" }),
    F({ id: 15, name: "Thunder Acolyte", title: "Sky Disciple", sprite: "monk", hue: 55, sat: 1.4, bright: 1.1, hp: 110, atk: 14, spd: 1.08, def: 0.96, element: "lightning", special: "Prayer Bolt", specialType: "lightning", ai: "mixed", quote: "The clouds took my teacher. I took their voice.", arena: "temple", chapter: "Frozen Temple" }),
    F({ id: 16, name: "Lotus Kick", title: "Petal Saint", sprite: "assassin", hue: 320, sat: 1.1, hp: 102, atk: 13, spd: 1.2, def: 0.92, element: "wind", special: "Blooming Wheel", specialType: "whirlwind", ai: "rusher", quote: "Beautiful. Fatal. Same word.", arena: "temple", chapter: "Frozen Temple" }),
    F({ id: 17, name: "Bone Chanter", title: "Ossuary Ronin", sprite: "ronin", hue: 90, sat: 0.45, bright: 0.95, hp: 122, atk: 13, spd: 0.92, def: 1.1, element: "poison", special: "Marrow Hymn", specialType: "poison", ai: "zoner", quote: "I sing with the ones you buried.", arena: "temple", chapter: "Frozen Temple" }),
    F({ id: 18, name: "Frost Abbot", title: "White Peak", sprite: "monk", hue: 190, sat: 0.6, bright: 1.2, scale: 1.1, hp: 140, atk: 12, spd: 0.88, def: 1.2, element: "ice", special: "Glacier Palm", specialType: "freeze", ai: "counter", quote: "Stillness is the oldest weapon.", arena: "temple", chapter: "Frozen Temple" }),
    F({ id: 19, name: "Dual Prayer", title: "Twin Sutra", sprite: "assassin", hue: 45, sat: 1.05, hp: 108, atk: 15, spd: 1.14, def: 0.94, element: "light", special: "Twin Mantra", specialType: "clone", ai: "mixed", quote: "Two vows. One grave.", arena: "temple", chapter: "Frozen Temple" }),
    F({ id: 20, name: "Temple Master", title: "Second Gate", sprite: "monk", hue: 200, sat: 0.85, scale: 1.12, hp: 175, atk: 16, spd: 1.02, def: 1.18, element: "ice", special: "Avalanche Kata", specialType: "quake", ai: "boss", quote: "Bow, or freeze standing.", arena: "temple", chapter: "Frozen Temple" }),

    F({ id: 21, name: "Neon Jack", title: "Wire Ghost", sprite: "player", hue: 160, sat: 1.4, hp: 118, atk: 14, spd: 1.12, def: 1.0, element: "lightning", special: "Grid Burn", specialType: "lightning", ai: "rusher", quote: "The city taught me dirty math.", arena: "rooftop", chapter: "Neon Rain" }),
    F({ id: 22, name: "Voltage", title: "Live Wire", sprite: "assassin", hue: 50, sat: 1.5, bright: 1.12, hp: 110, atk: 15, spd: 1.22, def: 0.9, element: "lightning", special: "Arc Needle", specialType: "fireball", ai: "zoner", quote: "Don't touch. I'm always on.", arena: "rooftop", chapter: "Neon Rain" }),
    F({ id: 23, name: "Chrome Dancer", title: "Rainline", sprite: "assassin", hue: 180, sat: 0.3, bright: 1.25, hp: 112, atk: 14, spd: 1.24, def: 0.92, element: "wind", special: "Mirror Waltz", specialType: "clone", ai: "mixed", quote: "Keep up or get cut on the beat.", arena: "rooftop", chapter: "Neon Rain" }),
    F({ id: 24, name: "Smoke Dealer", title: "Back-Alley Alchemist", sprite: "ronin", hue: 120, sat: 0.7, bright: 0.85, hp: 128, atk: 13, spd: 0.96, def: 1.08, element: "poison", special: "Black Vapor", specialType: "poison", ai: "zoner", quote: "Breathe in. That's the lesson.", arena: "rooftop", chapter: "Neon Rain" }),
    F({ id: 25, name: "Razor Rain", title: "Gutter Saint", sprite: "assassin", hue: 0, sat: 0.2, bright: 1.1, hp: 108, atk: 16, spd: 1.2, def: 0.88, element: "wind", special: "Thousand Cuts", specialType: "barrage", ai: "rusher", quote: "The rain already chose a side.", arena: "rooftop", chapter: "Neon Rain" }),
    F({ id: 26, name: "Pulse", title: "Club Monk", sprite: "monk", hue: 280, sat: 1.3, hp: 124, atk: 14, spd: 1.06, def: 1.04, element: "lightning", special: "Bass Drop", specialType: "quake", ai: "mixed", quote: "Feel that? That's your ribs keeping time.", arena: "rooftop", chapter: "Neon Rain" }),
    F({ id: 27, name: "Blackout", title: "Grid Killer", sprite: "assassin", hue: 250, sat: 0.5, bright: 0.72, hp: 116, atk: 15, spd: 1.16, def: 0.96, element: "shadow", special: "Kill the Lights", specialType: "shadowStep", ai: "counter", quote: "When the neon dies, I begin.", arena: "rooftop", chapter: "Neon Rain" }),
    F({ id: 28, name: "Circuit", title: "Borrowed Face", sprite: "player", hue: 190, sat: 1.2, bright: 1.05, hp: 120, atk: 15, spd: 1.1, def: 1.02, element: "lightning", special: "Feedback Loop", specialType: "drain", ai: "mixed", quote: "I learned your stance from a screen.", arena: "rooftop", chapter: "Neon Rain" }),
    F({ id: 29, name: "Echo", title: "Last Broadcast", sprite: "assassin", hue: 170, sat: 0.9, hp: 114, atk: 16, spd: 1.18, def: 0.94, element: "wind", special: "Reverb Cut", specialType: "clone", ai: "zoner", quote: "Every scream comes back louder.", arena: "rooftop", chapter: "Neon Rain" }),
    F({ id: 30, name: "Skyline King", title: "Third Gate", sprite: "ronin", hue: 200, sat: 1.15, scale: 1.1, hp: 190, atk: 17, spd: 1.08, def: 1.14, element: "lightning", special: "Crown of Wires", specialType: "lightning", ai: "boss", quote: "The city kneels. You will too.", arena: "rooftop", chapter: "Neon Rain" }),

    F({ id: 31, name: "Cinder", title: "Ash Walker", sprite: "monk", hue: -20, sat: 1.3, bright: 0.95, hp: 130, atk: 15, spd: 1.0, def: 1.06, element: "fire", special: "Coal Spit", specialType: "fireball", ai: "mixed", quote: "I was a village. Now I am weather.", arena: "volcano", chapter: "Inferno Path" }),
    F({ id: 32, name: "Magma Fist", title: "Crater Boxer", sprite: "monk", hue: -5, sat: 1.45, scale: 1.14, hp: 155, atk: 17, spd: 0.84, def: 1.18, element: "fire", special: "Eruption Hook", specialType: "slam", ai: "rusher", quote: "My gloves cooled. My temper didn't.", arena: "volcano", chapter: "Inferno Path" }),
    F({ id: 33, name: "Ash Witch", title: "Soot Prophet", sprite: "assassin", hue: 10, sat: 0.7, bright: 0.8, hp: 118, atk: 16, spd: 1.14, def: 0.96, element: "fire", special: "Cinder Veil", specialType: "burn", ai: "zoner", quote: "Read the smoke. It already named you.", arena: "volcano", chapter: "Inferno Path" }),
    F({ id: 34, name: "Slag", title: "Furnace Knight", sprite: "ronin", hue: 20, sat: 0.6, bright: 0.78, scale: 1.1, hp: 160, atk: 16, spd: 0.86, def: 1.22, element: "earth", special: "Molten Guard", specialType: "armor", ai: "counter", quote: "Armor is just lava that learned patience.", arena: "volcano", chapter: "Inferno Path" }),
    F({ id: 35, name: "Pyre", title: "Offering", sprite: "monk", hue: 8, sat: 1.5, bright: 1.1, hp: 126, atk: 17, spd: 1.04, def: 1.0, element: "fire", special: "Funeral Wheel", specialType: "whirlwind", ai: "rusher", quote: "I am the last light of a dead rite.", arena: "volcano", chapter: "Inferno Path" }),
    F({ id: 36, name: "Scorch", title: "Your Shadow, Burning", sprite: "player", hue: -12, sat: 1.5, bright: 1.08, hp: 132, atk: 17, spd: 1.1, def: 1.02, element: "fire", special: "Mirror Blaze", specialType: "burn", ai: "mixed", quote: "I fight like you. I hate like the sun.", arena: "volcano", chapter: "Inferno Path" }),
    F({ id: 37, name: "Obsidian", title: "Glass Titan", sprite: "ronin", hue: 240, sat: 0.25, bright: 0.7, scale: 1.16, hp: 170, atk: 16, spd: 0.82, def: 1.28, element: "earth", special: "Black Glass", specialType: "armor", ai: "counter", quote: "Break me and you bleed.", arena: "volcano", chapter: "Inferno Path" }),
    F({ id: 38, name: "Lava Saint", title: "Pilgrim of Heat", sprite: "monk", hue: 15, sat: 1.2, hp: 148, atk: 16, spd: 0.96, def: 1.12, element: "fire", special: "Baptism", specialType: "drain", ai: "zoner", quote: "Pain is a hymn. Sing louder.", arena: "volcano", chapter: "Inferno Path" }),
    F({ id: 39, name: "Emberlord", title: "Crown of Cinders", sprite: "ronin", hue: 5, sat: 1.35, scale: 1.1, hp: 158, atk: 18, spd: 1.02, def: 1.1, element: "fire", special: "Throne Fire", specialType: "meteor", ai: "mixed", quote: "Kneel in the ash of better men.", arena: "volcano", chapter: "Inferno Path" }),
    F({ id: 40, name: "Volcano Tyrant", title: "Fourth Gate", sprite: "monk", hue: -15, sat: 1.4, scale: 1.18, hp: 210, atk: 19, spd: 0.98, def: 1.2, element: "fire", special: "Caldera", specialType: "meteor", ai: "boss", quote: "The mountain hungers. I feed it fighters.", arena: "volcano", chapter: "Inferno Path" }),

    F({ id: 41, name: "Pale Herald", title: "Court Whisper", sprite: "assassin", hue: 270, sat: 0.4, bright: 1.2, hp: 140, atk: 17, spd: 1.16, def: 1.0, element: "shadow", special: "Edict", specialType: "shadowStep", ai: "zoner", quote: "The throne already wrote your ending.", arena: "throne", chapter: "Umbra Court" }),
    F({ id: 42, name: "Chain Wraith", title: "Dungeon Law", sprite: "ronin", hue: 220, sat: 0.5, bright: 0.82, scale: 1.08, hp: 165, atk: 17, spd: 0.9, def: 1.16, element: "shadow", special: "Binding Chain", specialType: "pull", ai: "counter", quote: "Run. The chain likes the chase.", arena: "throne", chapter: "Umbra Court" }),
    F({ id: 43, name: "Gold Mask", title: "False King", sprite: "player", hue: 38, sat: 1.4, bright: 1.12, hp: 150, atk: 18, spd: 1.08, def: 1.08, element: "light", special: "Gilded Lie", specialType: "clone", ai: "mixed", quote: "A mask is just a better face.", arena: "throne", chapter: "Umbra Court" }),
    F({ id: 44, name: "Void Dancer", title: "Unmade", sprite: "assassin", hue: 290, sat: 1.2, bright: 0.9, hp: 138, atk: 19, spd: 1.24, def: 0.92, element: "chaos", special: "Unravel", specialType: "whirlwind", ai: "rusher", quote: "Steps that shouldn't exist still land.", arena: "throne", chapter: "Umbra Court" }),
    F({ id: 45, name: "Blood Vizier", title: "Tax of Veins", sprite: "monk", hue: -25, sat: 1.2, bright: 0.88, hp: 168, atk: 18, spd: 0.94, def: 1.14, element: "blood", special: "Tithe", specialType: "drain", ai: "zoner", quote: "Your pulse is already court property.", arena: "throne", chapter: "Umbra Court" }),
    F({ id: 46, name: "Night General", title: "Black Banner", sprite: "ronin", hue: 250, sat: 0.7, scale: 1.12, hp: 180, atk: 19, spd: 1.0, def: 1.18, element: "shadow", special: "War Eclipse", specialType: "slam", ai: "boss", quote: "I buried armies for a quieter throne.", arena: "throne", chapter: "Umbra Court" }),
    F({ id: 47, name: "Mirror Twin", title: "The Other You", sprite: "player", hue: 0, sat: 0.2, bright: 0.75, hp: 160, atk: 18, spd: 1.12, def: 1.1, element: "chaos", special: "Stolen Kata", specialType: "clone", ai: "mixed", quote: "I kept every mistake you made.", arena: "throne", chapter: "Umbra Court" }),
    F({ id: 48, name: "Eclipse", title: "Sun Eater", sprite: "assassin", hue: 240, sat: 0.35, bright: 0.65, hp: 155, atk: 20, spd: 1.18, def: 1.02, element: "shadow", special: "Total Dark", specialType: "shadowStep", ai: "rusher", quote: "Light is a guest. I am the house.", arena: "throne", chapter: "Umbra Court" }),
    F({ id: 49, name: "The Left Hand", title: "Emperor's Knife", sprite: "ronin", hue: -8, sat: 1.1, bright: 0.85, scale: 1.1, hp: 190, atk: 21, spd: 1.06, def: 1.16, element: "blood", special: "Regicide", specialType: "barrage", ai: "boss", quote: "If the throne bleeds, I held the blade.", arena: "throne", chapter: "Umbra Court" }),
    F({ id: 50, name: "Lord Umbra", title: "Last Gate", sprite: "ronin", hue: 270, sat: 0.85, bright: 0.7, scale: 1.22, hp: 240, atk: 23, spd: 1.1, def: 1.22, element: "chaos", special: "Nightfall", specialType: "meteor", ai: "boss", quote: "Fifty graves. One shadow. Yours is next.", arena: "throne", chapter: "Umbra Court" }),
  ];

  const SKILLS = [
    { id: "power", name: "Killing Intent", desc: "Each rank raises punch, kick, and special damage.", max: 8, cost: 70, kind: "stat" },
    { id: "vitality", name: "Iron Body", desc: "Each rank adds a thick slab of health.", max: 8, cost: 70, kind: "stat" },
    { id: "agility", name: "Wind Step", desc: "Move faster, jump a little higher.", max: 6, cost: 80, kind: "stat" },
    { id: "guard", name: "Iron Guard", desc: "Blocking soaks more damage and builds meter.", max: 5, cost: 90, kind: "stat" },
    { id: "uppercut", name: "Rising Fang", desc: "Unlock uppercut: hold Jump and Punch.", max: 1, cost: 180, kind: "move" },
    { id: "dash", name: "Shadow Dash", desc: "Double-tap Left/Right to dash through strikes.", max: 1, cost: 220, kind: "move" },
    { id: "firepalm", name: "Fire Palm", desc: "Your special ignites the opponent.", max: 1, cost: 260, kind: "move" },
    { id: "iceveil", name: "Ice Veil", desc: "A perfect block can freeze the attacker.", max: 1, cost: 260, kind: "move" },
    { id: "thunder", name: "Thunder Kick", desc: "Kicks can briefly stun.", max: 1, cost: 300, kind: "move" },
    { id: "meteor", name: "Umbra Super", desc: "Full meter + Special: meteor fist.", max: 1, cost: 420, kind: "move" },
  ];

  const TIPS = [
    "Block with S or the Block button. Chip still hurts.",
    "Punch-punch-kick is a true combo if the first hit lands.",
    "Specials cost meter. Land hits to fill the crimson bar.",
    "Jump over fireballs. Uppercut jumpers.",
    "Dashing through an attack is invulnerable for a blink.",
    "Every rival has a unique power. Watch the color of their aura.",
    "Spend Shadow Coins in Skills. Watch an offering if you run short.",
    "Bosses at levels 10, 20, 30, 40 and 50 hit like collapsing temples.",
    "Hold block against rushers. Punish zoners with a dash.",
    "Fall in a gate and you can watch an offering for a second life.",
  ];

  global.ELEMENTS = ELEMENTS;
  global.ROSTER = ROSTER;
  global.SKILLS = SKILLS;
  global.TIPS = TIPS;
})(window);
