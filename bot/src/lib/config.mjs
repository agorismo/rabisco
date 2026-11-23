import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Variável de ambiente ausente: ${name} (veja bot/.env.example)`);
    process.exit(1);
  }
  return value;
}

export const config = {
  token: required("DISCORD_TOKEN"),
  supabaseUrl: required("SUPABASE_URL").replace(/\/$/, ""),
  supabaseKey: required("SUPABASE_ANON_KEY"),
  siteUrl: required("SITE_URL").replace(/\/$/, ""),
};
