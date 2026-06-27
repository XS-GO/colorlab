/**
 * ColorLab Pro — App Controller
 */
(function () {
  'use strict';

  const $canvas = document.getElementById('canvas');
  const $canvasOrig = document.getElementById('canvas-original');
  const $empty = document.getElementById('empty');
  const $compareBadge = document.getElementById('compare-badge');
  const $toast = document.getElementById('toast');
  const $overlay = document.getElementById('overlay');
  const $curveCanvas = document.getElementById('curve-canvas');
  const $lookGrid = document.getElementById('look-grid');
  const $presetCats = document.getElementById('preset-cats');
  const $presetStrength = document.getElementById('preset-strength');
  const $hslParams = document.getElementById('hsl-params');

  let engine, hasImage = false, currentPreset = null, presetStrength = 1;
  let hslChannel = 'red', curveChannel = 'master';
  let rafId = null, draggingHistory = false;
  const undoStack = [], redoStack = [];
  const MAX_HIST = 40;

  /* ── Init ── */
  try {
    engine = new GLEngine($canvas);
  } catch (e) {
    alert('您的设备不支持 WebGL，无法运行 ColorLab Pro');
    return;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=5').then(reg => reg.update()).catch(() => {});
  }

  function setOverlay(open) {
    $overlay.classList.toggle('is-open', open);
    $overlay.style.display = open ? 'grid' : 'none';
    $overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  setOverlay(false);

  /* ── Toast ── */
  let toastT;
  function toast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => $toast.classList.remove('show'), 1800);
  }

  /* ── Render (rAF throttle) ── */
  function scheduleRender() {
    if (!hasImage) return;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      engine.render(false);
      rafId = null;
    });
  }

  /* ── History ── */
  function snapshot() {
    return JSON.stringify({
      params: engine.params,
      curveMaster: Array.from(engine.curveMaster),
      curveR: Array.from(engine.curveR),
      curveG: Array.from(engine.curveG),
      curveB: Array.from(engine.curveB),
      currentPreset,
      presetStrength,
    });
  }

  function pushHistory() {
    undoStack.push(snapshot());
    if (undoStack.length > MAX_HIST) undoStack.shift();
    redoStack.length = 0;
  }

  function restore(json) {
    const s = JSON.parse(json);
    engine.params = s.params;
    engine.curveMaster = new Uint8Array(s.curveMaster);
    engine.curveR = new Uint8Array(s.curveR);
    engine.curveG = new Uint8Array(s.curveG);
    engine.curveB = new Uint8Array(s.curveB);
    engine._curveDirty = true;
    currentPreset = s.currentPreset;
    presetStrength = s.presetStrength;
    syncAllSliders();
    drawCurve();
    scheduleRender();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
    toast('已撤销');
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
    toast('已重做');
  }

  /* ── Sliders ── */
  function fmtVal(key, val) {
    if (key === 'exposure') return val.toFixed(2);
    if (key === 'splitShadowHue' || key === 'splitHighlightHue') return Math.round(val) + '°';
    return Math.round(val).toString();
  }

  function bindParams() {
    document.querySelectorAll('.param[data-key]').forEach(el => {
      const key = el.dataset.key;
      if (key === 'presetStrength') return;
      const slider = el.querySelector('.param-slider');
      const output = el.querySelector('output');
      const min = parseFloat(el.dataset.min);
      const max = parseFloat(el.dataset.max);
      const step = parseFloat(el.dataset.step);

      slider.min = min; slider.max = max; slider.step = step;

      const apply = () => {
        let val = parseFloat(slider.value);
        if (key === 'exposure') engine.params.exposure = val;
        else engine.params[key] = val;
        output.textContent = fmtVal(key, val);
        if (currentPreset) { currentPreset = null; updateLookSelection(); $presetStrength.classList.add('hidden'); }
        scheduleRender();
      };

      slider.addEventListener('input', apply);
      slider.addEventListener('pointerdown', () => { draggingHistory = true; });
      slider.addEventListener('pointerup', () => {
        if (draggingHistory) { pushHistory(); draggingHistory = false; }
      });
    });
  }

  function syncAllSliders() {
    document.querySelectorAll('.param[data-key]').forEach(el => {
      const key = el.dataset.key;
      if (key === 'presetStrength') return;
      const slider = el.querySelector('.param-slider');
      const output = el.querySelector('output');
      let val = key === 'exposure' ? engine.params.exposure : engine.params[key];
      if (val === undefined) return;
      slider.value = val;
      output.textContent = fmtVal(key, val);
    });
    syncHSLSliders();
  }

  /* ── Tool panels ── */
  document.getElementById('tool-rail').addEventListener('click', e => {
    const btn = e.target.closest('.tool');
    if (!btn) return;
    document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const tool = btn.dataset.tool;
    document.querySelectorAll('.tool-panel').forEach(p => {
      p.classList.toggle('active', p.dataset.panel === tool);
    });
  });

  /* ── Import ── */
  document.getElementById('file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      toast('正在加载…');
      const img = await loadOrientedImage(file);
      engine.loadImage(img);
      engine.resetParams();
      currentPreset = null;
      $canvas.style.display = 'block';
      $empty.style.display = 'none';

      $canvasOrig.width = engine.previewW;
      $canvasOrig.height = engine.previewH;
      $canvasOrig.getContext('2d').drawImage(img, 0, 0, engine.previewW, engine.previewH);

      hasImage = true;
      undoStack.length = 0;
      redoStack.length = 0;
      initCurvePoints();
      syncAllSliders();
      scheduleRender();
      toast('已加载 · GPU 就绪');
    } catch (err) {
      toast('图片加载失败');
      console.error(err);
    }
  });

  document.getElementById('btn-import').onclick = () => document.getElementById('file-input').click();

  /* ── Compare ── */
  let compareTimer;
  const viewport = document.getElementById('viewport');

  function showOriginal(show) {
    $canvas.style.visibility = show ? 'hidden' : 'visible';
    $canvasOrig.classList.toggle('hidden', !show);
    $compareBadge.style.display = show ? 'block' : 'none';
  }

  function startCompare() { if (hasImage) showOriginal(true); }
  function stopCompare() { showOriginal(false); }

  viewport.addEventListener('touchstart', () => { compareTimer = setTimeout(startCompare, 120); });
  viewport.addEventListener('touchend', () => { clearTimeout(compareTimer); stopCompare(); });
  viewport.addEventListener('touchcancel', () => { clearTimeout(compareTimer); stopCompare(); });
  viewport.addEventListener('mousedown', () => { compareTimer = setTimeout(startCompare, 120); });
  viewport.addEventListener('mouseup', () => { clearTimeout(compareTimer); stopCompare(); });
  viewport.addEventListener('mouseleave', () => { clearTimeout(compareTimer); stopCompare(); });

  document.getElementById('btn-compare').addEventListener('touchstart', startCompare);
  document.getElementById('btn-compare').addEventListener('touchend', stopCompare);
  document.getElementById('btn-compare').addEventListener('mousedown', startCompare);
  document.getElementById('btn-compare').addEventListener('mouseup', stopCompare);

  document.getElementById('btn-undo').onclick = undo;
  document.getElementById('btn-redo').onclick = redo;

  /* ── Reset ── */
  document.getElementById('btn-reset').onclick = () => {
    if (!hasImage) return;
    pushHistory();
    engine.resetParams();
    currentPreset = null;
    initCurvePoints();
    syncAllSliders();
    updateLookSelection();
    $presetStrength.classList.add('hidden');
    scheduleRender();
    toast('已重置');
  };

  /* ── Export ── */
  let exporting = false;
  document.getElementById('btn-export').onclick = async () => {
    if (!hasImage) { toast('请先导入照片'); return; }
    if (exporting) return;
    exporting = true;
    setOverlay(true);
    try {
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const off = engine.exportFullRes();
      if (!off) throw new Error('export failed');
      await new Promise((resolve, reject) => {
        off.toBlob(async blob => {
          if (!blob) { reject(new Error('blob failed')); return; }
          try {
            const file = new File([blob], 'ColorLab_' + Date.now() + '.jpg', { type: 'image/jpeg' });
            if (navigator.share && navigator.canShare?.({ files: [file] })) {
              try { await navigator.share({ files: [file] }); toast('已导出'); }
              catch (err) { if (err.name !== 'AbortError') download(file); }
            } else download(file);
            resolve();
          } catch (e) { reject(e); }
        }, 'image/jpeg', 0.95);
      });
    } catch (err) {
      toast('导出失败');
    } finally {
      setOverlay(false);
      exporting = false;
    }
  };

  function download(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('已保存');
  }

  /* ── Curve editor ── */
  let curvePoints = [];
  const curveCtx = $curveCanvas.getContext('2d');
  let dragIdx = -1;

  const DEFAULT_CURVE = [
    { x: 0, y: 0 }, { x: 64, y: 64 }, { x: 128, y: 128 }, { x: 192, y: 192 }, { x: 255, y: 255 }
  ];

  function initCurvePoints() {
    curvePoints = DEFAULT_CURVE.map(p => ({ ...p }));
    applyCurve();
    drawCurve();
  }

  function applyCurve() {
    engine.setCurveFromPoints(curvePoints, curveChannel === 'master' ? 'master' : curveChannel);
    engine.params.curveChannel = curveChannel === 'master' ? 0 : 1;
    scheduleRender();
  }

  function drawCurve() {
    const w = $curveCanvas.width, h = $curveCanvas.height;
    curveCtx.clearRect(0, 0, w, h);

    // Grid
    curveCtx.strokeStyle = 'rgba(0,212,255,0.08)';
    for (let i = 1; i < 4; i++) {
      curveCtx.beginPath();
      curveCtx.moveTo(w * i / 4, 0); curveCtx.lineTo(w * i / 4, h);
      curveCtx.moveTo(0, h * i / 4); curveCtx.lineTo(w, h * i / 4);
      curveCtx.stroke();
    }

    // Diagonal reference
    curveCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    curveCtx.beginPath();
    curveCtx.moveTo(0, h); curveCtx.lineTo(w, 0);
    curveCtx.stroke();

    // Curve line
    const lut = curveChannel === 'master' ? engine.curveMaster :
      engine['curve' + curveChannel];
    if (!lut) return;
    curveCtx.strokeStyle = curveChannel === 'R' ? '#ff4444' :
      curveChannel === 'G' ? '#44ff44' :
      curveChannel === 'B' ? '#4488ff' : '#00d4ff';
    curveCtx.lineWidth = 2;
    curveCtx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * w;
      const y = h - (lut[i] / 255) * h;
      i === 0 ? curveCtx.moveTo(x, y) : curveCtx.lineTo(x, y);
    }
    curveCtx.stroke();

    // Control points
    curvePoints.forEach((p, i) => {
      const px = (p.x / 255) * w;
      const py = h - (p.y / 255) * h;
      curveCtx.beginPath();
      curveCtx.arc(px, py, i === 0 || i === curvePoints.length - 1 ? 5 : 7, 0, Math.PI * 2);
      curveCtx.fillStyle = i === dragIdx ? '#fff' : 'rgba(0,212,255,0.8)';
      curveCtx.fill();
      curveCtx.strokeStyle = '#fff';
      curveCtx.lineWidth = 1.5;
      curveCtx.stroke();
    });
  }

  function canvasPos(e) {
    const rect = $curveCanvas.getBoundingClientRect();
    const scaleX = $curveCanvas.width / rect.width;
    const scaleY = $curveCanvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
      w: $curveCanvas.width,
      h: $curveCanvas.height,
    };
  }

  function onCurveDown(e) {
    e.preventDefault();
    const { x, y, w, h } = canvasPos(e);
    dragIdx = -1;
    let best = 20;
    curvePoints.forEach((p, i) => {
      const px = (p.x / 255) * w, py = h - (p.y / 255) * h;
      const d = Math.hypot(x - px, y - py);
      if (d < best) { best = d; dragIdx = i; }
    });
  }

  function onCurveMove(e) {
    if (dragIdx < 0) return;
    e.preventDefault();
    const { x, y, w, h } = canvasPos(e);
    let nx = Math.round(Math.max(0, Math.min(255, (x / w) * 255)));
    let ny = Math.round(Math.max(0, Math.min(255, (1 - y / h) * 255)));
    // Lock endpoints x
    if (dragIdx === 0) nx = 0;
    if (dragIdx === curvePoints.length - 1) nx = 255;
    // Keep x monotonic
    if (dragIdx > 0) nx = Math.max(nx, curvePoints[dragIdx - 1].x + 1);
    if (dragIdx < curvePoints.length - 1) nx = Math.min(nx, curvePoints[dragIdx + 1].x - 1);
    curvePoints[dragIdx] = { x: nx, y: ny };
    applyCurve();
    drawCurve();
  }

  function onCurveUp() {
    if (dragIdx >= 0) pushHistory();
    dragIdx = -1;
  }

  $curveCanvas.addEventListener('mousedown', onCurveDown);
  $curveCanvas.addEventListener('mousemove', onCurveMove);
  $curveCanvas.addEventListener('mouseup', onCurveUp);
  $curveCanvas.addEventListener('touchstart', onCurveDown, { passive: false });
  $curveCanvas.addEventListener('touchmove', onCurveMove, { passive: false });
  $curveCanvas.addEventListener('touchend', onCurveUp);

  document.querySelectorAll('.curve-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.curve-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      curveChannel = tab.dataset.ch;
      engine.params.curveChannel = curveChannel === 'master' ? 0 : 1;
      initCurvePoints();
    });
  });

  document.getElementById('curve-reset').onclick = () => {
    pushHistory();
    initCurvePoints();
    toast('曲线已重置');
  };

  /* ── HSL ── */
  function buildHSLPanel() {
    $hslParams.innerHTML = `
      <div class="param" data-hsl="h" data-min="-30" data-max="30" data-step="1">
        <label>色相</label><output>0</output>
        <input type="range" class="param-slider" value="0">
      </div>
      <div class="param" data-hsl="s" data-min="-100" data-max="100" data-step="1">
        <label>饱和</label><output>0</output>
        <input type="range" class="param-slider" value="0">
      </div>
      <div class="param" data-hsl="l" data-min="-100" data-max="100" data-step="1">
        <label>明度</label><output>0</output>
        <input type="range" class="param-slider" value="0">
      </div>`;

    $hslParams.querySelectorAll('.param').forEach(el => {
      const prop = el.dataset.hsl;
      const slider = el.querySelector('.param-slider');
      const output = el.querySelector('output');
      slider.min = el.dataset.min;
      slider.max = el.dataset.max;
      slider.step = el.dataset.step;

      slider.addEventListener('input', () => {
        engine.params.hsl[hslChannel][prop] = parseFloat(slider.value);
        output.textContent = slider.value;
        if (currentPreset) { currentPreset = null; updateLookSelection(); }
        scheduleRender();
      });
      slider.addEventListener('pointerup', () => pushHistory());
    });
  }

  function syncHSLSliders() {
    if (!$hslParams.children.length) return;
    const hsl = engine.params.hsl[hslChannel];
    const props = ['h', 's', 'l'];
    $hslParams.querySelectorAll('.param').forEach((el, i) => {
      const slider = el.querySelector('.param-slider');
      const output = el.querySelector('output');
      slider.value = hsl[props[i]];
      output.textContent = hsl[props[i]];
    });
  }

  document.getElementById('hsl-chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('#hsl-chips .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    hslChannel = chip.dataset.ch;
    syncHSLSliders();
  });

  /* ── Presets ── */
  function buildPresets() {
    const cats = new Set(Object.values(PRESETS).map(p => p.category));
    $presetCats.innerHTML = '<button class="chip active" data-cat="all">全部</button>';
    cats.forEach(cat => {
      const b = document.createElement('button');
      b.className = 'chip'; b.dataset.cat = cat; b.textContent = cat;
      $presetCats.appendChild(b);
    });

    $presetCats.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      $presetCats.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      renderLooks(chip.dataset.cat);
    });

    renderLooks('all');

    const strSlider = $presetStrength.querySelector('.param-slider');
    strSlider.addEventListener('input', () => {
      presetStrength = parseInt(strSlider.value) / 100;
      $presetStrength.querySelector('output').textContent = strSlider.value;
      if (currentPreset) {
        applyPresetGL(currentPreset, presetStrength);
        syncAllSliders();
        scheduleRender();
      }
    });
    strSlider.addEventListener('pointerup', () => pushHistory());
  }

  function renderLooks(cat) {
    $lookGrid.innerHTML = '';
    Object.entries(PRESETS).forEach(([key, p]) => {
      if (cat !== 'all' && p.category !== cat) return;
      const card = document.createElement('div');
      card.className = 'look-card' + (currentPreset === key ? ' active' : '');
      card.dataset.key = key;
      card.innerHTML = `<strong>${p.name}</strong><small>${p.desc}</small><div class="tag">${p.category}</div>`;
      card.onclick = () => selectLook(key);
      $lookGrid.appendChild(card);
    });
  }

  function updateLookSelection() {
    $lookGrid.querySelectorAll('.look-card').forEach(c => {
      c.classList.toggle('active', c.dataset.key === currentPreset);
    });
  }

  function selectLook(key) {
    if (currentPreset === key) {
      currentPreset = null;
      engine.resetParams();
      initCurvePoints();
      syncAllSliders();
      $presetStrength.classList.add('hidden');
      updateLookSelection();
      pushHistory();
      scheduleRender();
      toast('已取消风格');
      return;
    }
    currentPreset = key;
    presetStrength = parseInt($presetStrength.querySelector('.param-slider').value) / 100;
    applyPresetGL(key, presetStrength);
    syncAllSliders();
    drawCurve();
    $presetStrength.classList.remove('hidden');
    updateLookSelection();
    pushHistory();
    scheduleRender();
    toast(PRESETS[key].name);
  }

  function applyPresetGL(key, intensity) {
    applyPreset(engine, key, intensity);
    const adj = PRESETS[key]?.adjustments;
    if (adj?.curve) {
      curvePoints = adj.curve.map(p => ({ ...p }));
    } else {
      curvePoints = DEFAULT_CURVE.map(p => ({ ...p }));
    }
  }

  /* ── Boot ── */
  bindParams();
  buildHSLPanel();
  buildPresets();
  initCurvePoints();

  console.log('%c ColorLab Pro %c GPU Ready ', 'background:#00d4ff;color:#000;font-weight:bold', 'color:#6b7a99');
})();
