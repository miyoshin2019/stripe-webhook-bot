import { Client, GatewayIntentBits } from "discord.js";
import { GoogleSpreadsheet } from "google-spreadsheet";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const SPREADSHEET_ID = process.env.YOUR_SHEET_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  });
  await doc.loadInfo();

  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();

  const guild = client.guilds.cache.first();
  const today = new Date();

  for (const row of rows) {
    if (!row.H) continue; // Discord ID がない場合はスキップ

    // 過去3ヶ月に「決済完了」がない場合キック
    const last3Months = new Date(today);
    last3Months.setMonth(last3Months.getMonth() - 3);

    const paymentDate = new Date(row.A);
    if (paymentDate < last3Months) {
      const member = await guild.members.fetch(row.H).catch(() => null);
      if (member) await member.kick("3ヶ月以上支払いなし");
      console.log(`⚠ Kicked ${row.B}`);
    }
  }

  process.exit();
});

client.login(TOKEN);
