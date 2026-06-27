/**
 * ColorLab App - 主应用逻辑
 */
(function () {
  'use strict';

  // ========== DOM 引用 ==========
  const $previewCanvas = document.getElementById('preview-canvas');
  const $previewArea = document.getElementById('preview-area');
  const $placeholder = document.getElementById('placeholder');
  const $beforeLabel = document.getElementById('before-label');
  const $compareOverlay = document.getElementById('compare-overlay');
  const $compareCanvas = document.getElementById('compare-canvas');
  const $presetGrid = document.getElementById('preset-grid');
  const $presetCats = document.getElementById('preset-categories');
  const $presetIntensity = document.getElementById('preset-intensity');
  const $hslChannels = document.getElementById('hsl-channels');
  const $hslSliders = document.getElementById('hsl-sliders');
  const $toast = document.getElementById('toast');
  const $saveModal = document.getElementById('save-modal');

  const engine = window.colorEngine;

  let hasImage = false;
  let currentTab = 'adjust';
  let currentPreset = null;
  let currentHSLChannel = 'red';
  let updatePending = false;
  let compareActive = false;
  let compareTimeout = null;

  // Undo/redo stacks
  const undoStack = [];
  const redoStack = [];
  const MAX_HISTORY = 50;

  // ========== Service Worker ==========
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // ========== Toast ==========
  let toastTimer;
  function showToast(msg) {
    $toast.textContent = msg;
    $toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), 2000);
  }

  // ========== History ==========
  function saveState() {
    const state = {
      adj: JSON.parse(JSON.stringify(engine.adj)),
      curveLUT: new Uint8Array(engine.curveLUT),
      presetActive: engine.presetActive,
      presetIntensity: engine.presetIntensity,
      currentPresetName: engine.currentPresetName,
    };
    undoStack.push(state);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
  }

  function undo() {
    if (undoStack.length === 0) return;
    redoStack.push(getCurrentState());
    const state = undoStack.pop();
    restoreState(state);
    updateAllSliders();
    render();
    showToast('已撤销');
  }

  function redo() {
    if (redoStack.length === 0) return;
    undoStack.push(getCurrentState());
    const state = redoStack.pop();
    restoreState(state);
    updateAllSliders();
    render();
    showToast('已重做');
  }

  function getCurrentState() {
    return {
      adj: JSON.parse(JSON.stringify(engine.adj)),
      curveLUT: new Uint8Array(engine.curveLUT),
      presetActive: engine.presetActive,
      presetIntensity: engine.presetIntensity,
      currentPresetName: engine.currentPresetName,
    };
  }

  function restoreState(state) {
    engine.adj = JSON.parse(JSON.stringify(state.adj));
    engine.curveLUT.set(state.curveLUT);
    engine.presetActive = state.presetActive;
    engine.presetIntensity = state.presetIntensity;
    engine.currentPresetName = state.currentPresetName;
    currentPreset = state.presetActive;
  }

  // ========== Render ==========
  function render() {
    if (!hasImage || updatePending) return;
    updatePending = true;
    requestAnimationFrame(() => {
      engine.renderToCanvas($previewCanvas);
      updatePending = false;
    });
  }

  function debouncedRender() {
    if (!hasImage) return;
    saveState();
    render();
  }

  // ========== Image Import ==========
  document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        loadImage(img);
        $placeholder.style.display = 'none';
        $previewCanvas.style.display = 'block';
        hasImage = true;
        undoStack.length = 0;
        redoStack.length = 0;
        updateAllSliders();
        render();
        showToast('图片已导入');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  function loadImage(img) {
    engine.loadImage(img);

    // Show original on compare canvas
    const cCtx = $compareCanvas.getContext('2d');
    $compareCanvas.width = engine.width;
    $compareCanvas.height = engine.height;
    cCtx.putImageData(engine.originalSRGB, 0, 0);
  }

  // ========== Sliders ==========
  const sliderMap = {
    'slider-exposure':    { key: 'exposure',    format: v => (v / 100).toFixed(2) },
    'slider-contrast':    { key: 'contrast',    format: v => Math.round(v).toString() },
    'slider-highlights':  { key: 'highlights',  format: v => Math.round(v).toString() },
    'slider-shadows':     { key: 'shadows',     format: v => Math.round(v).toString() },
    'slider-whites':      { key: 'whites',      format: v => Math.round(v).toString() },
    'slider-blacks':      { key: 'blacks',      format: v => Math.round(v).toString() },
    'slider-temperature': { key: 'temperature', format: v => Math.round(v).toString() },
    'slider-tint':        { key: 'tint',        format: v => Math.round(v).toString() },
    'slider-vibrance':    { key: 'vibrance',    format: v => Math.round(v).toString() },
    'slider-saturation':  { key: 'saturation',  format: v => Math.round(v).toString() },
    'slider-clarity':     { key: 'clarity',     format: v => Math.round(v).toString() },
    'slider-sharpening':  { key: 'sharpening',  format: v => Math.round(v).toString() },
    'slider-vignette':    { key: 'vignette',    format: v => Math.round(v).toString() },
    'slider-grain':       { key: 'grain',       format: v => Math.round(v).toString() },
  };

  // Bind all sliders
  Object.keys(sliderMap).forEach(id => {
    const slider = document.getElementById(id);
    const cfg = sliderMap[id];
    if (!slider) return;

    slider.addEventListener('input', () => {
      const val = parseInt(slider.value);
      const mappedVal = id === 'slider-exposure' ? val / 100 : val;
      engine.adj[cfg.key] = mappedVal;
      document.getElementById('val-' + cfg.key).textContent = cfg.format(val);
      // Reset preset when manually adjusting
      if (currentPreset) {
        currentPreset = null;
        engine.presetActive = null;
        updatePresetSelection();
        $presetIntensity.style.display = 'none';
      }
      debouncedRender();
    });
  });

  function updateAllSliders() {
    Object.keys(sliderMap).forEach(id => {
      const cfg = sliderMap[id];
      const slider = document.getElementById(id);
      if (!slider) return;
      const val = id === 'slider-exposure'
        ? Math.round(engine.adj[cfg.key] * 100)
        : Math.round(engine.adj[cfg.key]);
      slider.value = val;
      document.getElementById('val-' + cfg.key).textContent = cfg.format(val);
    });
  }

  // ========== Compare (before/after) ==========
  let comparePressTimer;

  function startCompare() {
    if (!hasImage) return;
    compareActive = true;
    $compareOverlay.classList.add('show');
    $beforeLabel.style.display = 'block';
  }

  function endCompare() {
    compareActive = false;
    $compareOverlay.classList.remove('show');
    $beforeLabel.style.display = 'none';
  }

  // Long press / touch on preview area
  $previewArea.addEventListener('touchstart', (e) => {
    if (!hasImage) return;
    comparePressTimer = setTimeout(startCompare, 150);
  });
  $previewArea.addEventListener('touchend', () => {
    clearTimeout(comparePressTimer);
    endCompare();
  });
  $previewArea.addEventListener('touchcancel', () => {
    clearTimeout(comparePressTimer);
    endCompare();
  });

  // Mouse support (desktop)
  $previewArea.addEventListener('mousedown', (e) => {
    if (!hasImage) return;
    comparePressTimer = setTimeout(startCompare, 150);
  });
  $previewArea.addEventListener('mouseup', () => {
    clearTimeout(comparePressTimer);
    endCompare();
  });
  $previewArea.addEventListener('mouseleave', () => {
    clearTimeout(comparePressTimer);
    endCompare();
  });

  // Compare button (info icon)
  document.getElementById('btn-compare').addEventListener('touchstart', startCompare);
  document.getElementById('btn-compare').addEventListener('touchend', endCompare);
  document.getElementById('btn-compare').addEventListener('mousedown', startCompare);
  document.getElementById('btn-compare').addEventListener('mouseup', endCompare);

  // ========== Tabs ==========
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById('panel-' + currentTab).classList.add('active');
      if (currentTab === 'hsl') updateHSLSleders();
    });
  });

  // ========== Presets ==========
  function buildPresetUI() {
    // Categories
    const cats = new Set();
    Object.values(PRESETS).forEach(p => cats.add(p.category));
    $presetCats.innerHTML = '<button class="cat-btn active" data-cat="all">全部</button>';
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.dataset.cat = cat;
      btn.textContent = cat;
      $presetCats.appendChild(btn);
    });

    $presetCats.addEventListener('click', (e) => {
      if (!e.target.classList.contains('cat-btn')) return;
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      renderPresetCards(e.target.dataset.cat);
    });

    renderPresetCards('all');

    // Preset intensity slider
    document.getElementById('slider-preset-intensity').addEventListener('input', (e) => {
      const val = parseInt(e.target.value) / 100;
      document.getElementById('val-preset-intensity').textContent = e.target.value + '%';
      if (currentPreset && engine.presetActive) {
        engine.presetIntensity = val;
        applyPreset(engine, currentPreset, val);
        updateAllSliders();
        saveState();
        render();
      }
    });
  }

  function renderPresetCards(category) {
    $presetGrid.innerHTML = '';
    Object.entries(PRESETS).forEach(([key, preset]) => {
      if (category !== 'all' && preset.category !== category) return;
      const card = document.createElement('div');
      card.className = 'preset-card' + (currentPreset === key ? ' active' : '');
      card.dataset.preset = key;
      card.innerHTML = `
        <span class="preset-card-icon">${preset.icon}</span>
        <span class="preset-card-name">${preset.name}</span>
        <span class="preset-card-desc">${preset.desc}</span>
        <span class="preset-card-cat">${preset.category}</span>
      `;
      card.addEventListener('click', () => selectPreset(key));
      $presetGrid.appendChild(card);
    });
  }

  function selectPreset(key) {
    if (currentPreset === key) {
      // Deselect
      currentPreset = null;
      resetEngine(engine);
      updateAllSliders();
      $presetIntensity.style.display = 'none';
      updatePresetSelection();
      saveState();
      render();
      showToast('已清除风格');
      return;
    }
    currentPreset = key;
    const intensity = parseInt(document.getElementById('slider-preset-intensity').value) / 100;
    applyPreset(engine, key, intensity);
    updateAllSliders();
    $presetIntensity.style.display = 'block';
    updatePresetSelection();
    saveState();
    render();
    showToast('已应用: ' + PRESETS[key].name);
  }

  function updatePresetSelection() {
    document.querySelectorAll('.preset-card').forEach(card => {
      card.classList.toggle('active', card.dataset.preset === currentPreset);
    });
  }

  // ========== HSL ==========
  const hslChNames = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta'];

  $hslChannels.addEventListener('click', (e) => {
    if (!e.target.classList.contains('hsl-channel')) return;
    currentHSLChannel = e.target.dataset.ch;
    document.querySelectorAll('.hsl-channel').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    updateHSLSleders();
  });

  function updateHSLSleders() {
    const ch = currentHSLChannel;
    const hsl = engine.adj.hsl[ch];
    $hslSliders.innerHTML = `
      <div class="slider-item">
        <div class="slider-header">
          <span class="slider-label">色相偏移</span>
          <span class="slider-value" id="hsl-h-val">${hsl.h}</span>
        </div>
        <input type="range" class="slider hsl-slider" id="hsl-h" min="-30" max="30" value="${hsl.h}" step="1">
      </div>
      <div class="slider-item">
        <div class="slider-header">
          <span class="slider-label">饱和度</span>
          <span class="slider-value" id="hsl-s-val">${hsl.s}</span>
        </div>
        <input type="range" class="slider hsl-slider" id="hsl-s" min="-100" max="100" value="${hsl.s}" step="1">
      </div>
      <div class="slider-item">
        <div class="slider-header">
          <span class="slider-label">明度</span>
          <span class="slider-value" id="hsl-l-val">${hsl.l}</span>
        </div>
        <input type="range" class="slider hsl-slider" id="hsl-l" min="-100" max="100" value="${hsl.l}" step="1">
      </div>
    `;

    document.querySelectorAll('.hsl-slider').forEach(slider => {
      slider.addEventListener('input', () => {
        const prop = slider.id.replace('hsl-', '');
        const val = parseInt(slider.value);
        engine.adj.hsl[ch][prop] = val;
        document.getElementById('hsl-' + prop + '-val').textContent = val;
        if (currentPreset) {
          currentPreset = null;
          engine.presetActive = null;
          updatePresetSelection();
          $presetIntensity.style.display = 'none';
        }
        debouncedRender();
      });
    });
  }

  // ========== Reset ==========
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (!hasImage) return;
    saveState();
    resetEngine(engine);
    currentPreset = null;
    updatePresetSelection();
    $presetIntensity.style.display = 'none';
    updateAllSliders();
    render();
    showToast('已重置全部调整');
  });

  // ========== Save / Export ==========
  document.getElementById('btn-save').addEventListener('click', async () => {
    if (!hasImage) {
      showToast('请先导入图片');
      return;
    }
    $saveModal.style.display = 'flex';

    try {
      const canvas = await engine.exportFullRes();
      if (!canvas) {
        $saveModal.style.display = 'none';
        showToast('导出失败');
        return;
      }

      // Try Web Share API first (iOS)
      canvas.toBlob(async (blob) => {
        $saveModal.style.display = 'none';
        if (!blob) { showToast('导出失败'); return; }

        const file = new File([blob], 'ColorLab_' + Date.now() + '.jpg', { type: 'image/jpeg' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'ColorLab Export',
            });
            showToast('已导出');
          } catch (err) {
            if (err.name !== 'AbortError') downloadFile(file);
          }
        } else {
          downloadFile(file);
        }
      }, 'image/jpeg', 0.95);
    } catch (err) {
      $saveModal.style.display = 'none';
      showToast('导出失败: ' + err.message);
    }
  });

  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('已保存到相册');
  }

  // ========== Undo/Redo ==========
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      document.getElementById('btn-save').click();
    }
  });

  // ========== Initialize ==========
  buildPresetUI();

  // Prevent double-tap zoom on buttons
  document.addEventListener('touchstart', function (e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') {
      // Allow normal behavior
    }
  }, { passive: true });

  // Prevent pull-to-refresh
  document.addEventListener('touchmove', function (e) {
    if (e.target.closest('.panel') || e.target.closest('.slider-group')) return;
    // Allow scroll in panels
  }, { passive: true });

  console.log('🎨 ColorLab ready — 长按预览区对比原图');
})();
