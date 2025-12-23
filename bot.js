import { Telegraf } from "telegraf";
import dotenv from 'dotenv';
import { fetchOnBoardMessages } from "./controllers/onboardController.js";
import { saveBotUser, updateUserJoinedChannel } from "./controllers/userController.js";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const seenUsers = new Set();

const lastAction = new Map();
const RATE_LIMIT_MS = 3000;

function isRateLimited(userId) {
  const now = Date.now();
  const last = lastAction.get(userId) || 0;
  if (now - last < RATE_LIMIT_MS) return true;
  lastAction.set(userId, now);
  return false;
}

bot.start(async (ctx) => {  
  const userId = ctx.from.id;
  
  if (isRateLimited(userId)) return;

  if (!seenUsers.has(userId)) {
    const res = await saveBotUser(ctx)
    if(res)seenUsers.add(userId);
  }

  const webAppUrl = process.env.WEBAPP_URL || `https://app.4xmeta.com/?id=543919`;
  
  await ctx.reply(
  `📈 *Welcome aboard, ${ctx.from.first_name}!* \n\nManager selected successfully. Let’s start growing your portfolio.\n\nTap below to open the WebApp ⬇️`,
  {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "Open Manager", web_app: { url: webAppUrl } }]
      ],
    },
  }
  );

  fetchOnBoardMessages(ctx)
});

bot.on("chat_join_request", async (ctx) => {
  try {
    const request = ctx.chatJoinRequest;
    const userId = request.from.id;
    const channelId = request.chat.id;

    // 1️⃣ Approve join request
    await ctx.telegram.approveChatJoinRequest(channelId, userId);
    
    const res = updateUserJoinedChannel(userId)
    if(res){
      console.log("User joined channel updated");
    }
  } catch (err) {
    console.error("Join approve error:", err.message);
  }
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

bot.launch();
console.log("🚀 Telegram Bot Started..");