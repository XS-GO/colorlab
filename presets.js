/**
 * ColorLab Presets - 专业风格预设库
 * 每个预设是一组调整参数，模拟真实胶片和电影调色风格
 */
const PRESETS = {
  // ========== 富士胶片模拟 ==========
  'fuji-velvia': {
    name: 'Velvia 鲜艳',
    category: '胶片',
    desc: '富士 Velvia 50 — 高饱和、高对比度风光卷',
    icon: '🌈',
    adjustments: {
      exposure: 0.15,
      contrast: 18,
      highlights: -10,
      shadows: 5,
      saturation: 25,
      vibrance: 20,
      temperature: 8,
      tint: 2,
      clarity: 15,
      grain: 8,
      curve: [{x:0,y:3},{x:64,y:55},{x:128,y:135},{x:192,y:200},{x:255,y:250}],
      hsl: {
        red:    { h:5,  s:15, l:0 },
        orange: { h:-2, s:10, l:5 },
        yellow: { h:3,  s:12, l:-3 },
        green:  { h:8,  s:20, l:-5 },
        cyan:   { h:-5, s:5,  l:0 },
        blue:   { h:-3, s:10, l:3 },
        purple: { h:2,  s:8,  l:0 },
        magenta:{ h:0,  s:5,  l:0 },
      }
    },
  },

  'fuji-provia': {
    name: 'Provia 标准',
    category: '胶片',
    desc: '富士 Provia 100F — 自然柔和的标准正片',
    icon: '🎞️',
    adjustments: {
      exposure: 0.05,
      contrast: 8,
      highlights: -5,
      shadows: 3,
      saturation: 10,
      vibrance: 10,
      temperature: 3,
      tint: 1,
      clarity: 8,
      grain: 3,
      curve: [{x:0,y:2},{x:64,y:62},{x:128,y:130},{x:192,y:195},{x:255,y:252}],
      hsl: {
        red:    { h:2,  s:5,  l:0 },
        orange: { h:0,  s:3,  l:2 },
        yellow: { h:1,  s:5,  l:0 },
        green:  { h:3,  s:8,  l:-2 },
        cyan:   { h:-2, s:2,  l:0 },
        blue:   { h:0,  s:3,  l:0 },
        purple: { h:0,  s:2,  l:0 },
        magenta:{ h:0,  s:2,  l:0 },
      }
    },
  },

  'fuji-classic-chrome': {
    name: 'Classic Chrome',
    category: '胶片',
    desc: '富士 Classic Chrome — 低饱和、强对比纪实风格',
    icon: '📸',
    adjustments: {
      exposure: 0,
      contrast: 25,
      highlights: -20,
      shadows: 15,
      saturation: -20,
      vibrance: -10,
      temperature: 5,
      tint: -2,
      clarity: 20,
      grain: 15,
      curve: [{x:0,y:8},{x:64,y:50},{x:128,y:130},{x:192,y:208},{x:255,y:248}],
      hsl: {
        red:    { h:3,  s:-10, l:-3 },
        orange: { h:-2, s:-8,  l:0 },
        yellow: { h:0,  s:-15, l:0 },
        green:  { h:5,  s:-10, l:-5 },
        cyan:   { h:0,  s:-5,  l:0 },
        blue:   { h:-5, s:-8,  l:0 },
        purple: { h:0,  s:-5,  l:0 },
        magenta:{ h:0,  s:-5,  l:0 },
      }
    },
  },

  'fuji-astia': {
    name: 'Astia 柔和',
    category: '胶片',
    desc: '富士 Astia — 低对比、柔和肤色的人像卷',
    icon: '🌸',
    adjustments: {
      exposure: 0.2,
      contrast: -10,
      highlights: -15,
      shadows: 10,
      saturation: 5,
      vibrance: 8,
      temperature: 10,
      tint: 5,
      clarity: -5,
      grain: 5,
      curve: [{x:0,y:5},{x:64,y:68},{x:128,y:128},{x:192,y:188},{x:255,y:252}],
      hsl: {
        red:    { h:-3, s:-5,  l:5 },
        orange: { h:-2, s:-3,  l:3 },
        yellow: { h:0,  s:-5,  l:2 },
        green:  { h:0,  s:-3,  l:0 },
        cyan:   { h:0,  s:0,   l:0 },
        blue:   { h:0,  s:-5,  l:2 },
        purple: { h:0,  s:0,   l:0 },
        magenta:{ h:0,  s:-3,  l:0 },
      }
    },
  },

  // ========== 柯达胶片模拟 ==========
  'kodak-portra': {
    name: 'Portra 400',
    category: '胶片',
    desc: '柯达 Portra 400 — 温暖柔和、肤色优秀的人像卷',
    icon: '🎨',
    adjustments: {
      exposure: 0.1,
      contrast: -5,
      highlights: -12,
      shadows: 8,
      saturation: -5,
      vibrance: 5,
      temperature: 15,
      tint: 3,
      clarity: -3,
      grain: 6,
      curve: [{x:0,y:8},{x:64,y:70},{x:128,y:125},{x:192,y:188},{x:255,y:250}],
      hsl: {
        red:    { h:-2, s:-5,  l:5 },
        orange: { h:-1, s:-3,  l:3 },
        yellow: { h:2,  s:-8,  l:3 },
        green:  { h:3,  s:-5,  l:0 },
        cyan:   { h:0,  s:0,   l:0 },
        blue:   { h:0,  s:-8,  l:0 },
        purple: { h:0,  s:0,   l:0 },
        magenta:{ h:0,  s:-3,  l:0 },
      }
    },
  },

  'kodak-gold': {
    name: 'Gold 200',
    category: '胶片',
    desc: '柯达 Gold 200 — 温暖浓郁、黄金时刻质感',
    icon: '✨',
    adjustments: {
      exposure: 0.05,
      contrast: 15,
      highlights: -5,
      shadows: 5,
      saturation: 15,
      vibrance: 12,
      temperature: 20,
      tint: 0,
      clarity: 10,
      grain: 10,
      curve: [{x:0,y:0},{x:64,y:55},{x:128,y:133},{x:192,y:200},{x:255,y:255}],
      hsl: {
        red:    { h:3,  s:10, l:3 },
        orange: { h:2,  s:8,  l:5 },
        yellow: { h:5,  s:12, l:2 },
        green:  { h:5,  s:5,  l:-3 },
        cyan:   { h:0,  s:0,  l:0 },
        blue:   { h:-5, s:-5, l:-3 },
        purple: { h:0,  s:0,  l:0 },
        magenta:{ h:0,  s:3,  l:0 },
      }
    },
  },

  // ========== 电影调色 ==========
  'cinematic-teal-orange': {
    name: 'Teal & Orange',
    category: '电影',
    desc: '好莱坞经典青橙对比色 — 蓝色偏青、肤色偏橙',
    icon: '🎬',
    adjustments: {
      exposure: -0.1,
      contrast: 12,
      highlights: -8,
      shadows: 10,
      saturation: 10,
      vibrance: 15,
      temperature: 10,
      tint: -8,
      clarity: 15,
      grain: 5,
      curve: [{x:0,y:5},{x:64,y:58},{x:128,y:128},{x:192,y:200},{x:255,y:250}],
      hsl: {
        red:    { h:5,  s:15, l:5 },
        orange: { h:3,  s:12, l:3 },
        yellow: { h:2,  s:8,  l:0 },
        green:  { h:0,  s:-20, l:-5 },
        cyan:   { h:-5, s:10, l:0 },
        blue:   { h:-10,s:15, l:-5 },
        purple: { h:-5, s:0,  l:0 },
        magenta:{ h:0,  s:5,  l:0 },
      }
    },
  },

  'cinematic-blockbuster': {
    name: 'Blockbuster',
    category: '电影',
    desc: '好莱坞大片风格 — 高对比、深邃阴影、冷色调',
    icon: '🎥',
    adjustments: {
      exposure: -0.2,
      contrast: 30,
      highlights: -25,
      shadows: 20,
      saturation: 15,
      vibrance: 10,
      temperature: -15,
      tint: 5,
      clarity: 25,
      grain: 12,
      vignette: 25,
      curve: [{x:0,y:0},{x:64,y:40},{x:128,y:125},{x:192,y:210},{x:255,y:252}],
      hsl: {
        red:    { h:2,  s:10, l:-5 },
        orange: { h:0,  s:5,  l:-3 },
        yellow: { h:0,  s:0,  l:-5 },
        green:  { h:3,  s:5,  l:-8 },
        cyan:   { h:0,  s:15, l:-3 },
        blue:   { h:5,  s:20, l:-8 },
        purple: { h:0,  s:5,  l:0 },
        magenta:{ h:0,  s:3,  l:0 },
      }
    },
  },

  'cinematic-wes-anderson': {
    name: 'Wes Anderson',
    category: '电影',
    desc: '韦斯·安德森童话色调 — 高饱和、暖色、对称美学',
    icon: '🏰',
    adjustments: {
      exposure: 0.3,
      contrast: 5,
      highlights: -10,
      shadows: 15,
      saturation: 28,
      vibrance: 25,
      temperature: 22,
      tint: 8,
      clarity: 10,
      grain: 3,
      vignette: 10,
      curve: [{x:0,y:10},{x:64,y:72},{x:128,y:130},{x:192,y:192},{x:255,y:248}],
      hsl: {
        red:    { h:5,  s:20, l:8 },
        orange: { h:3,  s:15, l:5 },
        yellow: { h:5,  s:25, l:5 },
        green:  { h:8,  s:20, l:-3 },
        cyan:   { h:3,  s:10, l:0 },
        blue:   { h:0,  s:15, l:3 },
        purple: { h:2,  s:10, l:5 },
        magenta:{ h:0,  s:12, l:3 },
      }
    },
  },

  // ========== 日系 / 韩系 ==========
  'japanese-film': {
    name: '日系胶片',
    category: '日系',
    desc: '日系清新胶片 — 过曝、低对比、偏青、空气感',
    icon: '🗻',
    adjustments: {
      exposure: 0.8,
      contrast: -20,
      highlights: -30,
      shadows: 18,
      saturation: -10,
      vibrance: -5,
      temperature: -10,
      tint: 5,
      clarity: -10,
      grain: 8,
      vignette: 12,
      curve: [{x:0,y:15},{x:64,y:80},{x:128,y:125},{x:192,y:175},{x:255,y:245}],
      hsl: {
        red:    { h:-3, s:-15, l:10 },
        orange: { h:0,  s:-10, l:8 },
        yellow: { h:-2, s:-12, l:5 },
        green:  { h:5,  s:-15, l:8 },
        cyan:   { h:3,  s:5,   l:10 },
        blue:   { h:-5, s:-20, l:8 },
        purple: { h:0,  s:-10, l:5 },
        magenta:{ h:0,  s:-8,  l:3 },
      }
    },
  },

  'korean-drama': {
    name: '韩剧色调',
    category: '日系',
    desc: '韩剧暖光色调 — 温暖、柔焦、奶油肤色',
    icon: '💕',
    adjustments: {
      exposure: 0.4,
      contrast: -8,
      highlights: -20,
      shadows: 12,
      saturation: 8,
      vibrance: 12,
      temperature: 25,
      tint: 10,
      clarity: -8,
      grain: 4,
      vignette: 15,
      curve: [{x:0,y:12},{x:64,y:75},{x:128,y:128},{x:192,y:182},{x:255,y:250}],
      hsl: {
        red:    { h:-2, s:-3,  l:8 },
        orange: { h:0,  s:0,   l:5 },
        yellow: { h:3,  s:5,   l:5 },
        green:  { h:5,  s:-5,  l:3 },
        cyan:   { h:0,  s:0,   l:3 },
        blue:   { h:0,  s:-10, l:5 },
        purple: { h:0,  s:0,   l:3 },
        magenta:{ h:0,  s:0,   l:2 },
      }
    },
  },

  // ========== 复古 / 怀旧 ==========
  'vintage-warm': {
    name: '暖调复古',
    category: '复古',
    desc: '60年代胶片褪色 — 暖黄调、褪色感、颗粒',
    icon: '📷',
    adjustments: {
      exposure: 0.2,
      contrast: -15,
      highlights: -25,
      shadows: 20,
      saturation: -30,
      vibrance: -20,
      temperature: 35,
      tint: 15,
      clarity: -15,
      grain: 30,
      vignette: 30,
      curve: [{x:0,y:20},{x:64,y:85},{x:128,y:120},{x:192,y:175},{x:255,y:230}],
      hsl: {
        red:    { h:8,  s:-20, l:5 },
        orange: { h:5,  s:-15, l:3 },
        yellow: { h:5,  s:-10, l:5 },
        green:  { h:5,  s:-25, l:0 },
        cyan:   { h:0,  s:-10, l:3 },
        blue:   { h:-5, s:-25, l:0 },
        purple: { h:0,  s:-15, l:3 },
        magenta:{ h:0,  s:-10, l:0 },
      }
    },
  },

  'vintage-cool': {
    name: '冷调文艺',
    category: '复古',
    desc: '褪色蓝调 — 文艺范、冷峻、胶片褪色',
    icon: '🌊',
    adjustments: {
      exposure: 0.3,
      contrast: -10,
      highlights: -20,
      shadows: 15,
      saturation: -25,
      vibrance: -15,
      temperature: -30,
      tint: -8,
      clarity: -10,
      grain: 25,
      vignette: 25,
      curve: [{x:0,y:18},{x:64,y:80},{x:128,y:122},{x:192,y:178},{x:255,y:235}],
      hsl: {
        red:    { h:-5, s:-15, l:5 },
        orange: { h:0,  s:-10, l:3 },
        yellow: { h:-3, s:-12, l:5 },
        green:  { h:0,  s:-20, l:3 },
        cyan:   { h:-3, s:0,   l:5 },
        blue:   { h:3,  s:-10, l:5 },
        purple: { h:0,  s:-10, l:3 },
        magenta:{ h:0,  s:-8,  l:0 },
      }
    },
  },

  'vintage-polaroid': {
    name: '拍立得',
    category: '复古',
    desc: '宝丽来质感 — 柔焦、低对比、暖白、大暗角',
    icon: '🖼️',
    adjustments: {
      exposure: 0.5,
      contrast: -25,
      highlights: -35,
      shadows: 25,
      saturation: -15,
      vibrance: -10,
      temperature: 20,
      tint: 5,
      clarity: -20,
      grain: 15,
      vignette: 40,
      curve: [{x:0,y:25},{x:64,y:90},{x:128,y:118},{x:192,y:168},{x:255,y:235}],
      hsl: {
        red:    { h:0,  s:-10, l:8 },
        orange: { h:2,  s:-8,  l:5 },
        yellow: { h:3,  s:-10, l:5 },
        green:  { h:3,  s:-15, l:3 },
        cyan:   { h:0,  s:-5,  l:3 },
        blue:   { h:0,  s:-15, l:3 },
        purple: { h:0,  s:-5,  l:3 },
        magenta:{ h:0,  s:-5,  l:2 },
      }
    },
  },

  // ========== 黑白 ==========
  'bw-classic': {
    name: '经典黑白',
    category: '黑白',
    desc: '经典红滤镜黑白 — 高对比、深邃阴影、天空压暗',
    icon: '⬛',
    adjustments: {
      exposure: 0,
      contrast: 25,
      highlights: -15,
      shadows: 10,
      saturation: -100,
      vibrance: -100,
      clarity: 20,
      grain: 12,
      vignette: 15,
      curve: [{x:0,y:5},{x:64,y:48},{x:128,y:128},{x:192,y:210},{x:255,y:252}],
      hsl: {
        red:    { h:0, s:-100, l:-10 },
        orange: { h:0, s:-100, l:-5 },
        yellow: { h:0, s:-100, l:5 },
        green:  { h:0, s:-100, l:-10 },
        cyan:   { h:0, s:-100, l:-5 },
        blue:   { h:0, s:-100, l:-10 },
        purple: { h:0, s:-100, l:0 },
        magenta:{ h:0, s:-100, l:0 },
      }
    },
  },

  'bw-film-noir': {
    name: 'Film Noir',
    category: '黑白',
    desc: '黑色电影风格 — 极高反差、浓重黑色、戏剧光影',
    icon: '🎭',
    adjustments: {
      exposure: -0.3,
      contrast: 45,
      highlights: -30,
      shadows: 25,
      saturation: -100,
      vibrance: -100,
      clarity: 35,
      grain: 25,
      vignette: 35,
      curve: [{x:0,y:0},{x:64,y:30},{x:128,y:125},{x:192,y:220},{x:255,y:255}],
      hsl: {
        red:    { h:0, s:-100, l:-15 },
        orange: { h:0, s:-100, l:-10 },
        yellow: { h:0, s:-100, l:10 },
        green:  { h:0, s:-100, l:-15 },
        cyan:   { h:0, s:-100, l:-10 },
        blue:   { h:0, s:-100, l:-20 },
        purple: { h:0, s:-100, l:-5 },
        magenta:{ h:0, s:-100, l:-5 },
      }
    },
  },

  // ========== 情绪氛围 ==========
  'moody-cinematic': {
    name: '暗调电影',
    category: '情绪',
    desc: '暗调情绪 — 深阴影、冷色调、高级灰',
    icon: '🌑',
    adjustments: {
      exposure: -0.5,
      contrast: 15,
      highlights: -30,
      shadows: 25,
      saturation: -15,
      vibrance: -10,
      temperature: -20,
      tint: 3,
      clarity: 20,
      grain: 18,
      vignette: 30,
      curve: [{x:0,y:0},{x:64,y:35},{x:128,y:120},{x:192,y:205},{x:255,y:248}],
      hsl: {
        red:    { h:-3, s:-10, l:-8 },
        orange: { h:0,  s:-8,  l:-5 },
        yellow: { h:0,  s:-15, l:-5 },
        green:  { h:3,  s:-15, l:-10 },
        cyan:   { h:0,  s:-5,  l:-3 },
        blue:   { h:3,  s:-10, l:-10 },
        purple: { h:0,  s:-5,  l:-3 },
        magenta:{ h:0,  s:-8,  l:-5 },
      }
    },
  },

  'cyberpunk': {
    name: '赛博朋克',
    category: '情绪',
    desc: '赛博朋克 — 洋红/青色霓虹、高对比、冷峻',
    icon: '🌃',
    adjustments: {
      exposure: -0.3,
      contrast: 30,
      highlights: -20,
      shadows: 15,
      saturation: 20,
      vibrance: 18,
      temperature: -25,
      tint: 20,
      clarity: 25,
      grain: 10,
      vignette: 20,
      curve: [{x:0,y:5},{x:64,y:42},{x:128,y:128},{x:192,y:215},{x:255,y:250}],
      hsl: {
        red:    { h:-5, s:10, l:-5 },
        orange: { h:0,  s:8,  l:-3 },
        yellow: { h:-3, s:0,  l:-5 },
        green:  { h:0,  s:-10, l:-8 },
        cyan:   { h:5,  s:25, l:5 },
        blue:   { h:#N/A, s:20, l:-5 },
        purple: { h:5,  s:25, l:5 },
        magenta:{ h:8,  s:30, l:8 },
      }
    },
  },

  'golden-hour': {
    name: '黄金时刻',
    category: '情绪',
    desc: '日落金光 — 极致温暖、柔光溢出、梦幻',
    icon: '🌅',
    adjustments: {
      exposure: 0.3,
      contrast: -5,
      highlights: -25,
      shadows: 15,
      saturation: 20,
      vibrance: 25,
      temperature: 40,
      tint: 20,
      clarity: -5,
      grain: 8,
      vignette: 20,
      curve: [{x:0,y:10},{x:64,y:72},{x:128,y:132},{x:192,y:190},{x:255,y:248}],
      hsl: {
        red:    { h:5,  s:20, l:10 },
        orange: { h:3,  s:25, l:8 },
        yellow: { h:5,  s:25, l:8 },
        green:  { h:8,  s:10, l:0 },
        cyan:   { h:3,  s:5,  l:3 },
        blue:   { h:-5, s:-10, l:0 },
        purple: { h:2,  s:8,  l:5 },
        magenta:{ h:3,  s:10, l:5 },
      }
    },
  },
};

// 修复 cyberpunk blue 的一个无效值
PRESETS['cyberpunk'].adjustments.hsl.blue.h = 10;

/**
 * 应用预设到引擎
 */
function applyPreset(engine, presetKey, intensity = 1.0) {
  const preset = PRESETS[presetKey];
  if (!preset) return;

  const adj = preset.adjustments;

  // 基本调整
  engine.adj.exposure    = adj.exposure * intensity;
  engine.adj.contrast    = adj.contrast * intensity;
  engine.adj.highlights  = adj.highlights * intensity;
  engine.adj.shadows     = adj.shadows * intensity;
  engine.adj.whites      = (adj.whites || 0) * intensity;
  engine.adj.blacks      = (adj.blacks || 0) * intensity;
  engine.adj.temperature = adj.temperature * intensity;
  engine.adj.tint        = adj.tint * intensity;
  engine.adj.vibrance    = adj.vibrance * intensity;
  engine.adj.saturation  = adj.saturation * intensity;
  engine.adj.clarity     = adj.clarity * intensity;
  engine.adj.sharpening  = (adj.sharpening || 0) * intensity;
  engine.adj.grain       = (adj.grain || 0) * intensity;
  engine.adj.vignette    = (adj.vignette || 0) * intensity;

  // 曲线
  if (adj.curve) {
    engine.setCurveFromPoints(adj.curve);
  } else {
    engine.resetCurves();
  }

  // HSL
  if (adj.hsl) {
    for (const ch of Object.keys(engine.adj.hsl)) {
      if (adj.hsl[ch]) {
        engine.adj.hsl[ch].h = adj.hsl[ch].h * intensity;
        engine.adj.hsl[ch].s = adj.hsl[ch].s * intensity;
        engine.adj.hsl[ch].l = adj.hsl[ch].l * intensity;
      }
    }
  }

  engine.presetActive = presetKey;
  engine.presetIntensity = intensity;
  engine.currentPresetName = preset.name;
}

/**
 * 重置所有引擎调整为默认值
 */
function resetEngine(engine) {
  engine.adj.exposure = 0;
  engine.adj.contrast = 0;
  engine.adj.highlights = 0;
  engine.adj.shadows = 0;
  engine.adj.whites = 0;
  engine.adj.blacks = 0;
  engine.adj.temperature = 0;
  engine.adj.tint = 0;
  engine.adj.vibrance = 0;
  engine.adj.saturation = 0;
  engine.adj.clarity = 0;
  engine.adj.sharpening = 0;
  engine.adj.vignette = 0;
  engine.adj.grain = 0;
  engine.resetCurves();
  for (const ch of Object.keys(engine.adj.hsl)) {
    engine.adj.hsl[ch] = { h: 0, s: 0, l: 0 };
  }
  engine.presetActive = null;
  engine.presetIntensity = 0;
  engine.currentPresetName = null;
}
