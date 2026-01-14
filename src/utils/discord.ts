import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const DISCORD_API_BASE = "https://discord.com/api/v10";

export async function discordRequest(endpoint: string, options: any = {}) {
  const url = `${DISCORD_API_BASE}/${endpoint}`;

  if (options.body) {
    options.body = JSON.stringify(options.body);
  }

  const response = await axios({
    url,
    method: options.method || "GET",
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      "Content-Type": "application/json; charset=UTF-8",
      "User-Agent": "CuraBot (https://github.com/yourorg/curabot, 1.0.0)",
      ...options.headers,
    },
    data: options.body,
  });
  console.log(
    `🔗 Discord API ${options.method || "GET"} ${endpoint} - Status: ${
      response.status
    }`
  );
  console.log("Response data:", response.data);
  return response;
}

export async function installGlobalCommands(appId: string, commands: any[]) {
  const endpoint = `applications/${appId}/commands`;

  try {
    console.log(`🔄 Installing ${commands.length} global commands...`);
    await discordRequest(endpoint, { method: "PUT", body: commands });
    console.log(`✅ Successfully installed ${commands.length} global commands`);
  } catch (error) {
    console.error("❌ Error installing commands:", error);
    throw error;
  }
}

export async function installGuildCommands(
  appId: string,
  guildId: string,
  commands: any[]
) {
  const endpoint = `applications/${appId}/guilds/${guildId}/commands`;

  try {
    console.log(`🔄 Installing ${commands.length} guild commands...`);
    await discordRequest(endpoint, { method: "PUT", body: commands });
    console.log(`✅ Successfully installed ${commands.length} guild commands`);
  } catch (error) {
    console.error("❌ Error installing guild commands:", error);
    throw error;
  }
}
