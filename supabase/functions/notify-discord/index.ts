// Edge Function: avisa no Discord quando um post novo é criado.
// Chamada por um Database Webhook (INSERT em public.posts).
//
// Secrets necessários (supabase secrets set ...):
//   WEBHOOK_SECRET       valor igual ao cabeçalho x-webhook-secret do webhook
//   DISCORD_WEBHOOK_URL  URL do webhook do canal (é um segredo!)
//   SITE_URL             endereço público do site, sem barra no final
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já são injetados pelo Supabase.

const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET");
const DISCORD_WEBHOOK_URL = Deno.env.get("DISCORD_WEBHOOK_URL");
const SITE_URL = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/i;

// Comparação em tempo constante para o segredo.
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const given = req.headers.get("x-webhook-secret") ?? "";
  if (!WEBHOOK_SECRET || !safeEqual(given, WEBHOOK_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }
  if (!DISCORD_WEBHOOK_URL) return new Response("webhook not configured", { status: 500 });

  let body: { type?: string; table?: string; record?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const post = body.record;
  if (body.type !== "INSERT" || body.table !== "posts" || !post) return new Response("ignored", { status: 200 });
  if (post.hidden === true) return new Response("hidden", { status: 200 });

  const id = String(post.id ?? "");
  const userId = String(post.user_id ?? "");
  const imagePath = String(post.image_path ?? "");
  if (!UUID_RE.test(id) || !UUID_RE.test(userId) || !PATH_RE.test(imagePath)) {
    return new Response("invalid record", { status: 400 });
  }

  // Busca o nome de quem postou (os valores acima já foram validados).
  let username = "alguém";
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=username`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows[0]?.username) username = String(rows[0].username);
    }
  } catch {
    // segue com o nome padrão
  }

  const payload = {
    username: "Rabisco",
    // Evita que títulos ou nomes com @everyone/@here/menções façam ping.
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: String(post.title ?? "Novo desenho").slice(0, 256),
        url: SITE_URL ? `${SITE_URL}/?remix=${id}` : undefined,
        description: `por **${username.slice(0, 32)}**${SITE_URL ? " · clique para remixar" : ""}`,
        image: { url: `${SUPABASE_URL}/storage/v1/object/public/desenhos/${imagePath}` },
        color: 0xff7a8a,
      },
    ],
  };

  const out = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return new Response(out.ok ? "ok" : "discord error", { status: out.ok ? 200 : 502 });
});
