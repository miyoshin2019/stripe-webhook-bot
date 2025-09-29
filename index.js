import { Client, GatewayIntentBits } from "discord.js";
import { GoogleSpreadsheet } from "google-spreadsheet";
import cron from "node-cron";
import sgMail from "@sendgrid/mail";

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const INVITE_LINK = process.env.DISCORD_INVITE_LINK;

const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
sgMail.setApiKey(SENDGRID_API_KEY);

// Google Sheets 初期化関数
async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: GOOGLE_PRIVATE_KEY,
  });
  await doc.loadInfo();
  return doc.sheetsByTitle["Data"];
}

// メール送信関数
async function sendEmail(to, inviteLink) {
  const msg = {
    to,
    from: SENDGRID_FROM_EMAIL,
    subject: "Bloom terrace Discord 招待リンク",
    text: `こんにちは！\n以下のリンクからDiscordコミュニティに参加してください。\n\n${inviteLink}`,
    html: `<p>こんにちは！</p><p>以下のリンクからDiscordコミュニティに参加してください。</p><a href="${inviteLink}">${inviteLink}</a>`,
  };

  try {
    await sgMail.send(msg);
    console.log(`📧 招待リンクを ${to} に送信しました`);
  } catch (error) {
    console.error("❌ メール送信エラー:", error);
  }
}

// Stripe Webhook で呼ばれる処理
export async function handleNewPayment(payload) {
  const sheet = await accessSheet();
  const rows = await sheet.getRows();

  // 日時を日本時間に変換
  const date = new Date(payload.date);
  const jpDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);

  let row = rows.find(r => r.B === payload.email);

  if (!row) {
    // 初回ユーザー
    row = await sheet.addRow({
      A: jpDate.toISOString(),
      B: payload.email,
      C: payload.amount,
      D: payload.status,
      E: payload.name,
      F: payload.phone,
      G: payload.address,
    });

    // 招待メール送信
    await sendEmail(payload.email, INVITE_LINK);

  } else {
    // 継続ユーザーはステータス更新
    row.A = jpDate.toISOString();
    row.C = payload.amount;
    row.D = "決済完了";
    await row.save();
  }
}

// Discord メンバー参加時に Discord ID をスプレッドシートに反映
client.on("guildMemberAdd", async (member) => {
  const sheet = await accessSheet();
  const rows = await sheet.getRows();
  const row = rows.find(r => r.B === member.user.email); // メールで紐付け（必要に応じてカスタマイズ）
  if (row) {
    row.H = member.id;
    await row.save();
    console.log(`✅ Discord ID ${member.id} を ${row.B} に紐付けしました`);
    
    // 一般ロール付与
    const role = member.guild.roles.cache.find(r => r.name === "一般");
    if (role) await member.roles.add(role);
  }
});

// 月次チェック: 過去3ヶ月未決済のユーザーをキック
async function monthlyCheck() {
  const sheet = await accessSheet();
  const rows = await sheet.getRows();
  const today = new Date();

  for (const row of rows) {
    if (!row.H) continue; // Discord ID がない場合スキップ

    const last3Months = rows
      .filter(r => r.B === row.B && r.D === "決済完了")
      .map(r => new Date(r.A))
      .filter(date => (today - date) / (1000 * 60 * 60 * 24) <= 90);

    if (last3Months.length === 0) {
      const guild = client.guilds.cache.first();
      const member = await guild.members.fetch(row.H).catch(() => null);
      if (member) {
        await member.kick("未決済3ヶ月");
        console.log(`❌ ${row.B} を未決済3ヶ月でキックしました`);
      }
    }
  }
}

// Bot 起動時
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  // 毎月1日 0:00 に月次チェック
  cron.schedule("0 0 1 * *", () => {
    monthlyCheck();
  });
});

// Discord にログイン
client.login(TOKEN);
