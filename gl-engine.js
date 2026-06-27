/**
 * ColorLab GL Engine — GPU 实时调色 (WebGL)
 * 参考 Lightroom / Snapseed / DaVinci 管线：Linear 曝光 → 色调 → 曲线 → HSL → 分离色调 → 效果
 */
class GLEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    if (!this.gl) throw new Error('WebGL not supported');

    this.glRef = this.gl;
    this.program = this._createProgram(VS, FS);
    this._initBuffers();
    this._initTextures();

    this.imageTex = null;
    this.fullTex = null;
    this.fullW = 0;
    this.fullH = 0;
    this.previewW = 0;
    this.previewH = 0;

    this.params = this.defaultParams();
    this._uniformLocs = this._cacheUniforms();
    this._curveDirty = true;
  }

  defaultParams() {
    return {
      exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
      temperature: 0, tint: 0, vibrance: 0, saturation: 0,
      clarity: 0, sharpening: 0, dehaze: 0, vignette: 0, grain: 0,
      splitShadowHue: 220, splitShadowSat: 0,
      splitHighlightHue: 40, splitHighlightSat: 0,
      splitBalance: 0,
      curveChannel: 0, // 0=master 1=R 2=G 3=B
      hsl: {
        red:{h:0,s:0,l:0}, orange:{h:0,s:0,l:0}, yellow:{h:0,s:0,l:0},
        green:{h:0,s:0,l:0}, cyan:{h:0,s:0,l:0}, blue:{h:0,s:0,l:0},
        purple:{h:0,s:0,l:0}, magenta:{h:0,s:0,l:0},
      },
    };
  }

  resetParams() {
    this.params = this.defaultParams();
    this.resetCurves();
  }

  resetCurves() {
    this.curveMaster = new Uint8Array(256);
    this.curveR = new Uint8Array(256);
    this.curveG = new Uint8Array(256);
    this.curveB = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      this.curveMaster[i] = i;
      this.curveR[i] = i;
      this.curveG[i] = i;
      this.curveB[i] = i;
    }
    this._curveDirty = true;
  }

  setCurveFromPoints(points, channel = 'master') {
    const lut = new Uint8Array(256);
    if (!points || points.length < 2) {
      for (let i = 0; i < 256; i++) lut[i] = i;
    } else {
      const sorted = [...points].sort((a, b) => a.x - b.x);
      for (let i = 0; i <= 255; i++) {
        let lo = sorted[0], hi = sorted[sorted.length - 1];
        for (let j = 0; j < sorted.length - 1; j++) {
          if (i >= sorted[j].x && i <= sorted[j + 1].x) {
            lo = sorted[j]; hi = sorted[j + 1]; break;
          }
        }
        const t = lo.x === hi.x ? 0 : (i - lo.x) / (hi.x - lo.x);
        lut[i] = Math.max(0, Math.min(255, Math.round(lo.y + (hi.y - lo.y) * t)));
      }
    }
    const map = { master: 'curveMaster', R: 'curveR', G: 'curveG', B: 'curveB' };
    const key = map[channel] || 'curveMaster';
    this[key] = lut;
    this._curveDirty = true;
  }

  /* ── Image loading ── */
  loadImage(img) {
    const gl = this.gl;
    const maxPreview = Math.min(2048, Math.max(img.width, img.height) > 3000 ? 1600 : 2048);
    let pw = img.width, ph = img.height;
    if (Math.max(pw, ph) > maxPreview) {
      const r = maxPreview / Math.max(pw, ph);
      pw = Math.round(pw * r);
      ph = Math.round(ph * r);
    }
    this.previewW = pw;
    this.previewH = ph;
    this.fullW = img.width;
    this.fullH = img.height;

    if (this.imageTex) gl.deleteTexture(this.imageTex);
    if (this.fullTex) gl.deleteTexture(this.fullTex);

    this.imageTex = this._uploadTexture(img, pw, ph);
    this.fullTex = this._uploadTexture(img, img.width, img.height);
    this.canvas.width = pw;
    this.canvas.height = ph;
    this.resetCurves();
  }

  _uploadTexture(img, w, h) {
    const gl = this.gl;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Canvas 上传 WebGL 时翻转 Y，避免图像上下颠倒
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    return tex;
  }

  /* ── Render ── */
  render(useFull = false) {
    const gl = this.gl;
    const tex = useFull ? this.fullTex : this.imageTex;
    if (!tex) return;

    const w = useFull ? this.fullW : this.previewW;
    const h = useFull ? this.fullH : this.previewH;

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    gl.viewport(0, 0, w, h);
    gl.useProgram(this.program);

    if (this._curveDirty) this._uploadCurveTextures();

    const p = this.params;
    const U = this._uniformLocs;

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(U.u_image, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexMaster);
    gl.uniform1i(U.u_curveMaster, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexRGB);
    gl.uniform1i(U.u_curveRGB, 2);

    gl.uniform2f(U.u_resolution, w, h);
    gl.uniform1f(U.u_exposure, p.exposure);
    gl.uniform1f(U.u_contrast, p.contrast / 100);
    gl.uniform1f(U.u_highlights, p.highlights / 100);
    gl.uniform1f(U.u_shadows, p.shadows / 100);
    gl.uniform1f(U.u_whites, p.whites / 100);
    gl.uniform1f(U.u_blacks, p.blacks / 100);
    gl.uniform1f(U.u_temperature, p.temperature / 100);
    gl.uniform1f(U.u_tint, p.tint / 100);
    gl.uniform1f(U.u_vibrance, p.vibrance / 100);
    gl.uniform1f(U.u_saturation, p.saturation / 100);
    gl.uniform1f(U.u_clarity, p.clarity / 100);
    gl.uniform1f(U.u_sharpening, p.sharpening / 100);
    gl.uniform1f(U.u_dehaze, p.dehaze / 100);
    gl.uniform1f(U.u_vignette, p.vignette / 100);
    gl.uniform1f(U.u_grain, p.grain / 100);
    gl.uniform1f(U.u_grainSeed, Math.random());
    gl.uniform1f(U.u_splitShadowHue, p.splitShadowHue);
    gl.uniform1f(U.u_splitShadowSat, p.splitShadowSat / 100);
    gl.uniform1f(U.u_splitHighlightHue, p.splitHighlightHue);
    gl.uniform1f(U.u_splitHighlightSat, p.splitHighlightSat / 100);
    gl.uniform1f(U.u_splitBalance, p.splitBalance / 100);
    gl.uniform1i(U.u_curveChannel, p.curveChannel);

    const hslOrder = ['red','orange','yellow','green','cyan','blue','purple','magenta'];
    const hslFlat = [];
    hslOrder.forEach(k => {
      hslFlat.push(p.hsl[k].h / 360, p.hsl[k].s / 100, p.hsl[k].l / 100);
    });
    gl.uniform3fv(U.u_hsl, new Float32Array(hslFlat));

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  }

  exportFullRes() {
    if (!this.fullTex) return null;
    const off = document.createElement('canvas');
    const exp = new GLEngine(off);
    exp.fullW = this.fullW;
    exp.fullH = this.fullH;
    exp.previewW = this.fullW;
    exp.previewH = this.fullH;
    exp.imageTex = this.fullTex;
    exp.fullTex = this.fullTex;
    exp.params = JSON.parse(JSON.stringify(this.params));
    exp.curveMaster = new Uint8Array(this.curveMaster);
    exp.curveR = new Uint8Array(this.curveR);
    exp.curveG = new Uint8Array(this.curveG);
    exp.curveB = new Uint8Array(this.curveB);
    exp._curveDirty = true;
    exp.render(true);
    return off;
  }

  /* ── WebGL helpers ── */
  _initBuffers() {
    const gl = this.gl;
    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1, 1,-1, -1,1, 1,1
    ]), gl.STATIC_DRAW);
  }

  _initTextures() {
    const gl = this.gl;
    this.curveTexMaster = gl.createTexture();
    this.curveTexRGB = gl.createTexture();
    this._curveDirty = true;
    if (!this.curveMaster) this.resetCurves();
  }

  _uploadCurveTextures() {
    const gl = this.gl;
    // Master curve: 256x1
    const master = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      const v = this.curveMaster[i];
      master[i*4] = v; master[i*4+1] = v; master[i*4+2] = v; master[i*4+3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexMaster);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, master);

    // RGB curves packed: R in R, G in G, B in B
    const rgb = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      rgb[i*4]   = this.curveR[i];
      rgb[i*4+1] = this.curveG[i];
      rgb[i*4+2] = this.curveB[i];
      rgb[i*4+3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexRGB);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, rgb);

    this._curveDirty = false;
  }

  _createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(fs));
      throw new Error('Shader compile error');
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'a_pos');
    gl.linkProgram(prog);
    return prog;
  }

  _cacheUniforms() {
    const gl = this.gl;
    const p = this.program;
    const names = [
      'u_image','u_curveMaster','u_curveRGB','u_resolution',
      'u_exposure','u_contrast','u_highlights','u_shadows','u_whites','u_blacks',
      'u_temperature','u_tint','u_vibrance','u_saturation',
      'u_clarity','u_sharpening','u_dehaze','u_vignette','u_grain','u_grainSeed',
      'u_splitShadowHue','u_splitShadowSat','u_splitHighlightHue','u_splitHighlightSat','u_splitBalance',
      'u_curveChannel','u_hsl',
    ];
    const locs = {};
    names.forEach(n => { locs[n] = gl.getUniformLocation(p, n); });
    return locs;
  }
}

/* ── Shaders ── */
const VS = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main(){
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FS = `
precision highp float;
varying vec2 v_uv;
uniform sampler2D u_image;
uniform sampler2D u_curveMaster;
uniform sampler2D u_curveRGB;
uniform vec2 u_resolution;
uniform float u_exposure, u_contrast, u_highlights, u_shadows;
uniform float u_whites, u_blacks, u_temperature, u_tint;
uniform float u_vibrance, u_saturation, u_clarity, u_sharpening, u_dehaze, u_vignette, u_grain, u_grainSeed;
uniform float u_splitShadowHue, u_splitShadowSat, u_splitHighlightHue, u_splitHighlightSat, u_splitBalance;
uniform int u_curveChannel;
uniform vec3 u_hsl[8];

float srgbToLinear(float c){ return c <= 0.04045 ? c/12.92 : pow((c+0.055)/1.055, 2.4); }
float linearToSrgb(float c){ return c <= 0.0031308 ? c*12.92 : 1.055*pow(c,1.0/2.4)-0.055; }
vec3 srgbToLinear3(vec3 c){ return vec3(srgbToLinear(c.r), srgbToLinear(c.g), srgbToLinear(c.b)); }
vec3 linearToSrgb3(vec3 c){ return vec3(linearToSrgb(c.r), linearToSrgb(c.g), linearToSrgb(c.b)); }

float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

vec3 rgb2hsl(vec3 c){
  float mx = max(c.r, max(c.g, c.b));
  float mn = min(c.r, min(c.g, c.b));
  float h, s, l = (mx+mn)*0.5;
  if(mx == mn){ h = 0.0; s = 0.0; }
  else {
    float d = mx - mn;
    s = l > 0.5 ? d/(2.0-mx-mn) : d/(mx+mn);
    if(mx == c.r) h = (c.g-c.b)/d + (c.g < c.b ? 6.0 : 0.0);
    else if(mx == c.g) h = (c.b-c.r)/d + 2.0;
    else h = (c.r-c.g)/d + 4.0;
    h /= 6.0;
  }
  return vec3(h, s, l);
}

float hue2rgb(float p, float q, float t){
  if(t < 0.0) t += 1.0;
  if(t > 1.0) t -= 1.0;
  if(t < 1.0/6.0) return p + (q-p)*6.0*t;
  if(t < 1.0/2.0) return q;
  if(t < 2.0/3.0) return p + (q-p)*(2.0/3.0-t)*6.0;
  return p;
}

vec3 hsl2rgb(vec3 hsl){
  if(hsl.y == 0.0) return vec3(hsl.z);
  float q = hsl.z < 0.5 ? hsl.z*(1.0+hsl.y) : hsl.z+hsl.y-hsl.z*hsl.y;
  float p = 2.0*hsl.z - q;
  return vec3(hue2rgb(p,q,hsl.x+1.0/3.0), hue2rgb(p,q,hsl.x), hue2rgb(p,q,hsl.x-1.0/3.0));
}

float hueBand(float h, float center, float width){
  float d = abs(h - center);
  d = min(d, 360.0 - d);
  return smoothstep(width, width * 0.3, d);
}

vec3 applyHSL(vec3 c){
  vec3 hsl = rgb2hsl(c);
  float h = hsl.x * 360.0;
  vec3 bestAdj = vec3(0.0);
  float bestW = 0.0;
  float w;
  w = max(hueBand(h, 10.0, 25.0), hueBand(h, 350.0, 20.0));
  if(w > bestW){ bestW = w; bestAdj = u_hsl[0]; }
  w = hueBand(h, 35.0, 15.0);
  if(w > bestW){ bestW = w; bestAdj = u_hsl[1]; }
  w = hueBand(h, 57.0, 18.0);
  if(w > bestW){ bestW = w; bestAdj = u_hsl[2]; }
  w = hueBand(h, 120.0, 50.0);
  if(w > bestW){ bestW = w; bestAdj = u_hsl[3]; }
  w = hueBand(h, 185.0, 18.0);
  if(w > bestW){ bestW = w; bestAdj = u_hsl[4]; }
  w = hueBand(h, 230.0, 35.0);
  if(w > bestW){ bestW = w; bestAdj = u_hsl[5]; }
  w = hueBand(h, 275.0, 18.0);
  if(w > bestW){ bestW = w; bestAdj = u_hsl[6]; }
  w = hueBand(h, 312.0, 18.0);
  if(w > bestW){ bestW = w; bestAdj = u_hsl[7]; }
  if(bestW > 0.01){
    hsl.x = mod(hsl.x + bestAdj.x, 1.0);
    hsl.y = clamp(hsl.y + bestAdj.y, 0.0, 1.0);
    hsl.z = clamp(hsl.z + bestAdj.z, 0.0, 1.0);
    return hsl2rgb(hsl);
  }
  return c;
}

vec3 splitTone(vec3 c, float lum){
  float bal = u_splitBalance * 0.5 + 0.5;
  float shadowW = 1.0 - smoothstep(bal-0.3, bal+0.1, lum);
  float highW = smoothstep(bal-0.1, bal+0.3, lum);
  // shadow tint
  float sh = u_splitShadowHue / 360.0;
  vec3 shadowColor = hsl2rgb(vec3(sh, abs(u_splitShadowSat), 0.5));
  c = mix(c, c * shadowColor * 2.0, shadowW * abs(u_splitShadowSat));
  float hh = u_splitHighlightHue / 360.0;
  vec3 highColor = hsl2rgb(vec3(hh, abs(u_splitHighlightSat), 0.5));
  c = mix(c, c * highColor * 2.0, highW * abs(u_splitHighlightSat));
  return c;
}

void main(){
  vec4 tex = texture2D(u_image, v_uv);
  vec3 c = srgbToLinear3(tex.rgb);

  // Exposure (stops)
  c *= pow(2.0, u_exposure);

  // Contrast (linear, pivot 0.18 middle gray)
  float pivot = 0.18;
  c = (c - pivot) * (1.0 + u_contrast) + pivot;

  // Highlights / Shadows (luminance masks)
  float lum = luma(c);
  float hiMask = smoothstep(0.4, 0.9, lum);
  float shMask = 1.0 - smoothstep(0.05, 0.45, lum);
  c *= 1.0 + u_highlights * hiMask * 0.8;
  c *= 1.0 + u_shadows * shMask * 0.8;

  // Whites / Blacks (input levels)
  c += u_whites * 0.15;
  c -= u_blacks * 0.12;

  // Back to sRGB for color ops
  c = linearToSrgb3(clamp(c, 0.0, 1.0));

  // White balance (proper approximation)
  float t = u_temperature;
  float ti = u_tint;
  c.r *= 1.0 + t * 0.25;
  c.b *= 1.0 - t * 0.25;
  c.g *= 1.0 + ti * 0.2;

  // Vibrance
  float mx = max(c.r, max(c.g, c.b));
  float sat = mx == 0.0 ? 0.0 : (mx - min(c.r, min(c.g, c.b))) / mx;
  float vibAmt = u_vibrance * (1.0 - sat);
  float gray = dot(c, vec3(0.299, 0.587, 0.114));
  c = vec3(gray) + (c - gray) * (1.0 + vibAmt);

  // Saturation
  gray = dot(c, vec3(0.299, 0.587, 0.114));
  c = vec3(gray) + (c - gray) * (1.0 + u_saturation);

  // HSL per-channel
  c = applyHSL(clamp(c, 0.0, 1.0));

  // Tone curves
  if(u_curveChannel == 0){
    c.r = texture2D(u_curveMaster, vec2(c.r, 0.5)).r;
    c.g = texture2D(u_curveMaster, vec2(c.g, 0.5)).r;
    c.b = texture2D(u_curveMaster, vec2(c.b, 0.5)).r;
  } else {
    c.r = texture2D(u_curveRGB, vec2(c.r, 0.5)).r;
    c.g = texture2D(u_curveRGB, vec2(c.g, 0.5)).g;
    c.b = texture2D(u_curveRGB, vec2(c.b, 0.5)).b;
  }

  // Split toning
  float lumSrgb = luma(c);
  c = splitTone(c, lumSrgb);

  // Clarity (midtone local contrast)
  float mid = abs(lumSrgb - 0.5) * 2.0;
  c = mix(c, c * (1.0 + u_clarity * (1.0 - mid) * 0.6), u_clarity);

  // Dehaze (shadow lift + contrast)
  float hazed = 1.0 - smoothstep(0.15, 0.75, lumSrgb);
  c = mix(c, c * (1.0 + u_dehaze * 0.35) + u_dehaze * 0.04, hazed);
  c = (c - 0.5) * (1.0 + u_dehaze * 0.25) + 0.5;

  // Sharpening (local contrast on edges)
  float gray2 = dot(c, vec3(0.299, 0.587, 0.114));
  c += (c - vec3(gray2)) * u_sharpening * 1.2 * (1.0 - mid * 0.5);

  // Vignette
  vec2 uv = v_uv - 0.5;
  float dist = length(uv) * 1.414;
  c *= 1.0 - u_vignette * pow(dist, 2.0) * 0.85;

  // Grain
  float gn = fract(sin(dot(v_uv * u_resolution + u_grainSeed, vec2(12.9898, 78.233))) * 43758.5453);
  c += (gn - 0.5) * u_grain * 0.08;

  gl_FragColor = vec4(clamp(c, 0.0, 1.0), tex.a);
}`;

window.GLEngine = GLEngine;
