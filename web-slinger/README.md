# Web Slinger: Manhattan

A 3D open-world web-swinging superhero game built with HTML, CSS and JavaScript (Three.js, bundled in `lib/`, so no internet is needed).

## Run it

The game uses ES modules, so it has to be served over HTTP. Opening `index.html` straight from disk (`file://`) won't work.

- VS Code: right-click `index.html` → **Open with Live Server**
- Or from this folder: `python3 -m http.server 8000`, then open http://localhost:8000

## Features

- **Procedural Manhattan**: a 12×12-block street grid with 400+ skyscrapers. Buildings have setbacks, shopfronts, rooftop water towers, antennas with blinking beacons, a central park with trees and a pond, an art-deco landmark tower, a waterfront and a distant skyline.
- **Traversal**:
  - Web-swinging with pendulum physics and chained swings
  - Web zip
  - Point launch to rooftop ledges
  - Wall-running and wall-crawling around corners
  - Ledge vaults, dives and air tricks
- **Combat**:
  - Lunge-to-target combos; the 4th hit is a launcher, and you can juggle enemies in the air
  - Web shooter: 3 hits webs a thug up
  - Dodge, with a "perfect dodge" slow-mo when timed to the spider-sense warning
  - Focus meter for heals and finishers
- **Street crimes**: brawlers, gunners and brutes, with a police car on scene, a red crime beacon, an on-screen waypoint and minimap markers.
- **Visuals**:
  - ACES tone mapping, bloom and soft shadows
  - Sky-based reflections on glass and water
  - Procedural sky with clouds and stars
  - Speed blur and streaks, chromatic aberration, vignette and film grain
- **Time of day**: golden hour, midday or night. At night, window and street lights come on.
- **Living streets**: instanced traffic (taxis, sedans) and pedestrians.
- **Adaptive music and sound**: synthesized in real time, so there are no audio files.
- **Progression**: XP and levels, plus 30 hidden backpacks. Progress is saved in the browser.
- **Platforms**: keyboard + mouse on desktop, touch controls on phones and tablets. Four quality presets plus dynamic resolution.

## Controls

| Action | Keyboard / mouse |
| --- | --- |
| Move / crawl on walls | W A S D |
| Camera | Mouse (click to capture) |
| Sprint · web-swing (in air) · wall-run | Hold Shift or right mouse button |
| Jump · web zip (in air) · jump off wall/web | Space |
| Point launch to the marked ledge | E (hold Space to launch off it) |
| Dive | C / Ctrl |
| Air trick | R |
| Attack combo | Left mouse / J |
| Web shooter | F |
| Dodge | Q |
| Heal / finisher | H / V |
| Pause | Esc / P |

Fan-made game. Every model, texture, sound and piece of music is generated in code.
