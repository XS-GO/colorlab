/**
 * 读取 JPEG EXIF Orientation (1-8)
 */
function readExifOrientation(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const view = new DataView(e.target.result);
      if (view.byteLength < 2 || view.getUint16(0, false) !== 0xffd8) {
        resolve(1);
        return;
      }
      let offset = 2;
      while (offset < view.byteLength - 4) {
        const marker = view.getUint16(offset, false);
        if (marker === 0xffe1) {
          const len = view.getUint16(offset + 2, false);
          if (view.getUint32(offset + 4, false) !== 0x45786966) {
            resolve(1);
            return;
          }
          const tiff = offset + 10;
          const little = view.getUint16(tiff, false) === 0x4949;
          const get16 = o => view.getUint16(o, little);
          const get32 = o => view.getUint32(o, little);
          const ifd = tiff + get32(tiff + 4);
          const n = get16(ifd);
          for (let i = 0; i < n; i++) {
            const entry = ifd + 2 + i * 12;
            if (get16(entry) === 0x0112) {
              resolve(get16(entry + 8) || 1);
              return;
            }
          }
          resolve(1);
          return;
        }
        if ((marker & 0xff00) !== 0xff00) break;
        offset += 2 + view.getUint16(offset + 2, false);
      }
      resolve(1);
    };
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file.slice(0, 65536));
  });
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

/** 按 EXIF 方向绘制到 canvas，返回校正后的 canvas */
function drawOriented(img, orientation) {
  const w = img.width;
  const h = img.height;
  let cw = w, ch = h;
  if (orientation >= 5 && orientation <= 8) { cw = h; ch = w; }

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  switch (orientation) {
    case 2: ctx.transform(-1, 0, 0, 1, w, 0); break;
    case 3: ctx.transform(-1, 0, 0, -1, w, h); break;
    case 4: ctx.transform(1, 0, 0, -1, 0, h); break;
    case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
    case 6: ctx.transform(0, 1, -1, 0, h, 0); break;
    case 7: ctx.transform(0, -1, -1, 0, h, w); break;
    case 8: ctx.transform(0, -1, 1, 0, 0, w); break;
    default: break;
  }
  ctx.drawImage(img, 0, 0);
  return canvas;
}

function canvasToImage(canvas) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = canvas.toDataURL('image/jpeg', 0.92);
  });
}

/**
 * 加载照片并自动校正方向（iPhone EXIF + 浏览器兼容）
 */
async function loadOrientedImage(file) {
  // 优先：createImageBitmap 自动读 EXIF（iOS 15.4+ / 现代 Safari）
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      if (bitmap.close) bitmap.close();
      return canvasToImage(canvas);
    } catch (_) { /* fallback */ }
  }

  const [orientation, img] = await Promise.all([
    readExifOrientation(file),
    fileToImage(file),
  ]);
  const canvas = drawOriented(img, orientation);
  return canvasToImage(canvas);
}

window.loadOrientedImage = loadOrientedImage;
