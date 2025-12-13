import { Telegraf } from "telegraf";
import dotenv from 'dotenv';
import { axiosGet, axiosPost } from './secureApi.js';
import { sendOnboardMessage } from "./controllers/onboardController.js";

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);
const seenUsers = new Set();

bot.start(async (ctx) => {  
  const userId = ctx.from.id;
  const user = ctx.from;
  const refCode = ctx.startPayload || null
  
  if (!seenUsers.has(userId)) {
    try {
      await axiosPost("/save-user", {
        telegramId: user?.id,
        first_name: user.first_name || null,
        last_name: user.last_name || null,
        username: user.username || null,
        language_code: user.language_code || null,
        is_premium: user.is_premium || false,
        referred_by: refCode,
      });

      seenUsers.add(userId);
      console.log(`✅ User ${userId} saved successfully`);

      // 🔥 FETCH onboarding messages
      const messages = await axiosGet("/onboard/list");    
      if(messages.length){
        messages.sort((a, b) => a.order - b.order);
        
        // Send automatically with delay
        messages.forEach((msg) => {
          setTimeout(() => sendOnboardMessage(ctx, msg), msg.delayMinutes * 60 * 1000);
        });
      }
    } catch (err) {
      console.error("❌ Failed:", err.response?.data || err.message);
    }
  }

  //---------------------------------------------------
  // WEBAPP LINK WITH MANAGER ID
  //---------------------------------------------------
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
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

bot.launch();
console.log("🚀 Telegram Bot Started..");