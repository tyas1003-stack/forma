const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGES = 3;
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function cors(request, env) {
  const origin = request.headers.get("Origin");
  return {
    "Access-Control-Allow-Origin": origin === env.ALLOWED_ORIGIN ? origin : env.ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

export default {
  async fetch(request, env) {
    const headers = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, headers);
    if (request.headers.get("Origin") !== env.ALLOWED_ORIGIN) return json({ error: "Origin tidak diizinkan." }, 403, headers);
    // Keep paid API calls disabled until server-side access protection is configured.
    // CORS alone does not authenticate callers or prevent API credit abuse.
    if (!env.ACCESS_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.ACCESS_TOKEN}`) return json({ error: "Akses AI memerlukan autentikasi." }, 401, headers);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "AI belum dikonfigurasi." }, 503, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Payload tidak valid." }, 400, headers); }
    const images = [body.personImage, body.topImage, body.bottomImage].map(dataUrlToImage);
    if (images.length !== MAX_IMAGES || images.some((image) => !image)) return json({ error: "Gunakan tiga foto JPG, PNG, atau WEBP, maksimal 4 MB per foto." }, 400, headers);

    const measurements = body.measurements || {};
    const numericFields = ["height", "weight", "topLength", "topWidth", "bottomLength", "bottomWidth"];
    if (numericFields.some((key) => !Number.isFinite(Number(measurements[key])))) return json({ error: "Ukuran tubuh atau pakaian belum lengkap." }, 400, headers);

    const prompt = `Kamu adalah asisten virtual try-on. Analisis foto tubuh, atasan, dan bawahan sebagai referensi visual saja; jangan mengidentifikasi orang atau menebak atribut sensitif. Data: tinggi ${measurements.height} cm, berat ${measurements.weight} kg, panjang/lebar atasan ${measurements.topLength}/${measurements.topWidth} cm, panjang/lebar bawahan ${measurements.bottomLength}/${measurements.bottomWidth} cm. Beri jawaban Bahasa Indonesia dengan: (1) kecocokan visual singkat, (2) catatan proporsi atasan dan bawahan, (3) keterbatasan akurasi. Jangan memberi jaminan ukuran.`;
    const message = {
      model: env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
      max_tokens: 450,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }, ...images.map((source) => ({ type: "image", source }))] }],
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(message),
    });
    if (!response.ok) return json({ error: "Layanan AI belum dapat memproses permintaan." }, 502, headers);
    const result = await response.json();
    return json({ analysis: extractText(result) }, 200, headers);
  },
};

