import { Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";
import { GoogleSpreadsheet } from "google-spreadsheet";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const SPREADSHEET_ID = process.env.YOUR_SHEET_ID;
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// Bot 起動
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Discord にログイン
client.login(TOKEN);

// Webhook ハンドラー
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const payload = req.body;

  // 例: payload = { email, amount, date, name, phone, address }
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  });
  await doc.loadInfo();

  const sheet = doc.sheetsByIndex[0]; // 先頭シート
  const rows = await sheet.getRows();

  // 初回チェック
  let row = rows.find(r => r.B === payload.email);
  if (!row) {
    row = sheet.addRow({
      A: payload.date,
      B: payload.email,
      C: payload.amount,
      D: "決済完了",
      E: payload.name,
      F: payload.phone,
      G: payload.address
    });

    // Discord 招待（Bot がサーバーに招待して、ID を取得）
    const guild = client.guilds.cache.first(); 
    const member = await guild.members.fetch({ query: payload.email, limit: 1 }).catch(() => null);

    if (member) {
      row.H = member.id;
      await row.save();
    }
  } else {
    // 継続支払いはステータス更新
    row.A = payload.date;
    row.C = payload.amount;
    row.D = "決済完了";
    row.save();
  }

  res.json({ received: true });
}
