const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGES = 2;
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function cors(request, env) {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": origin === env.ALLOWED_ORIGIN ? origin : env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function dataUrlToImage(value) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value || "");
  if (!match || !ALLOWED_MEDIA_TYPES.has(match[1])) return null;
  const bytes = Math.floor((match[2].length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) return null;
  return { type: "base64", media_type: match[1], data: match[2] };
}

function extractText(payload) {
  return payload.content?.filter((item) => item.type === "text").map((item) => item.text).join("\n") || "";
}

async function rateLimited(request) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  const key = [...new Uint8Array(digest)].slice(0, 12).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const cache = caches.default;
  const cacheKey = new Request(`https://forma-rate-limit.invalid/${key}`);
  const existing = await cache.match(cacheKey);
  const count = existing ? Number(await existing.text()) : 0;
  if (count >= 5) return true;
  await cache.put(cacheKey, new Response(String(count + 1), { headers: { "Cache-Control": "max-age=600" } }));
  return false;
}

export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, headers);
    if (request.headers.get("Origin") !== env.ALLOWED_ORIGIN) return json({ error: "Origin tidak diizinkan." }, 403, headers);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "AI belum dikonfigurasi." }, 503, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Payload tidak valid." }, 400, headers); }
    const images = [body.topImage, body.bottomImage].map(dataUrlToImage);
    if (images.length !== MAX_IMAGES || images.some((image) => !image)) return json({ error: "Gunakan foto baju dan bawahan berformat JPG, PNG, atau WEBP, maksimal 4 MB per foto." }, 400, headers);

    const measurements = body.measurements || {};
    const numericFields = ["height", "weight", "topLength", "topWidth", "bottomLength", "bottomWidth"];
    if (numericFields.some((key) => !Number.isFinite(Number(measurements[key])))) return json({ error: "Ukuran tubuh atau pakaian belum lengkap." }, 400, headers);
    const ranges = { height: [120, 230], weight: [30, 250], topLength: [20, 180], topWidth: [20, 120], bottomLength: [25, 150], bottomWidth: [20, 90] };
    if (numericFields.some((key) => Number(measurements[key]) < ranges[key][0] || Number(measurements[key]) > ranges[key][1])) return json({ error: "Ada ukuran di luar rentang yang didukung." }, 400, headers);
    if (await rateLimited(request)) return json({ error: "Batas analisis sementara tercapai. Coba lagi sekitar 10 menit." }, 429, headers);

    const prompt = `Kamu adalah asisten virtual try-on. Analisis foto atasan dan bawahan sebagai referensi visual saja; jangan mengidentifikasi orang atau menebak atribut sensitif. Data: tinggi ${measurements.height} cm, berat ${measurements.weight} kg, panjang/lebar atasan ${measurements.topLength}/${measurements.topWidth} cm, panjang/lebar bawahan ${measurements.bottomLength}/${measurements.bottomWidth} cm. Beri jawaban Bahasa Indonesia dengan: (1) kecocokan visual singkat, (2) catatan proporsi atasan dan bawahan, (3) keterbatasan akurasi. Jangan memberi jaminan ukuran.`;
    const requestedModel = env.CLAUDE_MODEL;
    const model = requestedModel && requestedModel !== "claude-haiku-5-5"
      ? requestedModel
      : "claude-haiku-4-5-20251001";
    const message = {
      model,
      max_tokens: 450,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...images.map((source) => ({ type: "image", source }))] }],
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    let response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
    } catch {
      clearTimeout(timeout);
      return json({ error: "Layanan AI tidak merespons tepat waktu." }, 504, headers);
    }
    clearTimeout(timeout);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const type = result?.error?.type || "";
      const detail = String(result?.error?.message || "");
      const normalizedDetail = detail.toLowerCase();
      if (response.status === 401 || type === "authentication_error") {
        return json({ error: "Kunci API Anthropic tidak valid. Perbarui ANTHROPIC_API_KEY di Cloudflare." }, 502, headers);
      }
      if (response.status === 402 || type === "billing_error" || normalizedDetail.includes("credit balance") || normalizedDetail.includes("billing")) {
        return json({ error: "Kredit API Anthropic tidak mencukupi. Periksa billing di Anthropic Console." }, 502, headers);
      }
      if (response.status === 429 || type === "rate_limit_error") {
        return json({ error: "Anthropic sedang membatasi permintaan. Coba lagi beberapa menit." }, 429, headers);
      }
      if (normalizedDetail.includes("image")) {
        return json({ error: "Claude menolak salah satu gambar. Upload ulang foto JPG/PNG yang jelas lalu coba lagi." }, 400, headers);
      }
      if (normalizedDetail.includes("model")) {
        return json({ error: "Model Claude belum tersedia untuk API key ini. Periksa akses model di Anthropic Console." }, 400, headers);
      }
      if (response.status === 400 || type === "invalid_request_error") {
        const safeDetail = detail.replace(/[\r\n]+/g, " ").slice(0, 180);
        return json({ error: safeDetail ? `Anthropic menolak permintaan: ${safeDetail}` : "Anthropic menolak permintaan. Periksa pengaturan API Anthropic." }, 400, headers);
      }
      return json({ error: "Layanan Claude sedang bermasalah. Coba lagi beberapa saat." }, 502, headers);
    }
    return json({ analysis: extractText(result) }, 200, headers);
  },
};

