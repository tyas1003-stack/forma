(() => {
  const endpoint = 'https://forma-ai-proxy.tyas1003.workers.dev';
  const consent = document.getElementById('ai-consent');
  const button = document.getElementById('ai-analyze');
  const status = document.getElementById('ai-status');
  const result = document.getElementById('ai-result');
  const resultText = document.getElementById('ai-result-text');
  let controller = null;
  const number = (id) => Number(document.getElementById(id)?.value);
  const image = (id) => document.getElementById(id)?.getAttribute('src') || null;

  function getTryOnData() {
    return {
      topImage: image('top-preview'),
      bottomImage: image('bottom-preview'),
      measurements: {
        height: number('height'),
        weight: number('weight') || 55,
        topLength: number('top-length'),
        topWidth: number('top-width'),
        bottomLength: number('bottom-length'),
        bottomWidth: number('bottom-width'),
      },
    };
  }

  function clearAnalysis() {
    controller?.abort();
    controller = null;
    consent.checked = false;
    status.textContent = '';
    result.hidden = true;
    resultText.textContent = '';
    button.disabled = false;
  }

  function validate(data) {
    if (!data.topImage || !data.bottomImage) return 'Upload dan crop foto baju serta bawahan terlebih dahulu.';
    if (Object.values(data.measurements).some((value) => !Number.isFinite(value) || value <= 0)) return 'Lengkapi tinggi dan seluruh ukuran pakaian.';
    if (!consent.checked) return 'Centang persetujuan pengiriman foto sebelum memakai Gemini.';
    return '';
  }

  button.addEventListener('click', async () => {
    const data = getTryOnData();
    const validationError = validate(data);
    if (validationError) {
      status.textContent = validationError;
      return;
    }
    controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 65000);
    button.disabled = true;
    result.hidden = true;
    status.textContent = 'Gemini sedang membaca foto dan ukuran…';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Gemini belum dapat memproses permintaan.');
      resultText.textContent = payload.analysis || 'Gemini tidak mengembalikan catatan.';
      result.hidden = false;
      status.textContent = 'Analisis selesai.';
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (requestError) {
      status.textContent = requestError.name === 'AbortError' ? 'Permintaan terlalu lama. Silakan coba lagi.' : requestError.message;
    } finally {
      clearTimeout(timeout);
      controller = null;
      button.disabled = false;
    }
  });

  document.getElementById('ai-clear')?.addEventListener('click', clearAnalysis);
  window.addEventListener('pagehide', () => controller?.abort());
})();
