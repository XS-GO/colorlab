/**
 * ColorLab Vision Agent — 图像深度分析 + 调色决策
 */
const VisionAgent = (() => {
  function analyzeCanvas(canvas) {
    if (!canvas || !canvas.width) {
      return defaultReport();
    }
    const size = 200;
    const tmp = document.createElement('canvas');
    const scale = size / Math.max(canvas.width, canvas.height);
    tmp.width = Math.max(1, Math.round(canvas.width * scale));
    tmp.height = Math.max(1, Math.round(canvas.height * scale));
    const ctx = tmp.getContext('2d');
    ctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
    const { data, width: w, height: h } = ctx.getImageData(0, 0, tmp.width, tmp.height);

    const lums = [];
    let rSum = 0, gSum = 0, bSum = 0;
    let clipHigh = 0, clipLow = 0;
    let skinPx = 0, skyPx = 0, total = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const rf = r / 255, gf = g / 255, bf = b / 255;
        const lum = 0.299 * rf + 0.587 * gf + 0.114 * bf;
        lums.push(lum);
        rSum += rf; gSum += gf; bSum += bf;
        if (r > 250 && g > 250 && b > 250) clipHigh++;
        if (r < 8 && g < 8 && b < 8) clipLow++;
        total++;

        // 肤色启发式
        if (r > g && g > b && r - b > 0.08 && lum > 0.2 && lum < 0.85) skinPx++;
        // 天空：画面上 1/3 偏蓝
        if (y < h / 3 && b > r * 1.05 && b > g * 0.95 && lum > 0.35) skyPx++;
      }
    }

    lums.sort((a, b) => a - b);
    const pct = p => lums[Math.floor(lums.length * p)] || 0;
    const avgLum = lums.reduce((a, b) => a + b, 0) / lums.length;
    const avgR = rSum / total, avgG = gSum / total, avgB = bSum / total;
    const skinRatio = skinPx / total;
    const skyRatio = skyPx / (total / 3);

    let scene = 'general';
    if (skinRatio > 0.12) scene = 'portrait';
    else if (skyRatio > 0.15) scene = 'landscape';
    else if (avgLum < 0.28) scene = 'night';
    else if (avgLum > 0.72) scene = 'bright';

    const cast = avgR - avgB;
    let colorCast = 'neutral';
    if (cast > 0.06) colorCast = 'warm';
    else if (cast < -0.06) colorCast = 'cool';

    return {
      avgLum, avgR, avgG, avgB,
      p05: pct(0.05), p50: pct(0.5), p95: pct(0.95),
      clipHigh: clipHigh / total,
      clipLow: clipLow / total,
      contrast: pct(0.95) - pct(0.05),
      skinRatio, skyRatio, scene, colorCast,
      isDark: avgLum < 0.38,
      isBright: avgLum > 0.62,
      isFlat: (pct(0.95) - pct(0.05)) < 0.45,
    };
  }

  function defaultReport() {
    return {
      avgLum: 0.5, scene: 'general', colorCast: 'neutral',
      clipHigh: 0, clipLow: 0, contrast: 0.5, isDark: false, isFlat: false,
    };
  }

  /** Agent 决策：结合画面分析 + 用户描述 */
  function plan(prompt, report) {
    const text = (prompt || '').trim().toLowerCase();
    const steps = [];
    const adj = {
      exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
      temperature: 0, tint: 0, vibrance: 0, saturation: 0,
      clarity: 0, vignette: 0, grain: 0,
      splitShadowHue: 220, splitShadowSat: 0, splitHighlightHue: 40,
      splitHighlightSat: 0, splitBalance: 0,
    };
    let preset = null;

    steps.push(`识别场景：${sceneLabel(report.scene)}`);

    // —— 基于画面的自动修正 ——
    if (report.clipHigh > 0.02) {
      adj.highlights -= Math.min(40, report.clipHigh * 400);
      adj.whites -= 10;
      steps.push('压高光（过曝区域）');
    }
    if (report.clipLow > 0.03 || report.isDark) {
      adj.shadows += 22;
      adj.exposure += report.isDark ? 0.35 : 0.15;
      steps.push('提亮阴影');
    }
    if (report.isBright && report.clipHigh < 0.01) {
      adj.exposure -= 0.12;
      adj.highlights -= 8;
    }
    if (report.isFlat) {
      adj.contrast += 12;
      adj.clarity += 15;
      adj.vibrance += 10;
      steps.push('增强层次');
    }
    if (report.colorCast === 'warm') {
      adj.temperature -= 12;
      steps.push('校正暖色偏');
    } else if (report.colorCast === 'cool') {
      adj.temperature += 12;
      steps.push('校正冷色偏');
    }

    // —— 场景策略 ——
    switch (report.scene) {
      case 'portrait':
        preset = text.match(/日系|清新/) ? 'japanese-film' :
          text.match(/复古|胶片/) ? 'kodak-portra' : 'kodak-portra';
        adj.clarity -= 8;
        adj.vibrance += 6;
        adj.shadows += 8;
        steps.push('人像肤色优化');
        break;
      case 'landscape':
        preset = text.match(/鲜艳|velvia/) ? 'fuji-velvia' : 'fuji-provia';
        adj.clarity += 12;
        adj.vibrance += 15;
        adj.contrast += 8;
        steps.push('风光增强');
        break;
      case 'night':
        preset = text.match(/赛博|霓虹/) ? 'cyberpunk' : 'moody-cinematic';
        adj.contrast += 15;
        adj.vignette += 20;
        steps.push('夜景氛围');
        break;
      case 'bright':
        adj.highlights -= 18;
        adj.contrast += 6;
        steps.push('高光控制');
        break;
    }

    // —— 用户关键词覆盖 ——
    if (/日系|清新|空气/.test(text)) preset = 'japanese-film';
    if (/电影|青橙|cinematic/.test(text)) preset = 'cinematic-teal-orange';
    if (/赛博|霓虹/.test(text)) preset = 'cyberpunk';
    if (/复古|怀旧|胶片/.test(text)) preset = 'vintage-warm';
    if (/黑白|mono/.test(text)) preset = 'bw-classic';
    if (/更亮|提亮|太暗/.test(text)) { adj.exposure += 0.3; adj.shadows += 15; }
    if (/更暗|压暗|太亮/.test(text)) { adj.exposure -= 0.25; adj.highlights -= 15; }
    if (/暖|温暖/.test(text)) adj.temperature += 25;
    if (/冷|清冷|蓝调/.test(text)) adj.temperature -= 25;
    if (/饱和|鲜艳/.test(text)) { adj.vibrance += 20; adj.saturation += 12; }
    if (/柔和|磨皮|soft/.test(text)) { adj.clarity -= 15; adj.contrast -= 10; }

    if (preset) steps.push(`风格：${window.PRESETS?.[preset]?.name || preset}`);

    if (!preset && !text) {
      preset = report.scene === 'portrait' ? 'kodak-portra' :
        report.scene === 'landscape' ? 'fuji-provia' :
        report.scene === 'night' ? 'moody-cinematic' : 'fuji-provia';
      steps.push('智能推荐风格');
    }

    return {
      preset,
      presetStrength: 0.88,
      adjustments: adj,
      explanation: steps.join(' → '),
      source: 'agent',
      report,
    };
  }

  function sceneLabel(s) {
    return { portrait: '人像', landscape: '风光', night: '夜景', bright: '高亮', general: '通用' }[s] || s;
  }

  function autoEnhance(canvas) {
    const report = analyzeCanvas(canvas);
    return plan('自动优化', report);
  }

  return { analyzeCanvas, plan, autoEnhance };
})();

window.VisionAgent = VisionAgent;
