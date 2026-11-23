// Acesso somente leitura aos posts públicos, pela API REST (sem SDK).
// O bot usa só a chave anon: quem decide o que é visível é a RLS do banco.
import { config } from "./config.mjs";

const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.png$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function headers() {
  const h = { apikey: config.supabaseKey };
  if (config.supabaseKey.startsWith("eyJ")) h.Authorization = `Bearer ${config.supabaseKey}`;
  return h;
}

export function imageUrl(path) {
  return `${config.supabaseUrl}/storage/v1/object/public/desenhos/${path}`;
}

export async function latestPosts(limit = 5) {
  const query = new URLSearchParams({
    select: "id,title,image_path,created_at,profiles(username)",
    hidden: "eq.false",
    order: "created_at.desc",
    limit: String(Math.min(Math.max(limit, 1), 10)),
  });
  const res = await fetch(`${config.supabaseUrl}/rest/v1/posts?${query}`, { headers: headers() });
  if (!res.ok) throw new Error(`Supabase respondeu ${res.status}`);
  const rows = await res.json();
  return rows.filter((p) => PATH_RE.test(p.image_path) && UUID_RE.test(p.id));
}
