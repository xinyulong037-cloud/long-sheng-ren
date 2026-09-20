/* =========================================================================
 * 龙圣人 · 批量邀请函生成工具
 * 纯前端实现：所有图片处理均在浏览器本地完成，不上传任何服务器。
 * ========================================================================= */
(function () {
  'use strict';

  /* ---------- 常量 ---------- */
  const FONTS = {
    hei:   { label: '黑体（现代）', family: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif' },
    song:  { label: '宋体（典雅）', family: '"Songti SC", "SimSun", "Noto Serif SC", serif' },
    kai:   { label: '楷体（手写）', family: '"Kaiti SC", "KaiTi", "STKaiti", serif' },
    li:    { label: '隶书（古朴）', family: '"LiSu", "STLiti", "Noto Serif SC", serif' }
  };

  const DEFAULTS = {
    fontFamily: 'hei',
    fontSize: 80,
    fontWeight: 'bold',
    textColor: '#ffffff',
    strokeEnabled: false,
    strokeColor: '#000000',
    strokeWidth: 4,
    x: 0,
    y: 0,
    namesText: '',
    fileName: ''
  };

  /* ---------- 状态 ---------- */
  const state = {
    bgImage: null,        // HTMLImageElement
    fileName: '',
    fontFamily: DEFAULTS.fontFamily,
    fontSize: DEFAULTS.fontSize,
    fontWeight: DEFAULTS.fontWeight,
    textColor: DEFAULTS.textColor,
    strokeEnabled: DEFAULTS.strokeEnabled,
    strokeColor: DEFAULTS.strokeColor,
    strokeWidth: DEFAULTS.strokeWidth,
    x: DEFAULTS.x,
    y: DEFAULTS.y,
    scale: 1,             // 预览缩放比例
    names: [],            // 已解析姓名数组
    results: []           // { name, blob, url }
  };

  /* ---------- DOM ---------- */
  const $ = (id) => document.getElementById(id);
  const el = {
    dropzone: $('dropzone'),
    fileInput: $('fileInput'),
    dzIdle: $('dzIdle'),
    dzLoaded: $('dzLoaded'),
    dzThumb: $('dzThumb'),
    dzName: $('dzName'),
    dzSize: $('dzSize'),
    btnReplace: $('btnReplace'),

    fontFamily: $('fontFamily'),
    fontSize: $('fontSize'),
    fontWeight: $('fontWeight'),
    textColor: $('textColor'),
    textColorVal: $('textColorVal'),
    strokeEnabled: $('strokeEnabled'),
    strokeOptions: $('strokeOptions'),
    strokeColor: $('strokeColor'),
    strokeColorVal: $('strokeColorVal'),
    strokeWidth: $('strokeWidth'),
    posX: $('posX'),
    posY: $('posY'),

    namesInput: $('namesInput'),
    nameCount: $('nameCount'),

    previewWrap: $('previewWrap'),
    previewCanvas: $('previewCanvas'),
    previewStage: $('previewStage'),
    previewEmpty: $('previewEmpty'),
    previewHint: $('previewHint'),
    dragHandle: $('dragHandle'),

    btnGenerate: $('btnGenerate'),
    btnDownload: $('btnDownload'),
    btnReset: $('btnReset'),
    actionHint: $('actionHint'),

    resultsSection: $('resultsSection'),
    resultsGrid: $('resultsGrid'),
    resultCount: $('resultCount'),

    toast: $('toast')
  };

  const previewCtx = el.previewCanvas.getContext('2d');
  const measureCtx = document.createElement('canvas').getContext('2d');

  /* ---------- 工具 ---------- */
  function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }

  function buildFont(sizePx) {
    return state.fontWeight + ' ' + sizePx + 'px ' + FONTS[state.fontFamily].family;
  }

  function measureWidth(name, sizePx) {
    measureCtx.font = buildFont(sizePx);
    return measureCtx.measureText(name).width;
  }

  let toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    requestAnimationFrame(() => el.toast.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.remove('show');
      setTimeout(() => { el.toast.hidden = true; }, 220);
    }, 2200);
  }

  function getPreviewName() {
    return state.names.length ? state.names[0] : '姓名';
  }

  function setBusy(busy) {
    el.btnGenerate.disabled = busy;
    el.btnDownload.disabled = busy || state.results.length === 0;
    el.btnReset.disabled = busy;
  }

  function computeScale() {
    if (!state.bgImage) return 1;
    const availW = Math.max(300, el.previewStage.clientWidth - 44);
    const availH = 560;
    return Math.min(availW / state.bgImage.naturalWidth, availH / state.bgImage.naturalHeight, 1);
  }

  /* ---------- 姓名解析 ---------- */
  function parseNames(raw) {
    const seen = new Set();
    const out = [];
    raw.split(/[\s,，、;；]+/).forEach((s) => {
      const name = s.trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        out.push(name);
      }
    });
    return out;
  }

  function refreshNames() {
    state.names = parseNames(el.namesInput.value);
    el.nameCount.textContent = state.names.length + ' 人';
    if (state.bgImage) drawPreview();
  }

  /* ---------- 背景图加载 ---------- */
  function loadImageFile(file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      toast('请选择 JPG / PNG / WEBP 图片文件');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      state.bgImage = img;
      state.fileName = file.name || 'background';
      showUploadedUI();
      centerTextOnImage();
      updatePreviewLayout();
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      toast('图片加载失败，请换一张图片');
    };
    img.src = url;
  }

  function showUploadedUI() {
    el.dzIdle.hidden = true;
    el.dzLoaded.hidden = false;
    el.dzThumb.src = state.bgImage.src;
    el.dzName.textContent = state.fileName;
    el.dzName.title = state.fileName;
    el.dzSize.textContent = state.bgImage.naturalWidth + ' × ' + state.bgImage.naturalHeight;
    el.previewEmpty.hidden = true;
    el.previewWrap.hidden = false;
    el.actionHint.textContent = '已就绪：' + state.names.length + ' 个姓名待生成，点击「批量生成」开始。';
  }

  function centerTextOnImage() {
    const name = getPreviewName();
    const tw = measureWidth(name, state.fontSize);
    state.x = Math.round(clamp((state.bgImage.naturalWidth - tw) / 2, 0, state.bgImage.naturalWidth));
    state.y = Math.round(clamp((state.bgImage.naturalHeight - state.fontSize) / 2, 0, state.bgImage.naturalHeight));
    syncPosInputs();
  }

  /* ---------- 预览绘制 ---------- */
  function updatePreviewLayout() {
    if (!state.bgImage) return;
    state.scale = computeScale();
    drawPreview();
  }

  function drawPreview() {
    if (!state.bgImage) return;
    const img = state.bgImage;
    const s = state.scale;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.round(img.naturalWidth * s));
    const ch = Math.max(1, Math.round(img.naturalHeight * s));

    el.previewCanvas.width = Math.round(cw * dpr);
    el.previewCanvas.height = Math.round(ch * dpr);
    el.previewCanvas.style.width = cw + 'px';
    el.previewCanvas.style.height = ch + 'px';
    el.previewWrap.style.width = cw + 'px';
    el.previewWrap.style.height = ch + 'px';

    previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    previewCtx.clearRect(0, 0, cw, ch);
    previewCtx.drawImage(img, 0, 0, cw, ch);

    // 文字
    const name = getPreviewName();
    const fs = state.fontSize * s;
    previewCtx.font = buildFont(fs);
    previewCtx.textBaseline = 'top';
    previewCtx.textAlign = 'left';
    previewCtx.lineJoin = 'round';
    previewCtx.miterLimit = 2;
    if (state.strokeEnabled) {
      previewCtx.lineWidth = state.strokeWidth * s;
      previewCtx.strokeStyle = state.strokeColor;
      previewCtx.strokeText(name, state.x * s, state.y * s);
    }
    previewCtx.fillStyle = state.textColor;
    previewCtx.fillText(name, state.x * s, state.y * s);

    positionHandle();
    el.previewHint.textContent = '正在预览：' + name + '（' + state.bgImage.naturalWidth + '×' +
      state.bgImage.naturalHeight + 'px）· 拖拽虚线框调整位置';
  }

  function positionHandle() {
    const name = getPreviewName();
    const tw = measureWidth(name, state.fontSize);
    el.dragHandle.style.left = state.x * state.scale + 'px';
    el.dragHandle.style.top = state.y * state.scale + 'px';
    el.dragHandle.style.width = Math.max(12, tw * state.scale) + 'px';
    el.dragHandle.style.height = Math.max(12, state.fontSize * state.scale) + 'px';
  }

  /* ---------- 拖拽与定位 ---------- */
  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  el.dragHandle.addEventListener('pointerdown', (e) => {
    if (!state.bgImage) return;
    dragging = true;
    el.dragHandle.setPointerCapture(e.pointerId);
    const rect = el.previewWrap.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left - state.x * state.scale;
    dragOffsetY = e.clientY - rect.top - state.y * state.scale;
    e.preventDefault();
  });

  el.dragHandle.addEventListener('pointermove', (e) => {
    if (!dragging || !state.bgImage) return;
    const rect = el.previewWrap.getBoundingClientRect();
    let nx = (e.clientX - rect.left - dragOffsetX) / state.scale;
    let ny = (e.clientY - rect.top - dragOffsetY) / state.scale;
    nx = clamp(nx, 0, state.bgImage.naturalWidth);
    ny = clamp(ny, 0, state.bgImage.naturalHeight);
    state.x = Math.round(nx);
    state.y = Math.round(ny);
    syncPosInputs();
    drawPreview();
  });

  el.dragHandle.addEventListener('pointerup', () => { dragging = false; });
  el.dragHandle.addEventListener('pointercancel', () => { dragging = false; });

  el.previewCanvas.addEventListener('click', (e) => {
    if (!state.bgImage) return;
    const rect = el.previewCanvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / state.scale;
    const cy = (e.clientY - rect.top) / state.scale;
    const tw = measureWidth(getPreviewName(), state.fontSize);
    state.x = Math.round(clamp(cx - tw / 2, 0, state.bgImage.naturalWidth));
    state.y = Math.round(clamp(cy - state.fontSize / 2, 0, state.bgImage.naturalHeight));
    syncPosInputs();
    drawPreview();
  });

  /* ---------- 输入同步 ---------- */
  function syncPosInputs() {
    el.posX.value = state.x;
    el.posY.value = state.y;
  }

  function readStyleInputs() {
    state.fontFamily = el.fontFamily.value;
    state.fontSize = clamp(parseInt(el.fontSize.value, 10) || DEFAULTS.fontSize, 1, 2000);
    state.fontWeight = el.fontWeight.value;
    state.textColor = el.textColor.value;
    state.strokeEnabled = el.strokeEnabled.checked;
    state.strokeColor = el.strokeColor.value;
    state.strokeWidth = clamp(parseInt(el.strokeWidth.value, 10) || 4, 1, 100);
    state.x = clamp(parseInt(el.posX.value, 10) || 0, 0, state.bgImage ? state.bgImage.naturalWidth : 1e9);
    state.y = clamp(parseInt(el.posY.value, 10) || 0, 0, state.bgImage ? state.bgImage.naturalHeight : 1e9);
  }

  /* ---------- 生成 ---------- */
  function renderOne(name) {
    return new Promise((resolve, reject) => {
      const img = state.bgImage;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      ctx.font = buildFont(state.fontSize);
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      if (state.strokeEnabled) {
        ctx.lineWidth = state.strokeWidth;
        ctx.strokeStyle = state.strokeColor;
        ctx.strokeText(name, state.x, state.y);
      }
      ctx.fillStyle = state.textColor;
      ctx.fillText(name, state.x, state.y);
      c.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('生成图片失败'));
      }, 'image/png');
    });
  }

  function addResultCard(item) {
    const wrapper = document.createElement('div');
    wrapper.className = 'result-item';

    const img = document.createElement('img');
    img.src = item.url;
    img.alt = item.name;
    img.title = '点击放大查看';
    img.addEventListener('click', () => openFullscreen(item.name, item.url));

    const meta = document.createElement('div');
    meta.className = 'result-meta';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = item.name;
    nameSpan.title = item.name;
    const a = document.createElement('a');
    a.className = 'dl';
    a.href = item.url;
    a.download = '龙圣人邀请函-' + item.name + '.png';
    a.textContent = '下载';
    meta.appendChild(nameSpan);
    meta.appendChild(a);

    wrapper.appendChild(img);
    wrapper.appendChild(meta);
    el.resultsGrid.appendChild(wrapper);
  }

  function openFullscreen(name, url) {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.82);display:flex;' +
      'align-items:center;justify-content:center;z-index:200;cursor:zoom-out;';
    const figure = document.createElement('figure');
    figure.style.cssText = 'margin:0;text-align:center;max-width:90vw;max-height:92vh;';
    const img = document.createElement('img');
    img.src = url;
    img.alt = name;
    img.style.cssText = 'max-width:88vw;max-height:82vh;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.5);';
    const cap = document.createElement('figcaption');
    cap.textContent = name + ' · 点击任意处关闭';
    cap.style.cssText = 'color:#fff;margin-top:12px;font-size:14px;';
    figure.appendChild(img);
    figure.appendChild(cap);
    overlay.appendChild(figure);
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  }

  async function generate() {
    readStyleInputs();
    if (!state.bgImage) { toast('请先上传背景图'); return; }
    if (!state.names.length) { toast('请先输入姓名'); return; }

    setBusy(true);
    el.resultsGrid.innerHTML = '';
    el.resultsSection.hidden = false;
    state.results = [];

    const total = state.names.length;
    try {
      for (let i = 0; i < total; i++) {
        const name = state.names[i];
        el.btnGenerate.textContent = '生成中 ' + (i + 1) + '/' + total;
        const blob = await renderOne(name);
        const url = URL.createObjectURL(blob);
        const item = { name, blob, url };
        state.results.push(item);
        addResultCard(item);
        el.resultCount.textContent = state.results.length + ' 张';
        // 让界面有时间刷新进度
        await new Promise((r) => setTimeout(r, 0));
      }
      el.actionHint.textContent = '已生成 ' + total + ' 张邀请函，可一键打包下载 ZIP。';
      toast('批量生成完成：共 ' + total + ' 张');
    } catch (err) {
      toast('生成失败：' + (err && err.message ? err.message : '未知错误'));
    } finally {
      el.btnGenerate.textContent = '⚡ 批量生成';
      setBusy(false);
    }
  }

  /* ---------- 下载 ZIP ---------- */
  async function downloadZip() {
    if (!state.results.length) { toast('请先生成图片'); return; }
    const zip = new JSZip();
    state.results.forEach((r) => {
      zip.file('龙圣人邀请函-' + r.name + '.png', r.blob);
    });
    el.btnDownload.textContent = '打包中…';
    el.btnDownload.disabled = true;
    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '龙圣人邀请函.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      toast('已打包 ' + state.results.length + ' 张图片并开始下载');
    } catch (err) {
      toast('打包失败，请重试');
    } finally {
      el.btnDownload.textContent = '📦 打包下载 ZIP';
      el.btnDownload.disabled = false;
    }
  }

  /* ---------- 重置 ---------- */
  function resetAll() {
    state.bgImage = null;
    state.fileName = '';
    state.results = [];
    state.names = [];
    state.x = DEFAULTS.x;
    state.y = DEFAULTS.y;
    state.scale = 1;

    // 表单复位
    el.fontFamily.value = DEFAULTS.fontFamily;
    el.fontSize.value = DEFAULTS.fontSize;
    el.fontWeight.value = DEFAULTS.fontWeight;
    el.textColor.value = DEFAULTS.textColor;
    el.textColorVal.textContent = DEFAULTS.textColor;
    el.strokeEnabled.checked = DEFAULTS.strokeEnabled;
    el.strokeOptions.hidden = true;
    el.strokeColor.value = DEFAULTS.strokeColor;
    el.strokeColorVal.textContent = DEFAULTS.strokeColor;
    el.strokeWidth.value = DEFAULTS.strokeWidth;
    el.posX.value = DEFAULTS.x;
    el.posY.value = DEFAULTS.y;
    el.namesInput.value = '';
    el.nameCount.textContent = '0 人';
    el.fileInput.value = '';

    // 界面复位
    el.dzIdle.hidden = false;
    el.dzLoaded.hidden = true;
    el.previewEmpty.hidden = false;
    el.previewWrap.hidden = true;
    el.resultsSection.hidden = true;
    el.resultsGrid.innerHTML = '';
    el.resultCount.textContent = '0 张';
    el.previewHint.textContent = '拖拽虚线框调整文字位置 · 点击预览图快速定位';
    el.actionHint.textContent = '上传背景图并输入姓名后，即可开始生成。';
    el.btnGenerate.textContent = '⚡ 批量生成';
    setBusy(false);
    toast('已重置全部配置');
  }

  /* ---------- 事件绑定 ---------- */
  // 上传
  el.dropzone.addEventListener('click', (e) => {
    if (e.target.closest('#btnReplace') === el.btnReplace) return;
    el.fileInput.click();
  });
  el.btnReplace.addEventListener('click', (e) => {
    e.stopPropagation();
    el.fileInput.click();
  });
  el.dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.fileInput.click(); }
  });
  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) loadImageFile(e.target.files[0]);
  });
  ['dragenter', 'dragover'].forEach((ev) =>
    el.dropzone.addEventListener(ev, (e) => { e.preventDefault(); el.dropzone.classList.add('drag'); })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    el.dropzone.addEventListener(ev, (e) => { e.preventDefault(); el.dropzone.classList.remove('drag'); })
  );
  el.dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadImageFile(file);
  });

  // 样式
  el.fontFamily.addEventListener('change', () => { readStyleInputs(); if (state.bgImage) drawPreview(); });
  el.fontWeight.addEventListener('change', () => { readStyleInputs(); if (state.bgImage) drawPreview(); });
  el.fontSize.addEventListener('input', () => { readStyleInputs(); if (state.bgImage) drawPreview(); });
  el.textColor.addEventListener('input', () => {
    state.textColor = el.textColor.value;
    el.textColorVal.textContent = el.textColor.value;
    if (state.bgImage) drawPreview();
  });
  el.strokeEnabled.addEventListener('change', () => {
    state.strokeEnabled = el.strokeEnabled.checked;
    el.strokeOptions.hidden = !state.strokeEnabled;
    if (state.bgImage) drawPreview();
  });
  el.strokeColor.addEventListener('input', () => {
    state.strokeColor = el.strokeColor.value;
    el.strokeColorVal.textContent = el.strokeColor.value;
    if (state.bgImage && state.strokeEnabled) drawPreview();
  });
  el.strokeWidth.addEventListener('input', () => { readStyleInputs(); if (state.bgImage && state.strokeEnabled) drawPreview(); });

  el.posX.addEventListener('input', () => {
    readStyleInputs();
    if (state.bgImage) { positionHandle(); drawPreview(); }
  });
  el.posY.addEventListener('input', () => {
    readStyleInputs();
    if (state.bgImage) { positionHandle(); drawPreview(); }
  });

  // 姓名
  el.namesInput.addEventListener('input', refreshNames);

  // 按钮
  el.btnGenerate.addEventListener('click', generate);
  el.btnDownload.addEventListener('click', downloadZip);
  el.btnReset.addEventListener('click', resetAll);

  // 窗口尺寸变化时重新计算缩放
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (state.bgImage) updatePreviewLayout(); }, 150);
  });

  /* ---------- 初始化 ---------- */
  setBusy(false);
  el.textColorVal.textContent = el.textColor.value;
  el.strokeColorVal.textContent = el.strokeColor.value;
  refreshNames();
})();
