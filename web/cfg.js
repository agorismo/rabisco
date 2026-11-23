// Junta config.js (público) com config.local.js (opcional, só na sua máquina).
import base from "./config.js";

let local = {};
try {
  local = (await import("./config.local.js")).default ?? {};
} catch {
  // config.local.js é opcional
}

export const cfg = { ...base, ...local };

// Cabeçalhos para a API REST do Supabase. Chaves no formato JWT (eyJ...)
// também vão em Authorization; chaves "publishable" vão só em apikey.
export function restHeaders() {
  const h = { apikey: cfg.SUPABASE_ANON_KEY };
  if (cfg.SUPABASE_ANON_KEY.startsWith("eyJ")) h.Authorization = `Bearer ${cfg.SUPABASE_ANON_KEY}`;
  return h;
}
