import { Client, GatewayIntentBits } from "discord.js";
import { GoogleSpreadsheet } from "google-spreadsheet";
import cron from "node-cron";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const SHEET_ID = process.env.YOUR_SHEET_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

const doc = new GoogleSpreadsheet(SHEET_ID);

async function accessSheet() {
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  });
  await doc.loadInfo();
  return doc.sheetsByTitle["Data"];
}

// 月次チェック: 過去3ヶ月未決済ユーザーをキック
async function monthlyCheck() {
  const sheet = await accessSheet();
  const rows = await sheet.getRows();
  const today = new Date();

  for (const row of rows) {
    if (!row.H) continue; // Discord ID ない場合スキップ

    const last3Months = rows
      .filter(r => r.B === row.B && r.D === "決済完了")
      .map(r => new Date(r.A))
      .filter(date => (today - date) / (1000 * 60 * 60 * 24) <= 90);

    if (last3Months.length === 0) {
      const guild = client.guilds.cache.first();
      const member = await guild.members.fetch(row.H).catch(() => null);
      if (member) {
        await member.kick("未決済3ヶ月");
        console.log(`👢 キック: ${row.B}`);
      }
    }
  }
}

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  cron.schedule("0 0 1 * *", monthlyCheck); // 毎月1日0時にチェック
});

client.login(TOKEN);
