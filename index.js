import { Client, GatewayIntentBits } from "discord.js";

// BOT TOKEN を環境変数から読み込む
const TOKEN = process.env.DISCORD_BOT_TOKEN;

// Bot クライアントを作成
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// Bot 起動時
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Discord にログイン
client.login(TOKEN);
