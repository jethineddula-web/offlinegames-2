// Sky dome (gradient + sun + procedural clouds + stars), sun/hemi lights,
// image-based lighting and time-of-day presets.
import * as THREE from 'three';

export const TIMES = {
  sunset: {
    label: 'Golden Hour',
    sunEl: 8, sunAz: 238, sunColor: [1.0, 0.62, 0.36], sunI: 3.4,
    hemiSky: [0.55, 0.62, 0.9], hemiGround: [0.45, 0.32, 0.25], hemiI: 1.0,
    top: [0.08, 0.2, 0.52], hor: [1.0, 0.56, 0.3], bottom: [0.3, 0.24, 0.22],
    fog: [0.8, 0.55, 0.4], fogD: 0.00095,
    windows: 0.55, lamps: 0.6, stars: 0, cloud: 0.85, exposure: 1.0, sunDisc: 1,
  },
  day: {
    label: 'Midday',
    sunEl: 52, sunAz: 200, sunColor: [1.0, 0.95, 0.88], sunI: 3.6,
    hemiSky: [0.62, 0.74, 1.0], hemiGround: [0.42, 0.38, 0.34], hemiI: 1.25,
    top: [0.1, 0.3, 0.8], hor: [0.62, 0.76, 0.93], bottom: [0.45, 0.5, 0.56],
    fog: [0.62, 0.72, 0.86], fogD: 0.0007,
    windows: 0.08, lamps: 0, stars: 0, cloud: 0.7, exposure: 0.95, sunDisc: 1,
  },
  night: {
    label: 'Night',
    sunEl: 38, sunAz: 140, sunColor: [0.55, 0.65, 1.0], sunI: 0.45,
    hemiSky: [0.3, 0.38, 0.62], hemiGround: [0.2, 0.16, 0.14], hemiI: 0.45,
    top: [0.006, 0.012, 0.035], hor: [0.09, 0.08, 0.13], bottom: [0.04, 0.035, 0.05],
    fog: [0.07, 0.07, 0.11], fogD: 0.0016,
    windows: 1.7, lamps: 1.6, stars: 1, cloud: 0.35, exposure: 1.15, sunDisc: 0.25,
  },
};

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const frag = /* glsl */ `
uniform vec3 uTop, uHor, uBottom, uSunDir, uSunColor;
uniform float uStars, uCloud, uTime, uSunDisc;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHor, uTop, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uBottom, smoothstep(0.0, -0.2, h));
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSunColor * (pow(sd, 6.0) * 0.35 + pow(sd, 2.0) * 0.12) * (1.0 - clamp(h, 0.0, 1.0) * 0.6);
  col += uSunColor * smoothstep(0.9993, 0.9997, sd) * 18.0 * uSunDisc;
  if (h > 0.0) {
    vec2 cp = d.xz / (h + 0.18) * 1.4 + vec2(uTime * 0.006, uTime * 0.002);
    float c = fbm(cp);
    c = smoothstep(0.48, 0.82, c) * uCloud * smoothstep(0.0, 0.18, h);
    vec3 lit = mix(uHor * 0.95 + uTop * 0.15, uSunColor * 1.2, pow(sd, 3.0) * 0.8 + 0.1);
    vec3 shadow = mix(uTop, uHor, 0.5) * 0.65;
    vec3 cc = mix(shadow, lit, smoothstep(0.3, 1.0, fbm(cp + 3.1)));
    col = mix(col, cc, c * 0.85);
  }
  if (uStars > 0.0 && h > 0.0) {
    vec3 sp = floor(d * 380.0);
    float s = hash3(sp);
    float tw = 0.6 + 0.4 * sin(uTime * 3.0 + s * 100.0);
    col += step(0.9975, s) * uStars * smoothstep(0.02, 0.35, h) * tw * vec3(0.9, 0.95, 1.0) * 1.5;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export class Sky {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.uniforms = {
      uTop: { value: new THREE.Vector3() },
      uHor: { value: new THREE.Vector3() },
      uBottom: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Vector3(1, 1, 1) },
      uStars: { value: 0 },
      uCloud: { value: 0.8 },
      uTime: { value: 0 },
      uSunDisc: { value: 1 },
    };
    this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(3200, 48, 24), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);

    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    const cam = this.sun.shadow.camera;
    cam.left = -110;
    cam.right = 110;
    cam.top = 110;
    cam.bottom = -110;
    cam.near = 10;
    cam.far = 1400;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(this.hemi);
    this.sunDir = new THREE.Vector3();
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.material));
    this.envRT = null;
    this.snapM = new THREE.Matrix4();
    this.snapInv = new THREE.Matrix4();
    this.tmp = new THREE.Vector3();
  }

  setShadowSize(size) {
    this.sun.castShadow = size > 0;
    if (size > 0) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
  }

  apply(name) {
    const p = TIMES[name] || TIMES.sunset;
    this.preset = p;
    const el = THREE.MathUtils.degToRad(p.sunEl);
    const az = THREE.MathUtils.degToRad(p.sunAz);
    this.sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
    const u = this.uniforms;
    u.uTop.value.fromArray(p.top);
    u.uHor.value.fromArray(p.hor);
    u.uBottom.value.fromArray(p.bottom);
    u.uSunDir.value.copy(this.sunDir);
    u.uSunColor.value.fromArray(p.sunColor);
    u.uStars.value = p.stars;
    u.uCloud.value = p.cloud;
    u.uSunDisc.value = p.sunDisc;
    this.sun.color.setRGB(...p.sunColor);
    this.sun.intensity = p.sunI;
    this.hemi.color.setRGB(...p.hemiSky);
    this.hemi.groundColor.setRGB(...p.hemiGround);
    this.hemi.intensity = p.hemiI;
    const fogCol = new THREE.Color().setRGB(...p.fog);
    if (!this.scene.fog) this.scene.fog = new THREE.FogExp2(fogCol, p.fogD);
    this.scene.fog.color.copy(fogCol);
    this.scene.fog.density = p.fogD;
    this.renderer.toneMappingExposure = p.exposure;
    // image-based lighting from the sky itself
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(this.envScene, 0.02, 0.1, 500);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = name === 'night' ? 0.6 : 0.85;
    return p;
  }

  update(dt, camPos, focus) {
    this.uniforms.uTime.value += dt;
    this.mesh.position.copy(camPos);
    // keep the shadow frustum centred on the action, snapped to texels to avoid shimmering
    const cam = this.sun.shadow.camera;
    const size = this.sun.shadow.mapSize.x || 2048;
    const texel = (cam.right - cam.left) / size;
    this.snapM.lookAt(this.tmp.set(0, 0, 0), this.sunDir, THREE.Object3D.DEFAULT_UP);
    this.snapInv.copy(this.snapM).invert();
    const c = this.tmp.copy(focus).applyMatrix4(this.snapInv);
    c.x = Math.round(c.x / texel) * texel;
    c.y = Math.round(c.y / texel) * texel;
    c.applyMatrix4(this.snapM);
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.sunDir, 600);
  }
}
