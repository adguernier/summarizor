import dotenv from "dotenv";
import { installGlobalCommands, installGuildCommands } from "./utils/discord";
import { SUMMARIZE_COMMAND } from "./commands/summarize";

dotenv.config();

const commands = [SUMMARIZE_COMMAND];

async function registerCommands() {
  const appId = process.env.APP_ID;
  const guildId = process.env.GUILD_ID;

  if (!appId) {
    throw new Error("Missing APP_ID in environment variables");
  }

  try {
    if (guildId) {
      // Register for specific guild (instant)
      await installGuildCommands(appId, guildId, commands);
    } else {
      // Register globally (takes up to 1 hour)
      await installGlobalCommands(appId, commands);
    }
  } catch (error) {
    console.error("Failed to register commands:", error);
    process.exit(1);
  }
}

registerCommands();
