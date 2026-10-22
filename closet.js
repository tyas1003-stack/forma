(() => {
  const KEY = 'forma-closet-v1';
  const blank = { items: [], looks: [], plans: [], packing: [] };
  let data;
  try { data = { ...blank, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { data = structuredClone(blank); }
  let filter = 'Semua';
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value).replace(/[&<>"']/g, (ch) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const save = () => { localStorage.setItem(KEY, JSON.stringify(data)); render(); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);

  function itemCard(item) {
    return `<div class="local-item ${item.archived ? 'is-archived' : ''}"><div class="item-icon">${item.wishlist ? '♡' : '◇'}</div><div><strong>${esc(item.name)}</strong><small>${esc(item.category)} · ${esc(item.color || 'Tanpa warna')}${item.tag ? ' · #' + esc(item.tag) : ''}</small><p>${esc(item.note || '')}</p></div><div class="item-actions"><button data-action="archive" data-id="${item.id}" type="button">${item.archived ? 'Pulihkan' : 'Arsip'}</button><button data-action="delete-item" data-id="${item.id}" type="button">Hapus</button></div></div>`;
  }

  function render() {
    const visible = data.items.filter((item) => filter === 'Semua' ? !item.archived : filter === 'Wishlist' ? item.wishlist && !item.archived : filter === 'Arsip' ? item.archived : item.category === filter && !item.archived);
    $('wardrobe-list').innerHTML = visible.length ? visible.map(itemCard).join('') : '<p class="empty-copy">Belum ada item pada kategori ini.</p>';
    $('wardrobe-count').textContent = `${data.items.filter(x => !x.archived).length} item`;
    $('looks-count').textContent = `${data.looks.length} look`;
    $('planner-count').textContent = `${data.plans.length} rencana`;
    $('looks-list').innerHTML = data.looks.length ? data.looks.map((look) => `<div class="local-item look-item"><div class="look-swatches"><i style="background:${look.topColor}"></i><i style="background:${look.bottomColor}"></i></div><div><strong>${esc(look.name)}</strong><small>${esc(look.summary)}</small></div><div class="item-actions"><button data-action="delete-look" data-id="${look.id}" type="button">Hapus</button></div></div>`).join('') : '<p class="empty-copy">Look yang kamu simpan akan muncul di sini.</p>';
    $('planner-look').innerHTML = '<option value="">Pilih look tersimpan</option>' + data.looks.map((look) => `<option value="${look.id}">${esc(look.name)}</option>`).join('');
    $('planner-list').innerHTML = data.plans.length ? data.plans.sort((a,b) => a.date.localeCompare(b.date)).map((plan) => `<div class="local-item"><div class="date-tile"><b>${new Date(plan.date + 'T00:00:00').getDate()}</b><span>${new Date(plan.date + 'T00:00:00').toLocaleDateString('id-ID',{month:'short'})}</span></div><div><strong>${esc(plan.occasion)}</strong><small>${esc(plan.lookName)}</small></div><div class="item-actions"><button data-action="delete-plan" data-id="${plan.id}" type="button">Selesai</button></div></div>`).join('') : '<p class="empty-copy">Belum ada outfit yang dijadwalkan.</p>';
    $('packing-list').innerHTML = data.packing.map((entry) => `<label><input type="checkbox" data-pack="${entry.id}" ${entry.done ? 'checked' : ''}/><span>${esc(entry.name)}</span><button data-action="delete-pack" data-id="${entry.id}" type="button">×</button></label>`).join('');
    $('stat-items').textContent = data.items.filter(x => !x.archived).length;
    $('stat-wishlist').textContent = data.items.filter(x => x.wishlist && !x.archived).length;
    $('stat-looks').textContent = data.looks.length;
    $('stat-plans').textContent = data.plans.length;
  }

  $('wardrobe-form').addEventListener('submit', (event) => {
    event.preventDefault();
    data.items.unshift({ id:uid(), name:$('wardrobe-name').value.trim(), category:$('wardrobe-category').value, color:$('wardrobe-color').value.trim(), tag:$('wardrobe-tag').value.trim(), note:$('wardrobe-note').value.trim(), wishlist:$('wardrobe-wishlist').checked, archived:false });
    event.target.reset(); save();
  });
  document.querySelectorAll('.filter-chip').forEach((button) => button.addEventListener('click', () => {
    filter = button.dataset.filter;
    document.querySelectorAll('.filter-chip').forEach(x => x.classList.toggle('active', x === button));
    render();
  }));
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'archive') { const item = data.items.find(x => x.id === id); if (item) item.archived = !item.archived; }
    if (action === 'delete-item') data.items = data.items.filter(x => x.id !== id);
    if (action === 'delete-look') data.looks = data.looks.filter(x => x.id !== id);
    if (action === 'delete-plan') data.plans = data.plans.filter(x => x.id !== id);
    if (action === 'delete-pack') data.packing = data.packing.filter(x => x.id !== id);
    save();
  });
  document.addEventListener('change', (event) => {
    if (!event.target.matches('[data-pack]')) return;
    const entry = data.packing.find(x => x.id === event.target.dataset.pack);
    if (entry) { entry.done = event.target.checked; save(); }
  });
  $('planner-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const look = data.looks.find(x => x.id === $('planner-look').value);
    if (!look) return;
    data.plans.push({ id:uid(), date:$('planner-date').value, occasion:$('planner-occasion').value.trim(), lookName:look.name });
    event.target.reset(); save();
  });
  $('packing-add').addEventListener('click', () => {
    const name = $('packing-input').value.trim(); if (!name) return;
    data.packing.push({ id:uid(), name, done:false }); $('packing-input').value=''; save();
  });
  $('save-look').addEventListener('click', () => {
    const top = $('top-preview').getAttribute('src');
    const bottom = $('bottom-preview').getAttribute('src');
    if (!top || !bottom) return;
    const date = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'short'});
    data.looks.unshift({ id:uid(), name:`Look ${date}`, summary:`${$('top-length').value} cm atasan · ${$('bottom-kind').value === 'skirt' ? 'rok' : 'celana'} ${$('bottom-length').value} cm`, topColor:'#e8998c', bottomColor:'#b9d7e4' });
    save(); $('looks').scrollIntoView({behavior:'smooth'});
  });
  $('share-look').addEventListener('click', async () => {
    const shareData = { title:'FORMA look', text:'Aku baru membuat kombinasi outfit di FORMA.', url:location.href };
    if (navigator.share) { try { await navigator.share(shareData); } catch {} }
    else { await navigator.clipboard.writeText(location.href); $('share-look').textContent='✓ Link disalin'; }
  });
  $('tryon-form').addEventListener('submit', () => requestAnimationFrame(() => { if (!$('fitting-stage').classList.contains('empty')) $('look-actions').hidden = false; }));
  $('reset-all').addEventListener('click', () => { $('look-actions').hidden = true; });
  render();
})();
