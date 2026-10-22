(() => {
  images.person = 'avatar';
  const form = document.getElementById('tryon-form');
  const canvas = document.getElementById('avatar-canvas');
  const controls = document.getElementById('fit-controls');
  const top = document.getElementById('top-overlay');
  const bottom = document.getElementById('bottom-overlay');
  const state = {
    top: { baseWidth: 132, baseHeight: 163, x: 0, y: 0, scale: 1 },
    bottom: { baseWidth: 105, baseHeight: 180, x: 0, y: 0, scale: 1 },
  };

  function apply(kind) {
    const item = state[kind];
    const element = kind === 'top' ? top : bottom;
    element.style.width = `${item.baseWidth * item.scale}px`;
    element.style.height = `${item.baseHeight * item.scale}px`;
    element.style.marginLeft = `${item.x}px`;
    element.style.marginTop = `${item.y}px`;
  }

  function clamp(min, max, value) { return Math.max(min, Math.min(max, value)); }

  function syncMeasurements() {
    if (document.getElementById('fitting-stage').classList.contains('empty')) return;
    const height = Number(document.getElementById('height').value) || 165;
    const torso = height * .285;
    const inseam = height * .455;
    const chestHalf = clamp(36, 66, (.65 * height + .56 * 55 - 50) / 2);
    const waistHalf = clamp(29, 62, (.48 * height + .48 * 55 - 38) / 2);
    const topLength = Number(document.getElementById('top-length').value);
    const topWidth = Number(document.getElementById('top-width').value);
    const bottomLength = Number(document.getElementById('bottom-length').value);
    const bottomWidth = Number(document.getElementById('bottom-width').value);
    if (topLength > 0) state.top.baseHeight = 163 * clamp(.68, 1.35, topLength / torso);
    if (topWidth > 0) state.top.baseWidth = 132 * clamp(.75, 1.35, topWidth / chestHalf);
    if (bottomLength > 0) state.bottom.baseHeight = 180 * clamp(.65, 1.28, bottomLength / inseam);
    if (bottomWidth > 0) state.bottom.baseWidth = 105 * clamp(.75, 1.4, bottomWidth / waistHalf);
    const avatarScale = clamp(.82, 1.15, height / 165);
    document.getElementById('avatar-body').style.transform = `translateX(-50%) scale(${avatarScale})`;
    bottom.classList.toggle('skirt', document.getElementById('bottom-kind').value === 'skirt');
    bottom.classList.toggle('pants', document.getElementById('bottom-kind').value === 'pants');
    apply('top');
    apply('bottom');
  }

  function resetControls() {
    ['top-size-control', 'bottom-size-control'].forEach((id) => { document.getElementById(id).value = '100'; });
    ['top-y-control', 'bottom-y-control'].forEach((id) => { document.getElementById(id).value = '0'; });
    state.top.x = state.top.y = state.bottom.x = state.bottom.y = 0;
    state.top.scale = state.bottom.scale = 1;
  }

  form.addEventListener('submit', () => {
    requestAnimationFrame(() => {
      if (document.getElementById('fitting-stage').classList.contains('empty')) return;
      canvas.classList.add('avatar-mode');
      const height = Number(document.getElementById('height').value);
      const avatarScale = clamp(.82, 1.15, height / 165);
      document.getElementById('avatar-body').style.transform = `translateX(-50%) scale(${avatarScale})`;
      const face = document.getElementById('person-preview').getAttribute('src');
      const head = document.querySelector('.avatar-head');
      head.style.backgroundImage = face ? `url("${face}")` : '';
      head.classList.toggle('has-face', Boolean(face));
      bottom.classList.toggle('skirt', document.getElementById('bottom-kind').value === 'skirt');
      bottom.classList.toggle('pants', document.getElementById('bottom-kind').value === 'pants');
      controls.hidden = false;
      state.top.baseWidth = parseFloat(getComputedStyle(top).width) || 132;
      state.top.baseHeight = parseFloat(getComputedStyle(top).height) || 163;
      state.bottom.baseWidth = parseFloat(getComputedStyle(bottom).width) || 105;
      state.bottom.baseHeight = parseFloat(getComputedStyle(bottom).height) || 180;
      resetControls();
      apply('top');
      apply('bottom');
    });
  });

  document.getElementById('top-size-control').addEventListener('input', (event) => { state.top.scale = Number(event.target.value) / 100; apply('top'); });
  document.getElementById('bottom-size-control').addEventListener('input', (event) => { state.bottom.scale = Number(event.target.value) / 100; apply('bottom'); });
  document.getElementById('top-y-control').addEventListener('input', (event) => { state.top.y = Number(event.target.value); apply('top'); });
  document.getElementById('bottom-y-control').addEventListener('input', (event) => { state.bottom.y = Number(event.target.value); apply('bottom'); });
  ['height', 'top-length', 'top-width', 'bottom-length', 'bottom-width'].forEach((id) => document.getElementById(id).addEventListener('input', syncMeasurements));
  document.getElementById('bottom-kind').addEventListener('change', syncMeasurements);
  document.getElementById('clear-person').addEventListener('click', () => {
    images.person = 'avatar';
    const head = document.querySelector('.avatar-head');
    head.style.backgroundImage = '';
    head.classList.remove('has-face');
  });

  function enableDrag(element, kind) {
    let pointer = null;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    element.addEventListener('pointerdown', (event) => {
      pointer = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      originX = state[kind].x;
      originY = state[kind].y;
      element.setPointerCapture(pointer);
    });
    element.addEventListener('pointermove', (event) => {
      if (event.pointerId !== pointer) return;
      state[kind].x = originX + event.clientX - startX;
      state[kind].y = originY + event.clientY - startY;
      document.getElementById(`${kind}-y-control`).value = Math.max(-100, Math.min(100, state[kind].y));
      apply(kind);
    });
    const end = (event) => { if (event.pointerId === pointer) pointer = null; };
    element.addEventListener('pointerup', end);
    element.addEventListener('pointercancel', end);
  }

  enableDrag(top, 'top');
  enableDrag(bottom, 'bottom');
  document.getElementById('reset-all').addEventListener('click', () => {
    canvas.classList.remove('avatar-mode');
    images.person = 'avatar';
    controls.hidden = true;
    resetControls();
  });
})();
