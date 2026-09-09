/* ============================================================
   math.js  —  Minimal, fast vector / matrix / quaternion math
   Helicopter Simulator 3D  |  offlinegames.art
   ============================================================ */
'use strict';

const M = (function () {

  const EPS = 1e-6;
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
  const rand = (a, b) => a + Math.random() * (b - a);
  const DEG = Math.PI / 180;

  /* ---------------- vec3 ---------------- */
  const v3 = {
    create: (x = 0, y = 0, z = 0) => new Float32Array([x, y, z]),
    set: (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; },
    copy: (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; },
    add: (o, a, b) => { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; },
    sub: (o, a, b) => { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; },
    scale: (o, a, s) => { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; },
    addScaled: (o, a, b, s) => { o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o; },
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    len: (a) => Math.hypot(a[0], a[1], a[2]),
    len2: (a) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2],
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
    cross: (o, a, b) => {
      const ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2];
      o[0] = ay * bz - az * by; o[1] = az * bx - ax * bz; o[2] = ax * by - ay * bx; return o;
    },
    normalize: (o, a) => {
      const l = Math.hypot(a[0], a[1], a[2]);
      if (l < EPS) { o[0] = 0; o[1] = 0; o[2] = 0; return o; }
      o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o;
    },
    lerp: (o, a, b, t) => {
      o[0] = a[0] + (b[0] - a[0]) * t;
      o[1] = a[1] + (b[1] - a[1]) * t;
      o[2] = a[2] + (b[2] - a[2]) * t; return o;
    },
    transformQuat: (o, a, q) => {
      const x = a[0], y = a[1], z = a[2];
      const qx = q[0], qy = q[1], qz = q[2], qw = q[3];
      const ix = qw * x + qy * z - qz * y;
      const iy = qw * y + qz * x - qx * z;
      const iz = qw * z + qx * y - qy * x;
      const iw = -qx * x - qy * y - qz * z;
      o[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
      o[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
      o[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
      return o;
    },
    transformMat4: (o, a, m) => {
      const x = a[0], y = a[1], z = a[2];
      let w = m[3] * x + m[7] * y + m[11] * z + m[15]; w = w || 1;
      o[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
      o[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
      o[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
      return o;
    }
  };

  /* ---------------- quat ---------------- */
  const quat = {
    create: () => new Float32Array([0, 0, 0, 1]),
    identity: (o) => { o[0] = 0; o[1] = 0; o[2] = 0; o[3] = 1; return o; },
    copy: (o, a) => { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; o[3] = a[3]; return o; },
    multiply: (o, a, b) => {
      const ax = a[0], ay = a[1], az = a[2], aw = a[3];
      const bx = b[0], by = b[1], bz = b[2], bw = b[3];
      o[0] = ax * bw + aw * bx + ay * bz - az * by;
      o[1] = ay * bw + aw * by + az * bx - ax * bz;
      o[2] = az * bw + aw * bz + ax * by - ay * bx;
      o[3] = aw * bw - ax * bx - ay * by - az * bz;
      return o;
    },
    setAxisAngle: (o, ax, ay, az, rad) => {
      const h = rad * 0.5, s = Math.sin(h);
      o[0] = ax * s; o[1] = ay * s; o[2] = az * s; o[3] = Math.cos(h); return o;
    },
    fromEuler: (o, x, y, z) => { // YXZ order (yaw, pitch, roll) - aviation friendly
      const c1 = Math.cos(y * 0.5), s1 = Math.sin(y * 0.5);
      const c2 = Math.cos(x * 0.5), s2 = Math.sin(x * 0.5);
      const c3 = Math.cos(z * 0.5), s3 = Math.sin(z * 0.5);
      o[0] = c1 * s2 * c3 + s1 * c2 * s3;
      o[1] = s1 * c2 * c3 - c1 * s2 * s3;
      o[2] = c1 * c2 * s3 - s1 * s2 * c3;
      o[3] = c1 * c2 * c3 + s1 * s2 * s3;
      return o;
    },
    normalize: (o, a) => {
      let l = Math.hypot(a[0], a[1], a[2], a[3]);
      if (l < EPS) return quat.identity(o);
      l = 1 / l;
      o[0] = a[0] * l; o[1] = a[1] * l; o[2] = a[2] * l; o[3] = a[3] * l; return o;
    },
    slerp: (o, a, b, t) => {
      let ax = a[0], ay = a[1], az = a[2], aw = a[3];
      let bx = b[0], by = b[1], bz = b[2], bw = b[3];
      let cos = ax * bx + ay * by + az * bz + aw * bw;
      if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
      let s0, s1;
      if (1 - cos > EPS) {
        const om = Math.acos(cos), sin = Math.sin(om);
        s0 = Math.sin((1 - t) * om) / sin; s1 = Math.sin(t * om) / sin;
      } else { s0 = 1 - t; s1 = t; }
      o[0] = s0 * ax + s1 * bx; o[1] = s0 * ay + s1 * by;
      o[2] = s0 * az + s1 * bz; o[3] = s0 * aw + s1 * bw;
      return o;
    }
  };

  /* ---------------- mat4 (column major) ---------------- */
  const m4 = {
    create: () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
    identity: (o) => { o.set([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); return o; },
    copy: (o, a) => { o.set(a); return o; },
    multiply: (o, a, b) => {
      const a00=a[0],a01=a[1],a02=a[2],a03=a[3], a10=a[4],a11=a[5],a12=a[6],a13=a[7],
            a20=a[8],a21=a[9],a22=a[10],a23=a[11], a30=a[12],a31=a[13],a32=a[14],a33=a[15];
      let b0=b[0],b1=b[1],b2=b[2],b3=b[3];
      o[0]=b0*a00+b1*a10+b2*a20+b3*a30; o[1]=b0*a01+b1*a11+b2*a21+b3*a31;
      o[2]=b0*a02+b1*a12+b2*a22+b3*a32; o[3]=b0*a03+b1*a13+b2*a23+b3*a33;
      b0=b[4];b1=b[5];b2=b[6];b3=b[7];
      o[4]=b0*a00+b1*a10+b2*a20+b3*a30; o[5]=b0*a01+b1*a11+b2*a21+b3*a31;
      o[6]=b0*a02+b1*a12+b2*a22+b3*a32; o[7]=b0*a03+b1*a13+b2*a23+b3*a33;
      b0=b[8];b1=b[9];b2=b[10];b3=b[11];
      o[8]=b0*a00+b1*a10+b2*a20+b3*a30; o[9]=b0*a01+b1*a11+b2*a21+b3*a31;
      o[10]=b0*a02+b1*a12+b2*a22+b3*a32; o[11]=b0*a03+b1*a13+b2*a23+b3*a33;
      b0=b[12];b1=b[13];b2=b[14];b3=b[15];
      o[12]=b0*a00+b1*a10+b2*a20+b3*a30; o[13]=b0*a01+b1*a11+b2*a21+b3*a31;
      o[14]=b0*a02+b1*a12+b2*a22+b3*a32; o[15]=b0*a03+b1*a13+b2*a23+b3*a33;
      return o;
    },
    fromRotationTranslationScale: (o, q, v, s) => {
      const x=q[0],y=q[1],z=q[2],w=q[3];
      const x2=x+x, y2=y+y, z2=z+z;
      const xx=x*x2, xy=x*y2, xz=x*z2, yy=y*y2, yz=y*z2, zz=z*z2;
      const wx=w*x2, wy=w*y2, wz=w*z2;
      const sx=s[0], sy=s[1], sz=s[2];
      o[0]=(1-(yy+zz))*sx; o[1]=(xy+wz)*sx; o[2]=(xz-wy)*sx; o[3]=0;
      o[4]=(xy-wz)*sy; o[5]=(1-(xx+zz))*sy; o[6]=(yz+wx)*sy; o[7]=0;
      o[8]=(xz+wy)*sz; o[9]=(yz-wx)*sz; o[10]=(1-(xx+yy))*sz; o[11]=0;
      o[12]=v[0]; o[13]=v[1]; o[14]=v[2]; o[15]=1;
      return o;
    },
    perspective: (o, fovy, aspect, near, far) => {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      o[0]=f/aspect; o[1]=0; o[2]=0; o[3]=0;
      o[4]=0; o[5]=f; o[6]=0; o[7]=0;
      o[8]=0; o[9]=0; o[10]=(far+near)*nf; o[11]=-1;
      o[12]=0; o[13]=0; o[14]=2*far*near*nf; o[15]=0;
      return o;
    },
    ortho: (o, l, r, b, t, n, f) => {
      const lr=1/(l-r), bt=1/(b-t), nf=1/(n-f);
      o[0]=-2*lr; o[1]=0; o[2]=0; o[3]=0;
      o[4]=0; o[5]=-2*bt; o[6]=0; o[7]=0;
      o[8]=0; o[9]=0; o[10]=2*nf; o[11]=0;
      o[12]=(l+r)*lr; o[13]=(t+b)*bt; o[14]=(f+n)*nf; o[15]=1;
      return o;
    },
    lookAt: (o, eye, center, up) => {
      let z0=eye[0]-center[0], z1=eye[1]-center[1], z2=eye[2]-center[2];
      let l = Math.hypot(z0,z1,z2); if (l < EPS) { z0=0;z1=0;z2=1; l=1; }
      z0/=l; z1/=l; z2/=l;
      let x0=up[1]*z2-up[2]*z1, x1=up[2]*z0-up[0]*z2, x2=up[0]*z1-up[1]*z0;
      l = Math.hypot(x0,x1,x2);
      if (l < EPS) { x0=1;x1=0;x2=0; } else { x0/=l; x1/=l; x2/=l; }
      const y0=z1*x2-z2*x1, y1=z2*x0-z0*x2, y2=z0*x1-z1*x0;
      o[0]=x0;o[1]=y0;o[2]=z0;o[3]=0;
      o[4]=x1;o[5]=y1;o[6]=z1;o[7]=0;
      o[8]=x2;o[9]=y2;o[10]=z2;o[11]=0;
      o[12]=-(x0*eye[0]+x1*eye[1]+x2*eye[2]);
      o[13]=-(y0*eye[0]+y1*eye[1]+y2*eye[2]);
      o[14]=-(z0*eye[0]+z1*eye[1]+z2*eye[2]);
      o[15]=1;
      return o;
    },
    invert: (o, a) => {
      const a00=a[0],a01=a[1],a02=a[2],a03=a[3], a10=a[4],a11=a[5],a12=a[6],a13=a[7],
            a20=a[8],a21=a[9],a22=a[10],a23=a[11], a30=a[12],a31=a[13],a32=a[14],a33=a[15];
      const b00=a00*a11-a01*a10, b01=a00*a12-a02*a10, b02=a00*a13-a03*a10,
            b03=a01*a12-a02*a11, b04=a01*a13-a03*a11, b05=a02*a13-a03*a12,
            b06=a20*a31-a21*a30, b07=a20*a32-a22*a30, b08=a20*a33-a23*a30,
            b09=a21*a32-a22*a31, b10=a21*a33-a23*a31, b11=a22*a33-a23*a32;
      let det = b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06;
      if (!det) return null;
      det = 1/det;
      o[0]=(a11*b11-a12*b10+a13*b09)*det; o[1]=(a02*b10-a01*b11-a03*b09)*det;
      o[2]=(a31*b05-a32*b04+a33*b03)*det; o[3]=(a22*b04-a21*b05-a23*b03)*det;
      o[4]=(a12*b08-a10*b11-a13*b07)*det; o[5]=(a00*b11-a02*b08+a03*b07)*det;
      o[6]=(a32*b02-a30*b05-a33*b01)*det; o[7]=(a20*b05-a22*b02+a23*b01)*det;
      o[8]=(a10*b10-a11*b08+a13*b06)*det; o[9]=(a01*b08-a00*b10-a03*b06)*det;
      o[10]=(a30*b04-a31*b02+a33*b00)*det; o[11]=(a21*b02-a20*b04-a23*b00)*det;
      o[12]=(a11*b07-a10*b09-a12*b06)*det; o[13]=(a00*b09-a01*b07+a02*b06)*det;
      o[14]=(a31*b01-a30*b03-a32*b00)*det; o[15]=(a20*b03-a21*b01+a22*b00)*det;
      return o;
    }
  };

  /* ---------- seeded RNG (mulberry32) for procedural levels ---------- */
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return { EPS, clamp, lerp, damp, rand, DEG, v3, quat, m4, makeRng };
})();

if (typeof module !== 'undefined') module.exports = M;
