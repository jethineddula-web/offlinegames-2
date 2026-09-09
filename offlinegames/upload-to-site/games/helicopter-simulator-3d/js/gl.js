/* ============================================================
   gl.js  —  Self-contained WebGL2 renderer
   Instanced, shadow-mapped, fogged, tone-mapped.
   Helicopter Simulator 3D  |  offlinegames.art
   ============================================================ */
'use strict';

const R = (function () {

  let gl = null, canvas = null;
  let W = 1, H = 1, dpr = 1;

  /* ------------------------------------------------------------------ */
  /*  SHADER SOURCES                                                     */
  /* ------------------------------------------------------------------ */

  const COMMON_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
layout(location=3) in vec4 aM0;
layout(location=4) in vec4 aM1;
layout(location=5) in vec4 aM2;
layout(location=6) in vec4 aM3;
layout(location=7) in vec4 aColor;
layout(location=8) in vec4 aParams;  // uvScale.x, uvScale.y, emissive, specular

uniform mat4 uViewProj;
uniform mat4 uLightVP;

out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;
out vec4 vColor;
out vec4 vParams;
out vec4 vShadowCoord;

void main(){
  mat4 model = mat4(aM0, aM1, aM2, aM3);
  vec4 wp = model * vec4(aPos, 1.0);
  vWorld = wp.xyz;

  vec3 s = vec3(dot(aM0.xyz,aM0.xyz), dot(aM1.xyz,aM1.xyz), dot(aM2.xyz,aM2.xyz));
  s = max(s, vec3(1e-6));
  mat3 nm = mat3(aM0.xyz / s.x, aM1.xyz / s.y, aM2.xyz / s.z);
  vNormal = normalize(nm * aNormal);

  vUv = aUv * aParams.xy;
  vColor = aColor;
  vParams = aParams;
  vShadowCoord = uLightVP * vec4(wp.xyz + vNormal * 0.06, 1.0);
  gl_Position = uViewProj * wp;
}`;

  const COMMON_FS = `#version 300 es
precision highp float;
precision highp sampler2DShadow;

in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
in vec4 vColor;
in vec4 vParams;
in vec4 vShadowCoord;

uniform sampler2D  uTex;
uniform sampler2DShadow uShadow;
uniform vec3  uCamPos;
uniform vec3  uSunDir;      // pointing FROM surface TO sun
uniform vec3  uSunColor;
uniform vec3  uAmbTop;
uniform vec3  uAmbBot;
uniform vec3  uFogColor;
uniform float uFogDensity;
uniform float uNight;       // 0 day .. 1 night (window glow)
uniform float uShadowTexel;
uniform float uUseTex;
uniform float uExposure;
uniform float uWorldUV;
uniform float uAlphaTex;

out vec4 fragColor;

float shadowPCF(vec4 sc){
  vec3 p = sc.xyz / sc.w;
  p = p * 0.5 + 0.5;
  if (p.z > 1.0 || p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) return 1.0;
  float b = uShadowTexel;
  float sum = 0.0;
  for (int y=-1; y<=1; y++){
    for (int x=-1; x<=1; x++){
      sum += texture(uShadow, vec3(p.xy + vec2(float(x), float(y)) * b, p.z - 0.0016));
    }
  }
  return sum / 9.0;
}

vec3 tonemap(vec3 c){
  c *= uExposure;
  // filmic ACES approximation
  const float a=2.51, b=0.03, cc=2.43, d=0.59, e=0.14;
  return clamp((c*(a*c+b))/(c*(cc*c+d)+e), 0.0, 1.0);
}

void main(){
  vec3 Nf = normalize(vNormal);
  vec2 uv = vUv;
  if (uWorldUV > 0.5){
    vec3 an = abs(Nf);
    vec2 wuv = (an.y > 0.5) ? vWorld.xz : ((an.x > 0.5) ? vec2(vWorld.z, vWorld.y) : vec2(vWorld.x, vWorld.y));
    uv = wuv * vParams.xy;
  }
  vec4 texel = uUseTex > 0.5 ? texture(uTex, uv) : vec4(1.0);
  vec3 albedo = texel.rgb * vColor.rgb;
  float windowMask = texel.a;

  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 L = normalize(uSunDir);

  float ndl = max(dot(N, L), 0.0);
  float sh = shadowPCF(vShadowCoord);
  vec3 direct = uSunColor * ndl * sh;

  // hemispheric ambient
  float hemi = N.y * 0.5 + 0.5;
  vec3 ambient = mix(uAmbBot, uAmbTop, hemi);

  // blinn-phong specular
  vec3 Hv = normalize(L + V);
  float spec = pow(max(dot(N, Hv), 0.0), 48.0) * vParams.w * sh;

  vec3 color = albedo * (direct + ambient) + uSunColor * spec;

  // emissive: constant term + lit windows at night
  color += albedo * vParams.z;
  color += texel.rgb * windowMask * uNight * 2.4 * (1.0 - uAlphaTex);

  // fresnel rim for a touch of realism on curved metal
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0) * 0.25 * vParams.w;
  color += uAmbTop * fres;

  // exponential squared distance fog
  float dist = length(uCamPos - vWorld);
  float f = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
  color = mix(color, uFogColor, clamp(f, 0.0, 1.0));

  float alpha = vColor.a * mix(1.0, texel.a, uAlphaTex);
  fragColor = vec4(tonemap(color), alpha);
}`;

  const DEPTH_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=3) in vec4 aM0;
layout(location=4) in vec4 aM1;
layout(location=5) in vec4 aM2;
layout(location=6) in vec4 aM3;
uniform mat4 uLightVP;
void main(){
  mat4 model = mat4(aM0,aM1,aM2,aM3);
  gl_Position = uLightVP * model * vec4(aPos,1.0);
}`;

  const DEPTH_FS = `#version 300 es
precision highp float;
void main(){}`;

  const SKY_VS = `#version 300 es
precision highp float;
out vec2 vNdc;
void main(){
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vNdc = p * 2.0 - 1.0;
  gl_Position = vec4(vNdc, 1.0, 1.0);
}`;

  const SKY_FS = `#version 300 es
precision highp float;
in vec2 vNdc;
uniform mat4 uInvViewProj;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uGroundCol;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uCloud;
uniform float uExposure;
out vec4 fragColor;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x),
             mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
vec3 tonemap(vec3 c){
  c *= uExposure;
  const float a=2.51,b=0.03,cc=2.43,d=0.59,e=0.14;
  return clamp((c*(a*c+b))/(c*(cc*c+d)+e), 0.0, 1.0);
}

void main(){
  vec4 p0 = uInvViewProj * vec4(vNdc, -1.0, 1.0);
  vec4 p1 = uInvViewProj * vec4(vNdc,  1.0, 1.0);
  vec3 dir = normalize(p1.xyz / p1.w - p0.xyz / p0.w);

  float h = dir.y;
  vec3 col = mix(uSkyHorizon, uSkyTop, pow(clamp(h, 0.0, 1.0), 0.55));
  col = mix(col, uGroundCol, smoothstep(0.0, -0.12, h));

  // sun disc + glow
  float sd = max(dot(dir, normalize(uSunDir)), 0.0);
  col += uSunColor * pow(sd, 900.0) * 12.0;
  col += uSunColor * pow(sd, 12.0) * 0.28;

  // drifting clouds
  if (h > 0.005 && uCloud > 0.01){
    vec2 uv = dir.xz / max(h, 0.02);
    float c = fbm(uv * 0.55 + vec2(uTime * 0.006, uTime * 0.003));
    c = smoothstep(0.48, 0.86, c) * smoothstep(0.0, 0.22, h) * uCloud;
    vec3 cloudCol = mix(vec3(0.72,0.75,0.82), vec3(1.06,1.02,0.96), sd * 0.5 + 0.5);
    col = mix(col, cloudCol, c * 0.85);
  }
  fragColor = vec4(tonemap(col), 1.0);
}`;

  /* ------------------------------------------------------------------ */
  /*  PROGRAM HELPERS                                                    */
  /* ------------------------------------------------------------------ */

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:\n' + gl.getShaderInfoLog(s));
      console.error(src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
      throw new Error('shader');
    }
    return s;
  }

  function program(vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Program link: ' + gl.getProgramInfoLog(p));
    }
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  /* ------------------------------------------------------------------ */
  /*  MESH                                                               */
  /* ------------------------------------------------------------------ */

  const INSTANCE_FLOATS = 24;   // mat4(16) + color(4) + params(4)

  class Mesh {
    constructor(data) {
      this.vertCount = data.positions.length / 3;
      this.indexCount = data.indices.length;
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);

      const mk = (arr, loc, size) => {
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        return b;
      };
      this.bPos = mk(new Float32Array(data.positions), 0, 3);
      this.bNorm = mk(new Float32Array(data.normals), 1, 3);
      this.bUv = mk(new Float32Array(data.uvs), 2, 2);

      this.ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      const use32 = this.vertCount > 65535;
      this.indexType = use32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
        use32 ? new Uint32Array(data.indices) : new Uint16Array(data.indices), gl.STATIC_DRAW);

      gl.bindVertexArray(null);
      this._instBuf = null;
    }

    /* attach an instance buffer to this mesh's VAO (one per batch => own VAO) */
    static bindInstanceAttribs(buf) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const stride = INSTANCE_FLOATS * 4;
      for (let i = 0; i < 4; i++) {
        const loc = 3 + i;
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, stride, i * 16);
        gl.vertexAttribDivisor(loc, 1);
      }
      gl.enableVertexAttribArray(7);
      gl.vertexAttribPointer(7, 4, gl.FLOAT, false, stride, 64);
      gl.vertexAttribDivisor(7, 1);
      gl.enableVertexAttribArray(8);
      gl.vertexAttribPointer(8, 4, gl.FLOAT, false, stride, 80);
      gl.vertexAttribDivisor(8, 1);
    }
  }

  /* ------------------------------------------------------------------ */
  /*  BATCH  — a mesh drawn N times with per-instance transform          */
  /* ------------------------------------------------------------------ */

  class Batch {
    constructor(mesh, texture, opts) {
      opts = opts || {};
      this.mesh = mesh;
      this.texture = texture || null;
      this.capacity = Math.max(1, opts.capacity || 64);
      this.data = new Float32Array(this.capacity * INSTANCE_FLOATS);
      this.count = 0;
      this.dirty = true;
      this.castShadow = opts.castShadow !== false;
      this.blend = !!opts.blend;
      this.doubleSided = !!opts.doubleSided;
      this.visible = true;
      this.depthWrite = opts.depthWrite !== false;
      this.order = opts.order || 0;
      this.worldUV = !!opts.worldUV;
      this.alphaTex = !!opts.alphaTex;

      // dedicated VAO so instance attribs don't clash between batches
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.bPos);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.bNorm);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.bUv);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
      this.instBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      Mesh.bindInstanceAttribs(this.instBuf);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
      gl.bindVertexArray(null);
    }

    clear() { this.count = 0; this.dirty = true; }

    _grow(n) {
      if (n <= this.capacity) return;
      let cap = this.capacity;
      while (cap < n) cap *= 2;
      const nd = new Float32Array(cap * INSTANCE_FLOATS);
      nd.set(this.data);
      this.data = nd; this.capacity = cap;
      gl.bindVertexArray(this.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      Mesh.bindInstanceAttribs(this.instBuf);
      gl.bindVertexArray(null);
    }

    /** mat: Float32Array(16), color: [r,g,b,a], params: [uvsX,uvsY,emissive,spec] */
    push(mat, color, params) {
      this._grow(this.count + 1);
      const o = this.count * INSTANCE_FLOATS;
      this.data.set(mat, o);
      this.data[o + 16] = color[0]; this.data[o + 17] = color[1];
      this.data[o + 18] = color[2]; this.data[o + 19] = color.length > 3 ? color[3] : 1;
      this.data[o + 20] = params ? params[0] : 1;
      this.data[o + 21] = params ? params[1] : 1;
      this.data[o + 22] = params ? params[2] : 0;
      this.data[o + 23] = params ? params[3] : 0.15;
      this.count++;
      this.dirty = true;
      return this.count - 1;
    }

    upload() {
      if (!this.dirty || this.count === 0) return;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.instBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * INSTANCE_FLOATS);
      this.dirty = false;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  TEXTURES                                                           */
  /* ------------------------------------------------------------------ */

  function createTexture(source, opts) {
    opts = opts || {};
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, opts.flipY !== false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const wrap = opts.clamp ? gl.CLAMP_TO_EDGE : gl.REPEAT;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (opts.mipmap !== false) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      const ext = gl.getExtension('EXT_texture_filter_anisotropic');
      if (ext) {
        const max = Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
        gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max);
      }
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    return t;
  }

  /* ------------------------------------------------------------------ */
  /*  SHADOW MAP                                                         */
  /* ------------------------------------------------------------------ */

  let shadow = null;
  function createShadowMap(size) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, size };
  }

  /* ------------------------------------------------------------------ */
  /*  INIT / RESIZE                                                      */
  /* ------------------------------------------------------------------ */

  let progMain, progDepth, progSky, whiteTex, emptyVao;

  function init(cv, opts) {
    opts = opts || {};
    canvas = cv;
    gl = canvas.getContext('webgl2', {
      antialias: opts.antialias !== false,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    if (!gl) return null;

    progMain = program(COMMON_VS, COMMON_FS);
    progDepth = program(DEPTH_VS, DEPTH_FS);
    progSky = program(SKY_VS, SKY_FS);
    emptyVao = gl.createVertexArray();

    const c = document.createElement('canvas');
    c.width = c.height = 2;
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, 2, 2);
    whiteTex = createTexture(c, { mipmap: false });

    shadow = createShadowMap(opts.shadowSize || 2048);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0.55, 0.72, 0.9, 1);
    return gl;
  }

  function resize(maxDpr) {
    const d = Math.min(window.devicePixelRatio || 1, maxDpr || 2);
    const w = Math.max(1, Math.floor(canvas.clientWidth * d));
    const h = Math.max(1, Math.floor(canvas.clientHeight * d));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    W = w; H = h; dpr = d;
    return { w, h, aspect: w / Math.max(1, h) };
  }

  /* ------------------------------------------------------------------ */
  /*  RENDER                                                             */
  /* ------------------------------------------------------------------ */

  const _tmpVP = new Float32Array(16);
  const _invVP = new Float32Array(16);
  const _lightVP = new Float32Array(16);
  const _lproj = new Float32Array(16);
  const _lview = new Float32Array(16);
  const _eye = new Float32Array(3);
  const _up = new Float32Array([0, 1, 0]);

  function computeLightVP(center, sunDir, radius) {
    M.m4.ortho(_lproj, -radius, radius, -radius, radius, 1, radius * 5.0);
    _eye[0] = center[0] + sunDir[0] * radius * 2.4;
    _eye[1] = center[1] + sunDir[1] * radius * 2.4;
    _eye[2] = center[2] + sunDir[2] * radius * 2.4;
    M.m4.lookAt(_lview, _eye, center, _up);
    M.m4.multiply(_lightVP, _lproj, _lview);
    return _lightVP;
  }

  function render(scene) {
    /*  scene = { viewProj, camPos, batches[], env{}, shadowCenter, shadowRadius, time } */
    const env = scene.env;
    computeLightVP(scene.shadowCenter, env.sunDir, scene.shadowRadius || 220);

    /* ---- shadow pass ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadow.fbo);
    gl.viewport(0, 0, shadow.size, shadow.size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.useProgram(progDepth.p);
    gl.uniformMatrix4fv(progDepth.u.uLightVP, false, _lightVP);
    gl.cullFace(gl.FRONT);
    for (const b of scene.batches) {
      if (!b.visible || !b.castShadow || b.count === 0) continue;
      b.upload();
      gl.bindVertexArray(b.vao);
      gl.drawElementsInstanced(gl.TRIANGLES, b.mesh.indexCount, b.mesh.indexType, 0, b.count);
    }
    gl.cullFace(gl.BACK);

    /* ---- main pass ---- */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* sky */
    M.m4.invert(_invVP, scene.viewProj);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(progSky.p);
    gl.uniformMatrix4fv(progSky.u.uInvViewProj, false, _invVP);
    gl.uniform3fv(progSky.u.uCamPos, scene.camPos);
    gl.uniform3fv(progSky.u.uSunDir, env.sunDir);
    gl.uniform3fv(progSky.u.uSkyTop, env.skyTop);
    gl.uniform3fv(progSky.u.uSkyHorizon, env.skyHorizon);
    gl.uniform3fv(progSky.u.uGroundCol, env.fogColor);
    gl.uniform3fv(progSky.u.uSunColor, env.sunColor);
    gl.uniform1f(progSky.u.uTime, scene.time);
    gl.uniform1f(progSky.u.uCloud, env.clouds);
    gl.uniform1f(progSky.u.uExposure, env.exposure);
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);

    /* geometry */
    const P = progMain;
    gl.useProgram(P.p);
    gl.uniformMatrix4fv(P.u.uViewProj, false, scene.viewProj);
    gl.uniformMatrix4fv(P.u.uLightVP, false, _lightVP);
    gl.uniform3fv(P.u.uCamPos, scene.camPos);
    gl.uniform3fv(P.u.uSunDir, env.sunDir);
    gl.uniform3fv(P.u.uSunColor, env.sunColor);
    gl.uniform3fv(P.u.uAmbTop, env.ambTop);
    gl.uniform3fv(P.u.uAmbBot, env.ambBot);
    gl.uniform3fv(P.u.uFogColor, env.fogColor);
    gl.uniform1f(P.u.uFogDensity, env.fogDensity);
    gl.uniform1f(P.u.uNight, env.night);
    gl.uniform1f(P.u.uShadowTexel, 1.0 / shadow.size);
    gl.uniform1f(P.u.uExposure, env.exposure);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, shadow.tex);
    gl.uniform1i(P.u.uShadow, 1);
    gl.uniform1i(P.u.uTex, 0);

    const opaque = [], blended = [];
    for (const b of scene.batches) {
      if (!b.visible || b.count === 0) continue;
      (b.blend ? blended : opaque).push(b);
    }
    blended.sort((a, b) => a.order - b.order);

    const drawList = (list) => {
      for (const b of list) {
        b.upload();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, b.texture || whiteTex);
        gl.uniform1f(P.u.uUseTex, b.texture ? 1 : 0);
        gl.uniform1f(P.u.uWorldUV, b.worldUV ? 1 : 0);
        gl.uniform1f(P.u.uAlphaTex, b.alphaTex ? 1 : 0);
        if (b.doubleSided) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
        gl.bindVertexArray(b.vao);
        gl.drawElementsInstanced(gl.TRIANGLES, b.mesh.indexCount, b.mesh.indexType, 0, b.count);
      }
    };

    gl.disable(gl.BLEND);
    drawList(opaque);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    drawList(blended);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
  }

  return {
    init, resize, render, createTexture,
    Mesh, Batch,
    get gl() { return gl; },
    get width() { return W; },
    get height() { return H; },
    makeMesh: (d) => new Mesh(d),
    makeBatch: (m, t, o) => new Batch(m, t, o)
  };
})();

if (typeof module !== 'undefined') module.exports = R;
