(() => {
  const endpoint = 'https://forma-ai-proxy.tyas1003.workers.dev';
  const access = document.getElementById('ai-access');
  const consent = document.getElementById('ai-consent');
  const button = document.getElementById('ai-analyze');
  const status = document.getElementById('ai-status');
  const result = document.getElementById('ai-result');
  const resultText = document.getElementById('ai-result-text');
  let controller = null;

  function getTryOnData() {
    const number = (id) => Number(document.getElementById(id).value);
    const image = (id) => document.getElementById(id).getAttribute('src') || null;
    return {
      personImage: image('person-preview'),
      topImage: image('top-preview'),
      bottomImage: image('bottom-preview'),
      measurements: {
        height: number('height'),
        weight: number('weight'),
        topLength: number('top-length'),
        topWidth: number('top-width'),
        bottomLength: number('bottom-length'),
        bottomWidth: number('bottom-width'),
      },
    };
  }

  function clearAnalysis() {
    if (controller) controller.abort();
    controller = null;
    access.value = '';
    consent.checked = false;
    status.textContent = '';
    result.hidden = true;
    resultText.textContent = '';
    button.disabled = false;
  }

  function validate(data) {
    if (!data.personImage || !data.topImage || !data.bottomImage) return 'Upload dan crop foto badan, baju, dan celana terlebih dahulu.';
    if (Object.values(data.measurements).some((value) => !Number.isFinite(value) || value <= 0)) return 'Lengkapi tinggi, berat, dan seluruh ukuran pakaian.';
    if (!access.value.trim()) return 'Masukkan kode akses privat.';
    if (!consent.checked) return 'Centang persetujuan pengiriman foto sebelum memakai Claude.';
    return '';
  }

  button.addEventListener('click', async () => {
    const data = getTryOnData();
    const error = validate(data);
    if (error) { status.textContent = error; return; }

    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65000);
    button.disabled = true;
    result.hidden = true;
    status.textContent = 'Claude sedang membaca foto dan ukuran…';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access.value.trim()}` },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 401) throw new Error('Kode akses tidak cocok. Periksa ACCESS_TOKEN di Cloudflare.');
        throw new Error(payload.error || 'Claude belum dapat memproses permintaan.');
      }
      resultText.textContent = payload.analysis || 'Claude tidak mengembalikan catatan.';
      result.hidden = false;
      status.textContent = 'Analisis selesai.';
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      status.textContent = error.name === 'AbortError' ? 'Permintaan terlalu lama. Silakan coba lagi.' : error.message;
    } finally {
      clearTimeout(timeout);
      controller = null;
      button.disabled = false;
    }
  });

  document.getElementById('ai-clear').addEventListener('click', clearAnalysis);
  window.addEventListener('pagehide', () => { if (controller) controller.abort(); access.value = ''; });
})();
