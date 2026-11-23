// Configuração PÚBLICA do site (pode ir para o Git).
// A chave "anon"/"publishable" do Supabase foi feita para ficar no navegador:
// quem protege os dados é a RLS do banco (veja supabase/migrations).
//
// NUNCA coloque aqui: a chave de serviço do Supabase, tokens do Discord, URLs de webhook.
//
// Para desenvolver com o SEU projeto Supabase, não edite este arquivo:
// copie config.local.example.js para config.local.js (ignorado pelo Git).
export default {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
};
