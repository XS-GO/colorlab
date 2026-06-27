/**
 * ColorLab Pro — App Controller
 */
(function () {
  'use strict';

  if (!window.PRESETS) {
    alert('ColorLab 加载失败：presets.js 未正确加载，请刷新页面');
    return;
  }
  const PRESETS = window.PRESETS;

  const $canvas = document.getElementById('canvas');
  const $canvasOrig = document.getElementById('canvas-original');
  const $canvasClip = document.getElementById('canvas-clip');
  const $compareHandle = document.getElementById('compare-handle');
  const $histogram = document.getElementById('histogram');
  const $btnUndo = document.getElementById('btn-undo');
  const $btnRedo = document.getElementById('btn-redo');
  const $btnCompare = document.getElementById('btn-compare');
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
  let rafId = null;
  const histPast = [], histFuture = [];
  const MAX_HIST = 40;
  let sourceImg = null, userRotation = 0, flipH = false;
  let compareMode = false, compareSplit = 50;
  let showHistogram = false;
  let histDrag = false, compareDrag = false;

  /* ── Init ── */
  try {
    engine = new GLEngine($canvas);
  } catch (e) {
    alert('您的设备不支持 WebGL，无法运行 ColorLab Pro');
    return;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js?v=10').then(reg => reg.update()).catch(() => {});
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
      curvePoints: curvePoints.map(p => ({ ...p })),
      currentPreset,
      presetStrength,
    });
  }

  function pushHistory() {
    histPast.push(snapshot());
    if (histPast.length > MAX_HIST) histPast.shift();
    histFuture.length = 0;
    updateHeaderState();
  }

  function beginEdit() {
    if (!histDrag) {
      histPast.push(snapshot());
      if (histPast.length > MAX_HIST) histPast.shift();
      histFuture.length = 0;
      histDrag = true;
      updateHeaderState();
    }
  }

  function endEdit() {
    histDrag = false;
    updateHeaderState();
  }

  function updateHeaderState() {
    if ($btnUndo) $btnUndo.disabled = !hasImage || histPast.length === 0;
    if ($btnRedo) $btnRedo.disabled = !hasImage || histFuture.length === 0;
    if ($btnCompare) $btnCompare.classList.toggle('is-on', compareMode);
  }

  function restore(json) {
    const s = JSON.parse(json);
    engine.params = s.params;
    engine.curveMaster = new Uint8Array(s.curveMaster);
    engine.curveR = new Uint8Array(s.curveR);
    engine.curveG = new Uint8Array(s.curveG);
    engine.curveB = new Uint8Array(s.curveB);
    engine._curveDirty = true;
    if (s.curvePoints) curvePoints = s.curvePoints.map(p => ({ ...p }));
    currentPreset = s.currentPreset;
    presetStrength = s.presetStrength;
    syncAllSliders();
    drawCurve();
    scheduleRender();
  }

  function undo() {
    if (!hasImage) { toast('请先导入照片'); return; }
    if (!histPast.length) { toast('没有可撤销的操作'); return; }
    histFuture.unshift(snapshot());
    restore(histPast.pop());
    updateHeaderState();
    drawHistogram();
    toast('已撤销');
  }

  function redo() {
    if (!hasImage) { toast('请先导入照片'); return; }
    if (!histFuture.length) { toast('没有可重做'); return; }
    histPast.push(snapshot());
    restore(histFuture.shift());
    updateHeaderState();
    drawHistogram();
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
      slider.addEventListener('pointerdown', beginEdit);
      slider.addEventListener('pointerup', endEdit);
      slider.addEventListener('pointercancel', endEdit);
      slider.addEventListener('dblclick', () => {
        const def = key === 'exposure' ? 0 :
          (key === 'splitShadowHue' ? 220 : key === 'splitHighlightHue' ? 40 : 0);
        slider.value = def;
        apply();
        toast('已重置 ' + el.querySelector('label').textContent);
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

  /* ── Image source / transform ── */
  function renderSourceToCanvas(img) {
    const rot = userRotation % 360;
    const swap = rot === 90 || rot === 270;
    const cw = swap ? img.height : img.width;
    const ch = swap ? img.width : img.height;
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d');
    ctx.translate(cw / 2, ch / 2);
    ctx.rotate(rot * Math.PI / 180);
    ctx.scale(flipH ? -1 : 1, 1);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    return c;
  }

  async function applySourceImage() {
    if (!sourceImg) return;
    const savedParams = JSON.parse(JSON.stringify(engine.params));
    const savedCurves = {
      master: Array.from(engine.curveMaster || []),
      R: Array.from(engine.curveR || []),
      G: Array.from(engine.curveG || []),
      B: Array.from(engine.curveB || []),
    };
    const canvas = renderSourceToCanvas(sourceImg);
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = canvas.toDataURL('image/jpeg', 0.92);
    });
    engine.loadImage(img);
    engine.params = savedParams;
    if (savedCurves.master.length === 256) {
      engine.curveMaster = new Uint8Array(savedCurves.master);
      engine.curveR = new Uint8Array(savedCurves.R);
      engine.curveG = new Uint8Array(savedCurves.G);
      engine.curveB = new Uint8Array(savedCurves.B);
      engine._curveDirty = true;
    }
    $canvasOrig.width = engine.previewW;
    $canvasOrig.height = engine.previewH;
    $canvasOrig.getContext('2d').drawImage(img, 0, 0, engine.previewW, engine.previewH);
    $canvas.style.display = 'block';
    syncCanvasLayout();
    scheduleRender();
    drawHistogram();
  }

  function syncCanvasLayout() {
    if (!$canvas.width) return;
    const ratio = $canvas.width / $canvas.height;
    const vp = document.getElementById('viewport');
    const vw = vp.clientWidth, vh = vp.clientHeight;
    let dw = vw, dh = dw / ratio;
    if (dh > vh) { dh = vh; dw = dh * ratio; }
    [$canvas, $canvasOrig].forEach(c => {
      c.style.width = dw + 'px';
      c.style.height = dh + 'px';
    });
    updateCompareSplit(compareSplit);
  }

  function updateCompareSplit(pct) {
    compareSplit = Math.max(8, Math.min(92, pct));
    if ($canvasClip) $canvasClip.style.clipPath = `inset(0 0 0 ${compareSplit}%)`;
    if ($compareHandle) $compareHandle.style.left = compareSplit + '%';
  }

  /* ── Import ── */
  document.getElementById('file-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      toast('正在加载…');
      sourceImg = await loadOrientedImage(file);
      userRotation = 0;
      flipH = false;
      await applySourceImage();
      engine.resetParams();
      currentPreset = null;
      $empty.style.display = 'none';

      hasImage = true;
      histPast.length = 0;
      histFuture.length = 0;
      compareMode = false;
      setCompareUI(false);
      initCurvePoints();
      syncAllSliders();
      updateHeaderState();
      scheduleRender();
      toast('已加载 · 点「对比」看原图/调色');
    } catch (err) {
      toast('图片加载失败');
      console.error(err);
    }
  });

  document.getElementById('btn-import').onclick = () => document.getElementById('file-input').click();

  /* ── Compare (split view) ── */
  const viewport = document.getElementById('viewport');

  function setCompareUI(on) {
    compareMode = on;
    $canvasOrig.classList.toggle('hidden', !on);
    $compareHandle.classList.toggle('hidden', !on);
    $compareBadge.style.display = on ? 'block' : 'none';
    if (on) {
      updateCompareSplit(compareSplit);
      syncCanvasLayout();
    } else if ($canvasClip) {
      $canvasClip.style.clipPath = 'inset(0 0 0 0)';
    }
    updateHeaderState();
  }

  function toggleCompare() {
    if (!hasImage) { toast('请先导入照片'); return; }
    setCompareUI(!compareMode);
    toast(compareMode ? '左右对比：左原图 · 右调色（拖动中线）' : '已关闭对比');
  }

  function onCompareDrag(clientX) {
    const stack = document.getElementById('viewport-stack');
    if (!stack) return;
    const rect = stack.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    updateCompareSplit(pct);
  }

  if ($compareHandle) {
    $compareHandle.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      compareDrag = true;
      $compareHandle.setPointerCapture(e.pointerId);
    });
    $compareHandle.addEventListener('pointermove', e => {
      if (!compareDrag) return;
      e.preventDefault();
      onCompareDrag(e.clientX);
    });
    $compareHandle.addEventListener('pointerup', e => {
      compareDrag = false;
      try { $compareHandle.releasePointerCapture(e.pointerId); } catch (_) {}
    });
  }

  viewport.addEventListener('pointerdown', e => {
    if (!compareMode || compareDrag) return;
    if (e.target.closest('.compare-handle, .header-actions, .histogram')) return;
    onCompareDrag(e.clientX);
  });

  function bindHeaderBtn(el, handler) {
    if (!el) return;
    el.addEventListener('pointerup', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      handler(e);
    });
  }

  bindHeaderBtn($btnUndo, undo);
  bindHeaderBtn($btnRedo, redo);
  bindHeaderBtn($btnCompare, toggleCompare);

  window.addEventListener('resize', () => { if (hasImage) syncCanvasLayout(); });

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
    beginEdit();
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
    if (dragIdx >= 0) endEdit();
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
      slider.addEventListener('pointerdown', beginEdit);
      slider.addEventListener('pointerup', endEdit);
      slider.addEventListener('pointercancel', endEdit);
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
    strSlider.addEventListener('pointerdown', beginEdit);
    strSlider.addEventListener('pointerup', endEdit);
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
    window.applyPreset(engine, key, intensity);
    const adj = PRESETS[key]?.adjustments;
    if (adj?.curve) {
      curvePoints = adj.curve.map(p => ({ ...p }));
      engine.setCurveFromPoints(curvePoints, 'master');
    } else {
      curvePoints = DEFAULT_CURVE.map(p => ({ ...p }));
      engine.setCurveFromPoints(curvePoints, 'master');
    }
  }

  /* ── Histogram ── */
  function drawHistogram() {
    if (!$histogram || !showHistogram || !$canvasOrig.width) return;
    const ctx = $histogram.getContext('2d');
    const w = $histogram.width, h = $histogram.height;
    ctx.clearRect(0, 0, w, h);
    const sw = Math.min($canvasOrig.width, 200);
    const sh = Math.min($canvasOrig.height, 200);
    const tmp = document.createElement('canvas');
    tmp.width = sw; tmp.height = sh;
    tmp.getContext('2d').drawImage($canvasOrig, 0, 0, sw, sh);
    const { data } = tmp.getContext('2d').getImageData(0, 0, sw, sh);
    const r = new Uint32Array(256), g = new Uint32Array(256), b = new Uint32Array(256), lum = new Uint32Array(256);
    for (let i = 0; i < data.length; i += 4) {
      r[data[i]]++; g[data[i + 1]]++; b[data[i + 2]]++;
      const l = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      lum[l]++;
    }
    const max = Math.max(...lum, 1);
    const draw = (arr, color, alpha) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      for (let i = 0; i < 256; i++) {
        const bh = (arr[i] / max) * (h - 4);
        ctx.fillRect(i / 256 * w, h - bh, w / 256 + 0.5, bh);
      }
    };
    draw(r, '#ff4444', 0.45);
    draw(g, '#44ff44', 0.45);
    draw(b, '#4488ff', 0.45);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ccc';
    for (let i = 0; i < 256; i++) {
      const bh = (lum[i] / max) * (h - 4);
      ctx.fillRect(i / 256 * w, h - bh, w / 256 + 0.5, bh);
    }
    ctx.globalAlpha = 1;
  }

  /* ── Quick tools ── */
  function initQuickTools() {
    document.getElementById('quick-auto')?.addEventListener('click', () => runAI(true));
    document.getElementById('quick-levels')?.addEventListener('click', () => {
      if (!hasImage) { toast('请先导入照片'); return; }
      if (!window.VisionAgent) { toast('分析模块未加载'); return; }
      beginEdit();
      const rep = VisionAgent.analyzeCanvas($canvasOrig);
      const p = engine.params;
      if (rep.isDark) p.exposure += 0.3;
      if (rep.isBright) p.exposure -= 0.15;
      if (rep.clipHigh > 0.02) p.highlights -= Math.min(35, rep.clipHigh * 300);
      if (rep.clipLow > 0.03 || rep.isDark) p.shadows += 20;
      if (rep.isFlat) { p.contrast += 10; p.clarity += 8; }
      if (rep.colorCast === 'warm') p.temperature -= 10;
      if (rep.colorCast === 'cool') p.temperature += 10;
      syncAllSliders();
      endEdit();
      scheduleRender();
      drawHistogram();
      toast('已自动色阶');
    });

    document.getElementById('btn-rotate-left')?.addEventListener('click', async () => {
      if (!hasImage) return;
      pushHistory();
      userRotation = (userRotation - 90 + 360) % 360;
      await applySourceImage();
      toast('已旋转');
    });
    document.getElementById('btn-rotate-right')?.addEventListener('click', async () => {
      if (!hasImage) return;
      pushHistory();
      userRotation = (userRotation + 90) % 360;
      await applySourceImage();
      toast('已旋转');
    });
    document.getElementById('btn-flip-h')?.addEventListener('click', async () => {
      if (!hasImage) return;
      pushHistory();
      flipH = !flipH;
      await applySourceImage();
      toast(flipH ? '已水平翻转' : '已取消翻转');
    });
    document.getElementById('btn-histogram')?.addEventListener('click', () => {
      if (!hasImage) { toast('请先导入照片'); return; }
      showHistogram = !showHistogram;
      $histogram.classList.toggle('hidden', !showHistogram);
      document.getElementById('btn-histogram')?.classList.toggle('active', showHistogram);
      if (showHistogram) drawHistogram();
      toast(showHistogram ? '直方图已显示' : '直方图已隐藏');
    });
  }

  /* ── AI Grading ── */
  const AI_USE_CLOUD_KEY = 'colorlab_use_cloud';

  async function runAI(auto = false) {
    const $prompt = document.getElementById('ai-prompt');
    const $apply = document.getElementById('ai-apply');
    const $autoBtn = document.getElementById('ai-auto');
    const $result = document.getElementById('ai-result');
    if (!$apply || !window.AIGrader) {
      toast('AI 模块未加载，请刷新页面');
      return;
    }
    if (!window.VisionAgent && !auto) {
      toast('Vision Agent 未加载，请刷新页面');
      return;
    }

    const text = ($prompt?.value || '').trim();
    if (!auto && !text) { toast('请输入描述或点「一键智能修图」'); return; }
    if (!hasImage) { toast('请先导入照片'); return; }

    $apply.disabled = true;
    if ($autoBtn) $autoBtn.disabled = true;
    if ($result) $result.textContent = 'Agent 分析中…';
    toast(auto ? '智能 Agent 分析中…' : 'AI 分析中…');

    try {
      const statsCanvas = ($canvasOrig && $canvasOrig.width > 0) ? $canvasOrig : $canvas;
      const useCloud = localStorage.getItem(AI_USE_CLOUD_KEY) === '1';

      const aiResult = await AIGrader.analyze(auto ? '自动优化' : text, statsCanvas, {
        apiKey: AIGrader.getApiKey(),
        baseUrl: AIGrader.getBaseUrl(),
        useAPI: useCloud,
        auto,
      });

      pushHistory();
      AIGrader.applyToEngine(engine, aiResult, {
        applyPresetGL,
        syncAllSliders,
        drawCurve,
        updateLookSelection,
        $presetStrength,
      });
      currentPreset = aiResult.preset || null;
      if (currentPreset) {
        $presetStrength.classList.remove('hidden');
        updateLookSelection();
      } else {
        $presetStrength.classList.add('hidden');
      }

      updateHeaderState();
      scheduleRender();
      drawHistogram();
      if ($result) {
        const tag = aiResult.source === 'cloud' ? ' · 云端AI' :
          aiResult.source === 'agent' ? ' · 智能Agent' : ' · 本地';
        $result.textContent = aiResult.explanation + tag;
      }
      toast('调色完成');
    } catch (err) {
      if ($result) $result.textContent = '';
      toast('分析失败：' + (err.message || '请重试'));
      console.error('[AI]', err);
    } finally {
      $apply.disabled = false;
      if ($autoBtn) $autoBtn.disabled = false;
    }
  }

  function initAI() {
    const $apply = document.getElementById('ai-apply');
    const $autoBtn = document.getElementById('ai-auto');
    if (!$apply) {
      console.warn('[AI] ai-apply button not found');
      return;
    }
    if (!window.AIGrader) {
      console.warn('[AI] AIGrader not loaded');
      return;
    }

    const $result = document.getElementById('ai-result');
    const $apiKey = document.getElementById('ai-api-key');
    const $apiBase = document.getElementById('ai-api-base');
    const $useCloud = document.getElementById('ai-use-cloud');

    if ($apiKey) $apiKey.value = AIGrader.getApiKey();
    if ($apiBase) $apiBase.value = AIGrader.getBaseUrl();
    if ($useCloud) $useCloud.checked = localStorage.getItem(AI_USE_CLOUD_KEY) === '1';

    const saveBtn = document.getElementById('ai-save-key');
    if (saveBtn) {
      saveBtn.onclick = () => {
        if ($apiKey) AIGrader.setApiKey($apiKey.value.trim());
        if ($apiBase) AIGrader.setBaseUrl($apiBase.value.trim());
        if ($useCloud) localStorage.setItem(AI_USE_CLOUD_KEY, $useCloud.checked ? '1' : '0');
        toast('AI 设置已保存');
      };
    }

    const chips = document.getElementById('ai-chips');
    if (chips) {
      chips.addEventListener('click', e => {
        const chip = e.target.closest('.ai-chip');
        if (!chip) return;
        const $prompt = document.getElementById('ai-prompt');
        if ($prompt) $prompt.value = chip.textContent;
        if (chip.textContent === '自动优化' && $autoBtn) runAI(true);
      });
    }

    if ($autoBtn) {
      $autoBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        runAI(true);
      });
    }

    $apply.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      runAI(false);
    });
  }

  /* ── Boot ── */
  try {
    bindParams();
    buildHSLPanel();
    buildPresets();
    initCurvePoints();
    initQuickTools();
    initAI();
    updateHeaderState();
  } catch (err) {
    console.error('[ColorLab boot error]', err);
    toast('加载失败: ' + err.message);
  }

  window.__colorlabReady = true;

  console.log('%c ColorLab Pro %c GPU Ready ', 'background:#00d4ff;color:#000;font-weight:bold', 'color:#6b7a99');
})();
