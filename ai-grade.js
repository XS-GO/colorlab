/**
 * ColorLab AI Grader — 自然语言 → 调色参数
 * 1. 本地：图像统计 + 语义规则（免费、即时）
 * 2. 可选：OpenAI 兼容 API + 视觉分析（用户自填 Key）
 */
const AIGrader = (() => {
  const STORAGE_KEY = 'colorlab_openai_key';
  const BASE_URL_KEY = 'colorlab_api_base';

  const PARAM_LIMITS = {
    exposure: [-2, 2], contrast: [-100, 100], highlights: [-100, 100],
    shadows: [-100, 100], whites: [-100, 100], blacks: [-100, 100],
    temperature: [-100, 100], tint: [-100, 100], vibrance: [-100, 100],
    saturation: [-100, 100], clarity: [0, 100], vignette: [0, 100], grain: [0, 100],
    splitShadowHue: [0, 360], splitShadowSat: [0, 100],
    splitHighlightHue: [0, 360], splitHighlightSat: [0, 100], splitBalance: [-100, 100],
  };

  const PRESET_ALIASES = [
    { re: /日系|清新|空气感|过曝|滨田|films?/i, key: 'japanese-film' },
    { re: /韩剧|奶油|柔光|肤色/i, key: 'korean-drama' },
    { re: /青橙|teal.?orange|好莱坞|电影感|cinematic/i, key: 'cinematic-teal-orange' },
    { re: /大片|blockbuster|商业/i, key: 'cinematic-blockbuster' },
    { re: /韦斯|anderson|童话/i, key: 'cinematic-wes-anderson' },
    { re: /velvia|鲜艳|风光/i, key: 'fuji-velvia' },
    { re: /portra|人像|肤色/i, key: 'kodak-portra' },
    { re: /复古|怀旧|胶片|warm.*vintage/i, key: 'vintage-warm' },
    { re: /冷调|文艺|褪色/i, key: 'vintage-cool' },
    { re: /拍立得|polaroid/i, key: 'vintage-polaroid' },
    { re: /黑白|mono|black.?white/i, key: 'bw-classic' },
    { re: / noir|黑色电影/i, key: 'bw-film-noir' },
    { re: /赛博|cyberpunk|霓虹/i, key: 'cyberpunk' },
    { re: /黄金|日落|golden.?hour|夕阳/i, key: 'golden-hour' },
    { re: /暗调|情绪|moody/i, key: 'moody-cinematic' },
    { re: /classic.?chrome|纪实/i, key: 'fuji-classic-chrome' },
    { re: /gold.?200|柯达金/i, key: 'kodak-gold' },
    { re: /provia|标准胶片/i, key: 'fuji-provia' },
    { re: /astia|柔和人像/i, key: 'fuji-astia' },
  ];

  function clampParam(key, val) {
    const lim = PARAM_LIMITS[key];
    if (!lim) return val;
    return Math.max(lim[0], Math.min(lim[1], val));
  }

  function emptyAdjustments() {
    return {
      exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
      temperature: 0, tint: 0, vibrance: 0, saturation: 0,
      clarity: 0, vignette: 0, grain: 0,
      splitShadowHue: 220, splitShadowSat: 0, splitHighlightHue: 40,
      splitHighlightSat: 0, splitBalance: 0,
    };
  }

  function mergeAdjustments(base, delta) {
    const out = { ...base };
    for (const [k, v] of Object.entries(delta)) {
      if (typeof v === 'number') out[k] = clampParam(k, (out[k] || 0) + v);
    }
    return out;
  }

  /** 采样图像亮度/饱和度 */
  function analyzeImageStats(canvas) {
    if (!canvas || !canvas.width) return { avgLum: 0.5, avgSat: 0.3, isDark: false, isFlat: false };
    const sw = Math.min(canvas.width, 160);
    const sh = Math.min(canvas.height, 160);
    const tmp = document.createElement('canvas');
    tmp.width = sw; tmp.height = sh;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(canvas, 0, 0, sw, sh);
    const { data } = ctx.getImageData(0, 0, sw, sh);
    let lum = 0, sat = 0, n = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      lum += 0.299 * r + 0.587 * g + 0.114 * b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      sat += mx === 0 ? 0 : (mx - mn) / mx;
      n++;
    }
    const avgLum = lum / n;
    const avgSat = sat / n;
    return {
      avgLum, avgSat,
      isDark: avgLum < 0.38,
      isBright: avgLum > 0.62,
      isFlat: avgSat < 0.18,
      isVivid: avgSat > 0.45,
    };
  }

  /** 本地语义规则引擎 */
  function analyzeLocal(prompt, stats) {
    const text = prompt.trim().toLowerCase();
    let adj = emptyAdjustments();
    let preset = null;
    const notes = [];

    // 匹配预设风格
    for (const { re, key } of PRESET_ALIASES) {
      if (re.test(text)) { preset = key; notes.push(`风格：${PRESETS[key]?.name || key}`); break; }
    }

    // 语义规则（可叠加微调）
    const rules = [
      { re: /更亮|亮一点|提亮|变亮|太暗|不够亮/, d: { exposure: 0.35, shadows: 18, whites: 8 } },
      { re: /更暗|暗一点|压暗|变暗|太亮|过曝/, d: { exposure: -0.35, highlights: -22, blacks: 12 } },
      { re: /对比.*高|更有层次|通透/, d: { contrast: 18, clarity: 15, blacks: -8 } },
      { re: /对比.*低|柔和|柔一点|不要对比/, d: { contrast: -15, highlights: -12, clarity: -8 } },
      { re: /饱和|鲜艳|色彩丰富|更彩/, d: { vibrance: 22, saturation: 15 } },
      { re: /去饱和|淡一点|颜色少|muted/, d: { vibrance: -18, saturation: -22 } },
      { re: /暖|温暖|暖色|偏黄|夕阳/, d: { temperature: 28, tint: 10, splitHighlightHue: 35, splitHighlightSat: 18 } },
      { re: /冷|冷色|清冷|偏蓝|蓝调/, d: { temperature: -28, tint: -8, splitShadowHue: 210, splitShadowSat: 15 } },
      { re: /高光.*压|恢复高光|过曝/, d: { highlights: -28, whites: -12 } },
      { re: /阴影.*提|提亮暗部|暗部细节/, d: { shadows: 25, blacks: -10 } },
      { re: /锐|清晰|细节|sharp/, d: { clarity: 28, contrast: 8 } },
      { re: /磨皮|柔焦|soft|朦胧/, d: { clarity: -18, contrast: -10, highlights: -15 } },
      { re: /暗角|vignette/, d: { vignette: 35 } },
      { re: /颗粒|胶片感|grain|噪点/, d: { grain: 22, contrast: 6 } },
      { re: /黑白|去色/, d: { saturation: -100, vibrance: -100 }, preset: 'bw-classic' },
      { re: /人像|肤色|皮肤/, d: { temperature: 12, tint: 5, shadows: 10, vibrance: 8, clarity: -5 } },
      { re: /风景|风光|天空/, d: { clarity: 18, vibrance: 20, contrast: 10, blues: true } },
      { re: /食物|美食/, d: { saturation: 18, vibrance: 15, temperature: 15, contrast: 8 } },
      { re: /夜景|night|霓虹/, d: { contrast: 20, clarity: 15, vignette: 20, temperature: -15, tint: 12 } },
    ];

    for (const { re, d } of rules) {
      if (re.test(text)) {
        adj = mergeAdjustments(adj, d);
        if (d.preset) preset = d.preset;
      }
    }

    // 根据图像统计自动补偿
    if (/好看|优化|自动|增强|修一下|专业|调色/.test(text) || text.length < 4) {
      notes.push('已分析画面特征');
      if (stats.isDark) adj = mergeAdjustments(adj, { exposure: 0.25, shadows: 20, blacks: -8 });
      if (stats.isBright) adj = mergeAdjustments(adj, { exposure: -0.15, highlights: -18 });
      if (stats.isFlat) adj = mergeAdjustments(adj, { vibrance: 18, contrast: 10, clarity: 12 });
      if (stats.isVivid) adj = mergeAdjustments(adj, { vibrance: -8, highlights: -10 });
      if (!preset) preset = stats.isDark ? 'kodak-portra' : 'fuji-provia';
    }

    if (stats.isDark && /太暗/.test(text)) {
      adj = mergeAdjustments(adj, { exposure: 0.45, shadows: 28 });
    }

    const explanation = notes.length
      ? notes.join(' · ')
      : `已根据「${prompt.slice(0, 20)}」调整参数`;

    return { preset, presetStrength: 0.85, adjustments: adj, explanation, source: 'local' };
  }

  /** OpenAI 兼容 API（可选，支持视觉） */
  async function analyzeWithAPI(prompt, canvas, apiKey, baseUrl) {
    const stats = analyzeImageStats(canvas);
    const statHint = `画面分析：平均亮度${(stats.avgLum * 100).toFixed(0)}%，饱和度${(stats.avgSat * 100).toFixed(0)}%`;

    const system = `你是专业摄影调色师。根据用户描述和画面信息，输出严格 JSON（不要 markdown）：
{"exposure":0,"contrast":0,"highlights":0,"shadows":0,"whites":0,"blacks":0,"temperature":0,"tint":0,"vibrance":0,"saturation":0,"clarity":0,"vignette":0,"grain":0,"splitShadowHue":220,"splitShadowSat":0,"splitHighlightHue":40,"splitHighlightSat":0,"splitBalance":0,"preset":null,"explanation":"一句话中文说明"}
preset 可选值：${Object.keys(PRESETS).join(',')} 或 null
参数范围：exposure±2，其余±100，clarity/vignette/grain 0-100，色相0-360`;

    const messages = [{ role: 'system', content: system }];

    if (canvas && canvas.width) {
      const thumb = document.createElement('canvas');
      const scale = 512 / Math.max(canvas.width, canvas.height);
      thumb.width = Math.round(canvas.width * scale);
      thumb.height = Math.round(canvas.height * scale);
      thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
      const b64 = thumb.toDataURL('image/jpeg', 0.75);
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: `${statHint}\n用户需求：${prompt}` },
          { type: 'image_url', image_url: { url: b64, detail: 'low' } },
        ],
      });
    } else {
      messages.push({ role: 'user', content: `${statHint}\n用户需求：${prompt}` });
    }

    const url = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: canvas?.width ? 'gpt-4o-mini' : 'gpt-4o-mini',
        messages,
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error('API 错误: ' + res.status);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const json = JSON.parse(raw.replace(/```json|```/g, '').trim());
    const { preset, explanation, ...params } = json;
    return {
      preset: preset && PRESETS[preset] ? preset : null,
      presetStrength: 0.9,
      adjustments: params,
      explanation: explanation || 'AI 调色完成',
      source: 'api',
    };
  }

  async function analyze(prompt, canvas, options = {}) {
    const stats = analyzeImageStats(canvas);
    const apiKey = options.apiKey || localStorage.getItem(STORAGE_KEY);
    const baseUrl = options.baseUrl || localStorage.getItem(BASE_URL_KEY);

    if (apiKey && options.preferAPI !== false) {
      try {
        return await analyzeWithAPI(prompt, canvas, apiKey, baseUrl);
      } catch (e) {
        console.warn('AI API failed, fallback local', e);
        const local = analyzeLocal(prompt, stats);
        local.explanation = 'API 不可用，已用本地分析 · ' + local.explanation;
        return local;
      }
    }
    return analyzeLocal(prompt, stats);
  }

  function applyToEngine(engine, result, helpers = {}) {
    const { applyPresetGL, syncAllSliders, drawCurve } = helpers;
    const p = engine.params;
    const a = result.adjustments || {};

    if (result.preset && typeof applyPresetGL === 'function') {
      applyPresetGL(result.preset, result.presetStrength ?? 0.85);
      if (helpers.$presetStrength) helpers.$presetStrength.classList.remove('hidden');
      if (helpers.updateLookSelection) helpers.updateLookSelection();
    } else {
      engine.resetParams();
      if (helpers.$presetStrength) helpers.$presetStrength.classList.add('hidden');
      if (helpers.updateLookSelection) helpers.updateLookSelection();
    }

    for (const [k, v] of Object.entries(a)) {
      if (k === 'hsl' || k === 'blues' || typeof v !== 'number') continue;
      if (p[k] === undefined) continue;
      p[k] = clampParam(k, result.preset ? p[k] + v : v);
    }

    if (a.blues) {
      p.hsl.blue.s = 12;
      p.hsl.blue.l = -5;
      p.hsl.cyan.s = 8;
    }

    if (typeof syncAllSliders === 'function') syncAllSliders();
    if (typeof drawCurve === 'function') drawCurve();
    return result;
  }

  return {
    analyze,
    applyToEngine,
    analyzeImageStats,
    getApiKey: () => localStorage.getItem(STORAGE_KEY) || '',
    setApiKey: k => { if (k) localStorage.setItem(STORAGE_KEY, k); else localStorage.removeItem(STORAGE_KEY); },
    getBaseUrl: () => localStorage.getItem(BASE_URL_KEY) || '',
    setBaseUrl: u => { if (u) localStorage.setItem(BASE_URL_KEY, u); else localStorage.removeItem(BASE_URL_KEY); },
  };
})();

window.AIGrader = AIGrader;
