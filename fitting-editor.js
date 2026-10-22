(() => {
  const form = document.getElementById('tryon-form');
  const canvas = document.getElementById('avatar-canvas');
  const person = document.getElementById('person-stage-photo');
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

  function resetControls() {
    ['top-size-control', 'bottom-size-control'].forEach((id) => { document.getElementById(id).value = '100'; });
    ['top-y-control', 'bottom-y-control'].forEach((id) => { document.getElementById(id).value = '0'; });
    state.top.x = state.top.y = state.bottom.x = state.bottom.y = 0;
    state.top.scale = state.bottom.scale = 1;
  }

  form.addEventListener('submit', () => {
    requestAnimationFrame(() => {
      if (document.getElementById('fitting-stage').classList.contains('empty')) return;
      const source = document.getElementById('person-preview').getAttribute('src');
      if (!source) return;
      person.src = source;
      canvas.classList.add('photo-mode');
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
    canvas.classList.remove('photo-mode');
    person.removeAttribute('src');
    controls.hidden = true;
    resetControls();
  });
})();
