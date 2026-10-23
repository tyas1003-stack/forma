(() => {
  const dialog = document.getElementById('photo-editor');
  const stage = document.getElementById('crop-stage');
  const canvas = document.getElementById('crop-canvas');
  const ctx = canvas.getContext('2d');
  const zoomInput = document.getElementById('crop-zoom');
  const sizeInput = document.getElementById('crop-size');
  const pointers = new Map();
  const ratios = { person: 1, top: 4 / 5, bottom: 3 / 4 };
  const state = { key: null, image: null, zoom: 1, rotation: 0, x: 0, y: 0, onSave: null, hadImage: false, lastDistance: 0 };

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = source instanceof File ? URL.createObjectURL(source) : null;
      image.onload = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); resolve(image); };
      image.onerror = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); reject(new Error('Gambar tidak dapat dibuka.')); };
      image.src = objectUrl || source;
    });
  }

  function canvasSize() {
    const ratio = ratios[state.key] || 1;
    const maxWidth = Math.min(stage.clientWidth || 520, 520);
    const maxHeight = Math.min(window.innerHeight * .52, 500);
    let width = maxWidth;
    let height = width / ratio;
    if (height > maxHeight) { height = maxHeight; width = height * ratio; }
    return { width: Math.round(width), height: Math.round(height) };
  }

  function rotatedDimensions() {
    const sideways = state.rotation % 180 !== 0;
    return { width: sideways ? state.image.naturalHeight : state.image.naturalWidth, height: sideways ? state.image.naturalWidth : state.image.naturalHeight };
  }

  function transformFor(width, height) {
    const rotated = rotatedDimensions();
    const baseScale = Math.max(width / rotated.width, height / rotated.height);
    return { scale: baseScale * state.zoom, offsetX: state.x * (width / canvas.clientWidth), offsetY: state.y * (height / canvas.clientHeight) };
  }

  function draw(target = ctx, width = canvas.width, height = canvas.height, forExport = false) {
    if (!state.image) return;
    const dpr = forExport ? 1 : window.devicePixelRatio || 1;
    const logicalWidth = forExport ? width : canvas.clientWidth;
    const logicalHeight = forExport ? height : canvas.clientHeight;
    const transform = transformFor(logicalWidth, logicalHeight);
    target.save();
    target.setTransform(dpr, 0, 0, dpr, 0, 0);
    target.clearRect(0, 0, logicalWidth, logicalHeight);
    if (!forExport) {
      target.fillStyle = '#eef0ea';
      target.fillRect(0, 0, logicalWidth, logicalHeight);
    }
    target.translate(logicalWidth / 2 + transform.offsetX, logicalHeight / 2 + transform.offsetY);
    target.rotate(state.rotation * Math.PI / 180);
    target.scale(transform.scale, transform.scale);
    target.drawImage(state.image, -state.image.naturalWidth / 2, -state.image.naturalHeight / 2);
    target.restore();
  }

  function resizeCanvas() {
    const { width, height } = canvasSize();
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    draw();
  }

  async function open({ key, source, onSave }) {
    try {
      state.key = key;
      state.image = await loadImage(source);
      state.zoom = 1;
      state.rotation = 0;
      state.x = 0;
      state.y = 0;
      state.onSave = onSave;
      state.hadImage = typeof source === 'string';
      zoomInput.value = '1';
      document.getElementById('editor-help').textContent = key === 'person'
        ? 'Posisikan wajah memenuhi oval: dari dahi sampai dagu. Leher dan background akan dipotong.'
        : 'Geser foto di dalam bingkai. Gunakan zoom agar objek memenuhi area.';
      dialog.showModal();
      requestAnimationFrame(resizeCanvas);
    } catch (error) {
      document.getElementById('form-error').textContent = error.message;
    }
  }

  function distance() {
    const values = [...pointers.values()];
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  }

  canvas.addEventListener('pointerdown', (event) => { canvas.setPointerCapture(event.pointerId); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); state.lastDistance = distance(); });
  canvas.addEventListener('pointermove', (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const next = { x: event.clientX, y: event.clientY };
    pointers.set(event.pointerId, next);
    if (pointers.size === 1) { state.x += next.x - previous.x; state.y += next.y - previous.y; }
    if (pointers.size >= 2) { const currentDistance = distance(); if (state.lastDistance) state.zoom = Math.max(1, Math.min(3, state.zoom * currentDistance / state.lastDistance)); state.lastDistance = currentDistance; zoomInput.value = state.zoom.toFixed(2); }
    draw();
  });
  function endPointer(event) { pointers.delete(event.pointerId); state.lastDistance = distance(); }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  zoomInput.addEventListener('input', () => { state.zoom = Number(zoomInput.value); draw(); });
  document.getElementById('crop-rotate').addEventListener('click', () => { state.rotation = (state.rotation + 90) % 360; state.x = 0; state.y = 0; resizeCanvas(); });
  function removeEdgeBackground(output) {
    const context = output.getContext('2d', { willReadFrequently: true });
    const frame = context.getImageData(0, 0, output.width, output.height);
    const pixels = frame.data;
    const visited = new Uint8Array(output.width * output.height);
    const queue = [];
    const sample = (x, y) => {
      const colors = [];
      for (let oy = 0; oy < 8; oy += 2) for (let ox = 0; ox < 8; ox += 2) {
        const px = Math.min(output.width - 1, Math.max(0, x + ox));
        const py = Math.min(output.height - 1, Math.max(0, y + oy));
        const offset = (py * output.width + px) * 4;
        colors.push([pixels[offset], pixels[offset + 1], pixels[offset + 2]]);
      }
      return colors;
    };
    const backgrounds = [
      ...sample(0, 0), ...sample(output.width - 8, 0),
      ...sample(0, output.height - 8), ...sample(output.width - 8, output.height - 8)
    ];
    const isBackground = (index) => {
      const offset = index * 4;
      const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2], a = pixels[offset + 3];
      if (a < 12) return true;
      const neutralLight = Math.min(r, g, b) > 218 && Math.max(r, g, b) - Math.min(r, g, b) < 34;
      return neutralLight || backgrounds.some(([br, bg, bb]) => {
        const distance = Math.hypot(r - br, g - bg, b - bb);
        return distance < 52;
      });
    };
    const add = (index) => { if (!visited[index] && isBackground(index)) { visited[index] = 1; queue.push(index); } };
    for (let x = 0; x < output.width; x++) { add(x); add((output.height - 1) * output.width + x); }
    for (let y = 0; y < output.height; y++) { add(y * output.width); add(y * output.width + output.width - 1); }
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const index = queue[cursor], x = index % output.width, y = Math.floor(index / output.width);
      pixels[index * 4 + 3] = 0;
      if (x > 0) add(index - 1);
      if (x + 1 < output.width) add(index + 1);
      if (y > 0) add(index - output.width);
      if (y + 1 < output.height) add(index + output.width);
    }
    for (let index = 0; index < visited.length; index++) {
      if (visited[index]) continue;
      const x = index % output.width, y = Math.floor(index / output.width);
      const touchesClear = (x > 0 && visited[index - 1]) || (x + 1 < output.width && visited[index + 1]) ||
        (y > 0 && visited[index - output.width]) || (y + 1 < output.height && visited[index + output.width]);
      if (touchesClear) pixels[index * 4 + 3] = Math.min(pixels[index * 4 + 3], 150);
    }
    context.putImageData(frame, 0, 0);
  }
  function maskFace(output) {
    const context = output.getContext('2d');
    context.globalCompositeOperation = 'destination-in';
    context.beginPath();
    context.moveTo(output.width * .5, output.height * .015);
    context.bezierCurveTo(output.width * .75, output.height * .01, output.width * .91, output.height * .17, output.width * .92, output.height * .42);
    context.bezierCurveTo(output.width * .91, output.height * .67, output.width * .73, output.height * .91, output.width * .5, output.height * .985);
    context.bezierCurveTo(output.width * .27, output.height * .91, output.width * .09, output.height * .67, output.width * .08, output.height * .42);
    context.bezierCurveTo(output.width * .09, output.height * .17, output.width * .25, output.height * .01, output.width * .5, output.height * .015);
    context.closePath();
    context.fill();
    context.globalCompositeOperation = 'source-over';
  }
  document.getElementById('crop-save').addEventListener('click', () => {
    const widths = { small: 720, standard: 1080, large: 1600 };
    const width = widths[sizeInput.value] || 1080;
    const height = Math.round(width / (ratios[state.key] || 1));
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    draw(output.getContext('2d'), width, height, true);
    if (state.key === 'top' || state.key === 'bottom') removeEdgeBackground(output);
    if (state.key === 'person') maskFace(output);
    state.onSave(output.toDataURL('image/png'));
    state.hadImage = true;
    dialog.close('saved');
  });
  dialog.addEventListener('close', () => { if (dialog.returnValue !== 'saved' && !state.hadImage && state.key) document.getElementById(`${state.key}-photo`).value = ''; pointers.clear(); });
  window.addEventListener('resize', () => { if (dialog.open) resizeCanvas(); });
  window.photoEditor = { open };
})();
