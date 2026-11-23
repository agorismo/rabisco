// Galeria pública: lê os posts visíveis pela API REST do Supabase (somente leitura).
import { cfg, restHeaders } from "./cfg.js";

const grid = document.getElementById("grid");
const msg = document.getElementById("msg");
const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load() {
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    msg.textContent = "A galeria precisa do Supabase configurado (veja docs/SETUP.md).";
    return;
  }

  const query = new URLSearchParams({
    // "!posts_user_id_fkey" diz qual relação usar: likes/comments/reports também
    // ligam posts a profiles, e sem a dica o PostgREST responde "HTTP 300".
    select: "id,title,image_path,created_at,profiles!posts_user_id_fkey(username)",
    hidden: "eq.false",
    order: "created_at.desc",
    limit: "48",
  });

  let posts;
  try {
    const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/posts?${query}`, { headers: restHeaders() });
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.json()).message ?? "";
      } catch {
        // resposta sem JSON
      }
      throw new Error(`HTTP ${res.status} ${detail}`.trim());
    }
    posts = await res.json();
  } catch (err) {
    console.error("galeria:", err);
    msg.textContent = `Não consegui carregar a galeria agora (${err.message}).`;
    return;
  }

  if (!posts.length) {
    msg.textContent = "Ainda não há desenhos publicados. Seja a primeira pessoa!";
    return;
  }
  msg.hidden = true;

  for (const p of posts) {
    // tudo vindo do banco é tratado como não confiável
    if (!PATH_RE.test(p.image_path) || !UUID_RE.test(p.id)) continue;

    const card = document.createElement("article");
    card.className = "card";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = String(p.title).slice(0, 80);
    img.src = `${cfg.SUPABASE_URL}/storage/v1/object/public/desenhos/${p.image_path}`;

    const meta = document.createElement("div");
    meta.className = "meta";
    const title = document.createElement("strong");
    title.textContent = p.title;
    const by = document.createElement("span");
    const date = new Date(p.created_at).toLocaleDateString("pt-BR");
    by.textContent = `por ${p.profiles?.username ?? "alguém"} · ${date}`;
    meta.append(title, by);

    const remix = document.createElement("a");
    remix.className = "btn";
    remix.href = `./?remix=${p.id}`;
    remix.textContent = "Remixar";

    card.append(img, meta, remix);
    grid.append(card);
  }
}

load();
