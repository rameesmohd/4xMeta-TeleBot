import { Telegraf } from "telegraf";
import dotenv from 'dotenv';
import { axiosPost } from './secureApi.js'
dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);

const seenUsers = new Set();

bot.start( async (ctx) => {
  const userId = ctx.from.id;
  const user = ctx.from;

  if (!seenUsers.has(userId)) {
    try {
        axiosPost(`/save-user`, {
          telegramId: user?.id,
          first_name: user.first_name || null,
          last_name: user.last_name || null,
          username: user.username || null,
          language_code: user.language_code || null,
          is_premium: user.is_premium || false,
      });
      seenUsers.add(userId);
    } catch (err) {
      console.error("❌ Failed to send user data:", err.response?.data || err.message);
    }
  }

  await ctx.reply(
    `👋 Welcome *${user.first_name}*!\n\nWelcome to 4xMeta Bot 🚀`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Open WebApp", web_app: { url: "https://app.4xmeta.com/?id=543919" } }],
        ],
      },
    }
  );
});


bot.launch();
console.log("🚀 Telegram Bot Started..");
