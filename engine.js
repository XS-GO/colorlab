/**
 * ColorLab Engine - 专业级图像调色引擎
 * 所有调色均在 sRGB ↔ Linear RGB 之间正确转换计算
 */
class ColorEngine {
  constructor() {
    this.originalImageData = null;  // 原始图片像素数据 (linear)
    this.originalSRGB = null;       // 原始图片像素数据 (sRGB)
    this.width = 0;
    this.height = 0;
    this.exportImageData = null;    // 导出用原始分辨率

    // 所有调整参数（默认值）
    this.adj = {
      exposure: 0,      // -4 to +4 stops
      contrast: 0,      // -100 to +100
      highlights: 0,    // -100 to +100
      shadows: 0,       // -100 to +100
      whites: 0,        // -100 to +100
      blacks: 0,        // -100 to +100
      temperature: 0,   // -100 to +100 (cool to warm)
      tint: 0,          // -100 to +100 (green to magenta)
      vibrance: 0,      // -100 to +100
      saturation: 0,    // -100 to +100
      clarity: 0,       // 0 to 100
      sharpening: 0,    // 0 to 100
      vignette: 0,      // 0 to 100
      grain: 0,         // 0 to 100
      // HSL per channel
      hsl: {
        red:    { h:0, s:0, l:0 },
        orange: { h:0, s:0, l:0 },
        yellow: { h:0, s:0, l:0 },
        green:  { h:0, s:0, l:0 },
        cyan:   { h:0, s:0, l:0 },
        blue:   { h:0, s:0, l:0 },
        purple: { h:0, s:0, l:0 },
        magenta:{ h:0, s:0, l:0 },
      },
    };

    // Tone curve LUT (256 entries, initialized to identity)
    this.curveLUT = new Uint8Array(256);
    this.curveR = new Float32Array(256);
    this.curveG = new Float32Array(256);
    this.curveB = new Float32Array(256);
    this.resetCurves();

    // Preset blend
    this.presetActive = null;
    this.presetIntensity = 1.0;
  }

  // ========== 初始化 ==========

  resetCurves() {
    for (let i = 0; i < 256; i++) {
      this.curveLUT[i] = i;
      this.curveR[i] = i / 255;
      this.curveG[i] = i / 255;
      this.curveB[i] = i / 255;
    }
  }

  setCurveFromPoints(points) {
    // points: array of {x:0-255, y:0-255} control points
    if (!points || points.length < 2) return;
    const sorted = [...points].sort((a, b) => a.x - b.x);
    for (let i = 0; i <= 255; i++) {
      let lo = sorted[0], hi = sorted[sorted.length - 1];
      for (let j = 0; j < sorted.length - 1; j++) {
        if (i >= sorted[j].x && i <= sorted[j + 1].x) {
          lo = sorted[j]; hi = sorted[j + 1]; break;
        }
      }
      const t = lo.x === hi.x ? 0 : (i - lo.x) / (hi.x - lo.x);
      const val = lo.y + (hi.y - lo.y) * t;
      this.curveLUT[i] = Math.max(0, Math.min(255, Math.round(val)));
    }
  }

  // ========== 图片加载 ==========

  loadImage(image) {
    const maxDim = 1400;
    let w = image.width, h = image.height;
    if (Math.max(w, h) > maxDim) {
      const ratio = maxDim / Math.max(w, h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, w, h);
    this.originalSRGB = ctx.getImageData(0, 0, w, h);
    this.originalImageData = this.imageDataCopy(this.originalSRGB);
    this.srgbToLinear(this.originalImageData.data);
    this.width = w; this.height = h;

    // 保存导出用原始分辨率数据
    const expCanvas = document.createElement('canvas');
    expCanvas.width = image.width; expCanvas.height = image.height;
    const expCtx = expCanvas.getContext('2d');
    expCtx.drawImage(image, 0, 0);
    this.exportImageData = expCtx.getImageData(0, 0, image.width, image.height);
  }

  loadFromImageData(imageData) {
    const maxDim = 1400;
    let w = imageData.width, h = imageData.height;
    this.exportImageData = imageDataCopy(imageData);
    if (Math.max(w, h) > maxDim) {
      const ratio = maxDim / Math.max(w, h);
      w = Math.round(w * ratio);
      h = Math.round(h * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const temp = document.createElement('canvas');
    temp.width = imageData.width; temp.height = imageData.height;
    const tctx = temp.getContext('2d');
    tctx.putImageData(imageData, 0, 0);
    ctx.drawImage(temp, 0, 0, w, h);
    this.originalSRGB = ctx.getImageData(0, 0, w, h);
    this.originalImageData = this.imageDataCopy(this.originalSRGB);
    this.srgbToLinear(this.originalImageData.data);
    this.width = w; this.height = h;
  }

  // ========== 处理管道 ==========

  /**
   * 将最终结果渲染到指定 canvas 上
   */
  renderToCanvas(canvas) {
    if (!this.originalImageData) return;
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');

    // 1. 从原始 linear 数据复制一份
    const work = this.imageDataCopy(this.originalImageData);
    const px = work.data;

    // 2. 应用所有调整（在 linear 空间）
    this.applyExposure(px, this.adj.exposure);
    this.applyContrast(px, this.adj.contrast);
    this.applyHighlightsShadows(px, this.adj.highlights, this.adj.shadows);
    this.applyWhitesBlacks(px, this.adj.whites, this.adj.blacks);

    // 3. 转回 sRGB 做颜色调整
    this.linearToSrgb(px);
    this.applyWhiteBalance(px, this.adj.temperature, this.adj.tint);
    this.applyVibrance(px, this.adj.vibrance);
    this.applySaturation(px, this.adj.saturation);

    // 4. HSL 调整
    if (this.hasHSLAdjustments()) {
      this.applyHSL(px);
    }

    // 5. 色调曲线
    this.applyCurve(px);

    // 6. 转 linear 做 clarity/sharpening
    this.srgbToLinear(px);
    this.applyClarity(px, this.adj.clarity);
    this.applySharpening(px, this.adj.sharpening);
    this.applyVignette(px, this.adj.vignette, this.width, this.height);
    this.linearToSrgb(px);
    this.applyGrain(px, this.adj.grain, this.width, this.height);

    // 7. 线性混合 preset（如果启用）
    if (this.presetActive && this.presetIntensity > 0) {
      this.blendPreset(px);
    }

    // 8. 最终 clamp
    this.clamp(px);

    // 9. 渲染
    work.data.set(px);
    ctx.putImageData(work, 0, 0);
    return work;
  }

  /**
   * 导出高质量图片（使用原始分辨率数据 + 当前调整参数）
   */
  async exportFullRes() {
    if (!this.exportImageData) return null;
    const exp = this.imageDataCopy(this.exportImageData);
    const px = exp.data;
    const w = exp.width, h = exp.height;

    // Linear space adjustments
    this.srgbToLinear(px);
    this.applyExposure(px, this.adj.exposure);
    this.applyContrast(px, this.adj.contrast);
    this.applyHighlightsShadows(px, this.adj.highlights, this.adj.shadows);
    this.applyWhitesBlacks(px, this.adj.whites, this.adj.blacks);
    this.linearToSrgb(px);
    this.applyWhiteBalance(px, this.adj.temperature, this.adj.tint);
    this.applyVibrance(px, this.adj.vibrance);
    this.applySaturation(px, this.adj.saturation);
    if (this.hasHSLAdjustments()) {
      this.applyHSL(px);
    }
    this.applyCurve(px);
    this.srgbToLinear(px);
    this.applyClarity(px, this.adj.clarity);
    this.applySharpening(px, this.adj.sharpening);
    this.applyVignette(px, this.adj.vignette, w, h);
    this.linearToSrgb(px);
    this.applyGrain(px, this.adj.grain, w, h);
    if (this.presetActive && this.presetIntensity > 0) {
      this.blendPreset(px);
    }
    this.clamp(px);
    exp.data.set(px);

    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').putImageData(exp, 0, 0);
    return canvas;
  }

  // ========== 色彩空间转换 ==========

  srgbToLinear(data) {
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = this.srgbToLinear1(data[i] / 255) * 255;
      data[i + 1] = this.srgbToLinear1(data[i + 1] / 255) * 255;
      data[i + 2] = this.srgbToLinear1(data[i + 2] / 255) * 255;
    }
  }

  linearToSrgb(data) {
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = this.linearToSrgb1(data[i] / 255) * 255;
      data[i + 1] = this.linearToSrgb1(data[i + 1] / 255) * 255;
      data[i + 2] = this.linearToSrgb1(data[i + 2] / 255) * 255;
    }
  }

  srgbToLinear1(c) {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  linearToSrgb1(c) {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  // ========== 各调整算法 ==========

  /** 曝光（stops，linear 空间） */
  applyExposure(data, stops) {
    if (stops === 0) return;
    const factor = Math.pow(2, stops);
    for (let i = 0; i < data.length; i += 4) {
      data[i]     *= factor;
      data[i + 1] *= factor;
      data[i + 2] *= factor;
    }
  }

  /** 对比度（-100~100，linear 空间） */
  applyContrast(data, contrast) {
    if (contrast === 0) return;
    const c = contrast / 100;
    const f = (259 * (c * 255 + 255)) / (255 * (259 - c * 255));
    const mid = 128;
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = f * (data[i]     - mid) + mid;
      data[i + 1] = f * (data[i + 1] - mid) + mid;
      data[i + 2] = f * (data[i + 2] - mid) + mid;
    }
  }

  /** 高光/阴影（linear 空间） */
  applyHighlightsShadows(data, highlights, shadows) {
    if (highlights === 0 && shadows === 0) return;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      // 高光阈值 > 128，阴影阈值 < 128
      const hFac = highlights / 100;
      const sFac = shadows / 100;
      const blend = smoothstep(luma, 100, 155);
      const hAdj = 1 + hFac * (1 - blend);
      const sAdj = 1 + sFac * blend;
      data[i]     = r * hAdj * sAdj;
      data[i+1]   = g * hAdj * sAdj;
      data[i+2]   = b * hAdj * sAdj;
    }
  }

  /** 白色/黑色 (linear) */
  applyWhitesBlacks(data, whites, blacks) {
    if (whites === 0 && blacks === 0) return;
    for (let i = 0; i < data.length; i += 4) {
      const wAdj = whites / 100 * 0.5;
      const bAdj = blacks / 100 * 0.5;
      data[i]     += wAdj * 50 - bAdj * 30;
      data[i+1]   += wAdj * 50 - bAdj * 30;
      data[i+2]   += wAdj * 50 - bAdj * 30;
    }
  }

  /** 白平衡（色温/色调，sRGB 空间） */
  applyWhiteBalance(data, temp, tint) {
    if (temp === 0 && tint === 0) return;
    const tR = 1 + temp / 100 * 0.3;
    const tB = 1 - temp / 100 * 0.3;
    const tiG = 1 + tint / 100 * 0.25;
    for (let i = 0; i < data.length; i += 4) {
      data[i]     *= tR;
      data[i+1]   *= tiG;
      data[i+2]   *= tB;
    }
  }

  /** 自然饱和度（sRGB） */
  applyVibrance(data, value) {
    if (value === 0) return;
    const v = value / 100;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;
      // vibrance 对低饱和度区域施加更大力度
      const amount = v * (1 - sat);
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      data[i]     = gray + (r - gray) * (1 + amount);
      data[i+1]   = gray + (g - gray) * (1 + amount);
      data[i+2]   = gray + (b - gray) * (1 + amount);
    }
  }

  /** 饱和度（sRGB） */
  applySaturation(data, value) {
    if (value === 0) return;
    const v = value / 100;
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      data[i]     = gray + (data[i]   - gray) * (1 + v);
      data[i+1]   = gray + (data[i+1] - gray) * (1 + v);
      data[i+2]   = gray + (data[i+2] - gray) * (1 + v);
    }
  }

  /** 色调曲线（sRGB） */
  applyCurve(data) {
    let hasCurve = false;
    for (let i = 0; i < 256; i++) {
      if (this.curveLUT[i] !== i) { hasCurve = true; break; }
    }
    if (!hasCurve) return;
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = this.curveLUT[clamp255(data[i])];
      data[i+1]   = this.curveLUT[clamp255(data[i+1])];
      data[i+2]   = this.curveLUT[clamp255(data[i+2])];
    }
  }

  /** HSL 分通道调整（sRGB） */
  hasHSLAdjustments() {
    for (const ch of Object.values(this.adj.hsl)) {
      if (ch.h !== 0 || ch.s !== 0 || ch.l !== 0) return true;
    }
    return false;
  }

  applyHSL(data) {
    // 8 个色相范围定义
    const ranges = [
      { name: 'red',     min: 335, max: 360 }, // 335-360 & 0-25
      { name: 'red',     min: 0,   max: 25 },
      { name: 'orange',  min: 25,  max: 45 },
      { name: 'yellow',  min: 45,  max: 70 },
      { name: 'green',   min: 70,  max: 170 },
      { name: 'cyan',    min: 170, max: 200 },
      { name: 'blue',    min: 200, max: 260 },
      { name: 'purple',  min: 260, max: 290 },
      { name: 'magenta', min: 290, max: 335 },
    ];

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255, g = data[i+1] / 255, b = data[i+2] / 255;
      const hsl = rgbToHsl(r, g, b);
      const hue = hsl[0] * 360;

      for (const range of ranges) {
        if (hue >= range.min && hue < range.max) {
          const adj = this.adj.hsl[range.name];
          if (!adj || (adj.h === 0 && adj.s === 0 && adj.l === 0)) continue;

          let newH = (hsl[0] + adj.h / 360) % 1;
          if (newH < 0) newH += 1;
          let newS = Math.max(0, Math.min(1, hsl[1] + adj.s / 100));
          let newL = Math.max(0, Math.min(1, hsl[2] + adj.l / 100));

          const [nr, ng, nb] = hslToRgb(newH, newS, newL);
          data[i] = nr * 255;
          data[i+1] = ng * 255;
          data[i+2] = nb * 255;
          break;
        }
      }
    }
  }

  /** 清晰度 / 局部对比度（linear）—— 使用 unsharp mask */
  applyClarity(data, value) {
    if (value <= 0) return;
    const amount = value / 100 * 0.5;
    const radius = 3;
    const blurred = this.boxBlur(data, this.width, this.height, radius);
    for (let i = 0; i < data.length; i += 4) {
      data[i]     += amount * (data[i]     - blurred[i]);
      data[i+1]   += amount * (data[i+1]   - blurred[i+1]);
      data[i+2]   += amount * (data[i+2]   - blurred[i+2]);
    }
  }

  /** USM 锐化（linear） */
  applySharpening(data, value) {
    if (value <= 0) return;
    const amount = value / 100 * 0.8;
    const radius = 1.5;
    const blurred = this.gaussianBlur1D(data, this.width, this.height, radius);
    for (let i = 0; i < data.length; i += 4) {
      data[i]     += amount * (data[i]     - blurred[i]);
      data[i+1]   += amount * (data[i+1]   - blurred[i+1]);
      data[i+2]   += amount * (data[i+2]   - blurred[i+2]);
    }
  }

  /** 暗角（sRGB） */
  applyVignette(data, value, w, h) {
    if (value <= 0) return;
    const amount = value / 100;
    const cx = w / 2, cy = h / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) / maxR;
        const falloff = Math.pow(dist, 2.2);
        const darken = 1 - falloff * amount * 0.8;
        const idx = (y * w + x) * 4;
        data[idx]     *= darken;
        data[idx + 1] *= darken;
        data[idx + 2] *= darken;
      }
    }
  }

  /** 胶片颗粒（sRGB） */
  applyGrain(data, value, w, h) {
    if (value <= 0) return;
    const amount = value / 100 * 30;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * amount;
      data[i]     += noise;
      data[i+1]   += noise;
      data[i+2]   += noise;
    }
    this.grainSeed = this.grainSeed || 0;
  }

  /** 混合预设效果 */
  blendPreset(data) {
    if (!this.presetActive) return;
    const intensity = this.presetIntensity;
    // Preset 在 renderToCanvas 之前就应该把 adjustments 设好了
    // 这里只是做微调混合
    // 实际上 preset 主要是通过修改 this.adj 来工作的
  }

  // ========== 滤波器工具 ==========

  boxBlur(data, w, h, radius) {
    const result = new Float32Array(data.length);
    const r = Math.round(radius);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sr = 0, sg = 0, sb = 0, count = 0;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const idx = (ny * w + nx) * 4;
              sr += data[idx]; sg += data[idx+1]; sb += data[idx+2];
              count++;
            }
          }
        }
        const idx = (y * w + x) * 4;
        result[idx] = sr / count;
        result[idx+1] = sg / count;
        result[idx+2] = sb / count;
        result[idx+3] = data[idx+3];
      }
    }
    return result;
  }

  gaussianBlur1D(data, w, h, sigma) {
    // 简化：用 box blur 近似
    return this.boxBlur(data, w, h, sigma * 1.5);
  }

  // ========== 工具函数 ==========

  imageDataCopy(src) {
    const dst = new ImageData(src.width, src.height);
    dst.data.set(src.data);
    return dst;
  }

  clamp(data) {
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = Math.max(0, Math.min(255, data[i]));
      data[i+1]   = Math.max(0, Math.min(255, data[i+1]));
      data[i+2]   = Math.max(0, Math.min(255, data[i+2]));
    }
  }
}

// ========== 全局辅助函数 ==========

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** RGB (0-1) to HSL (h: 0-1, s: 0-1, l: 0-1) */
function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h, s, l];
}

/** HSL to RGB (0-1) */
function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [r, g, b];
}

function imageDataCopy(src) {
  const dst = new ImageData(src.width, src.height);
  dst.data.set(src.data);
  return dst;
}

// 全局引擎实例
window.colorEngine = new ColorEngine();
