import { randomBytes } from "node:crypto";
import { config } from "../lib/config.mjs";

export const data = {
  name: "desenhar",
  description: "Cria uma sala de desenho colaborativo e devolve o link",
  type: 1,
};

export async function run(interaction) {
  const room = randomBytes(6).toString("hex");
  const link = `${config.siteUrl}/?sala=${room}`;

  await interaction.createMessage({
    allowedMentions: { everyone: false, roles: false, users: false },
    embeds: [
      {
        title: "🖍️ Sala de desenho criada",
        description: `Entre e desenhe junto: ${link}\n\nQuem tiver o link pode participar.`,
        color: 0xff7a8a,
      },
    ],
  });
}
