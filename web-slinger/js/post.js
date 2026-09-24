// Post-processing: bloom + a cinematic pass (speed radial blur, chromatic
// aberration, vignette, damage tint, slow-mo desaturation, film grain).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSpeed: { value: 0 },
    uTime: { value: 0 },
    uHurt: { value: 0 },
    uSlow: { value: 0 },
    uSense: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uSpeed, uTime, uHurt, uSlow, uSense;
    varying vec2 vUv;
    void main(){
      vec2 c = vUv - 0.5;
      float r = length(c);
      float amt = uSpeed * 0.055 * smoothstep(0.12, 0.75, r);
      float ca = 0.0012 + uSpeed * 0.004 + uHurt * 0.006;
      vec3 col = vec3(0.0); float tw = 0.0;
      for (int i = 0; i < 8; i++) {
        float t = float(i) / 7.0;
        float w = 1.0 - t * 0.6;
        vec2 o = c * amt * t;
        col.r += texture2D(tDiffuse, vUv - o + c * ca).r * w;
        col.g += texture2D(tDiffuse, vUv - o).g * w;
        col.b += texture2D(tDiffuse, vUv - o - c * ca).b * w;
        tw += w;
      }
      col /= tw;
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(col, vec3(lum) * vec3(0.9, 0.95, 1.1), uSlow * 0.65);
      // spider-sense: cool tint pulse at the edges
      col += vec3(0.25, 0.35, 0.7) * uSense * smoothstep(0.35, 0.85, r) * 0.6;
      col *= 1.0 - smoothstep(0.42, 0.95, r) * 0.5;
      col = mix(col, vec3(0.5, 0.0, 0.02) * (0.5 + lum), uHurt * smoothstep(0.25, 0.8, r));
      float n = fract(sin(dot(vUv * vec2(1920.0, 1080.0) + uTime * 60.0, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * 0.012;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

export class Post {
  constructor(renderer, scene, camera, quality) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.build(quality);
  }

  build(q) {
    if (this.composer) this.composer.dispose();
    const size = this.renderer.getSize(new THREE.Vector2());
    const pr = this.renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: q.msaa });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(size.x, size.y);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = null;
    if (q.bloom) {
      this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.55, 0.6, 0.82);
      this.composer.addPass(this.bloom);
    }
    this.cine = new ShaderPass(CinematicShader);
    this.composer.addPass(this.cine);
    this.composer.addPass(new OutputPass());
  }

  setSize(w, h) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
  }

  render(dt, fx) {
    const u = this.cine.uniforms;
    u.uTime.value += dt;
    u.uSpeed.value = fx.speed;
    u.uHurt.value = fx.hurt;
    u.uSlow.value = fx.slow;
    u.uSense.value = fx.sense;
    this.composer.render(dt);
  }
}
