import { config } from "../lib/config.mjs";
import { imageUrl, latestPosts } from "../lib/supabase.mjs";

export const data = {
  name: "galeria",
  description: "Mostra os desenhos mais recentes publicados",
  type: 1,
};

export async function run(interaction) {
  // a consulta pode demorar mais que o prazo inicial de resposta
  await interaction.defer();

  let posts;
  try {
    posts = await latestPosts(5);
  } catch (err) {
    console.error("galeria:", err);
    return interaction.createFollowup({ content: "Não consegui buscar a galeria agora. Tente de novo em instantes." });
  }

  if (!posts.length) {
    return interaction.createFollowup({ content: "Ainda não há desenhos publicados." });
  }

  // Títulos e nomes são de usuários: ficam em embeds, com menções desligadas.
  const embeds = posts.map((p) => ({
    title: String(p.title).slice(0, 256),
    url: `${config.siteUrl}/?remix=${p.id}`,
    description: `por **${String(p.profiles?.username ?? "alguém").slice(0, 32)}**`,
    image: { url: imageUrl(p.image_path) },
    color: 0xff7a8a,
  }));

  return interaction.createFollowup({
    allowedMentions: { everyone: false, roles: false, users: false },
    embeds,
  });
}
