import { Client, CommandInteraction } from "eris";
import { readdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { config } from "./lib/config.mjs";

const bot = new Client(config.token, { intents: ["guilds"] });

// Carrega cada arquivo de src/commands (exporta `data` e `run`).
const commandsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "commands");
const commands = new Map();
for (const file of (await readdir(commandsDir)).filter((f) => f.endsWith(".mjs"))) {
  const mod = await import(pathToFileURL(path.join(commandsDir, file)).href);
  if (mod.data?.name && typeof mod.run === "function") commands.set(mod.data.name, mod);
}

bot.on("ready", async () => {
  console.log(`Conectado como ${bot.user.username} · ${commands.size} comandos`);
  try {
    await bot.bulkEditCommands([...commands.values()].map((c) => c.data));
  } catch (err) {
    console.error("Falha ao registrar comandos:", err);
  }
});

bot.on("interactionCreate", async (interaction) => {
  if (!(interaction instanceof CommandInteraction)) return;
  const command = commands.get(interaction.data.name);
  if (!command) return;
  try {
    await command.run(interaction);
  } catch (err) {
    console.error(`Erro em /${interaction.data.name}:`, err);
    try {
      await interaction.createMessage({ content: "Algo deu errado. Tente de novo.", flags: 64 });
    } catch {
      // a interação pode já ter sido respondida
    }
  }
});

bot.on("error", (err) => console.error("Erro do cliente:", err));

bot.connect();
