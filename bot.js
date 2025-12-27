import { Telegraf } from "telegraf";
import dotenv from 'dotenv';
import { fetchOnBoardMessages } from "./controllers/onboardController.js";
import { saveBotUser, updateUserJoinedChannel } from "./controllers/userController.js";
import startDailyAlerts from "./cron/dailyAlerts.js";

dotenv.config();

const webAppUrl = process.env.WEBAPP_URL;
const welcomeImage = process.env.WELCOME_IMAGE_FILE_ID || "";
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

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamp] of lastAction.entries()) {
    if (now - timestamp > RATE_LIMIT_MS * 10) {
      lastAction.delete(userId);
    }
  }
}, 300000);

bot.start(async (ctx) => {  
  const userId = ctx.from.id;

  if (isRateLimited(userId)) {
    console.log(`⏱️ Rate limited: ${userId}`);
    return;
  }

const caption = `📈 *Welcome aboard, ${ctx.from.first_name}!*

You’ve just joined a transparent, performance-driven trading ecosystem built for long-term consistency.

*What makes us different:*
🔹 Live performance tracking  
🔹 Capital-first risk management  
🔹 Full visibility on every trade placed  

_💡You can see everything in real time._

Tap below to open the WebApp ⬇️`;

  try {
    // 🚀 SEND REPLY IMMEDIATELY - Don't wait for API calls!
    const replyPromise = welcomeImage
      ? ctx.replyWithPhoto(
          welcomeImage,
          {
            caption,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "Open Manager", web_app: { url: webAppUrl } }],
              ],
            },
          }
        )
      : ctx.reply(caption, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Open Manager", web_app: { url: webAppUrl } }],
            ],
          },
        });

    await replyPromise;
    if (!seenUsers.has(userId)) {
      saveBotUser(ctx)
        .then((res) => {
          if (res) {
            seenUsers.add(userId);
            console.log(`✅ User ${userId} saved`);
          }
        })
        .catch((err) => {
          console.error(`❌ Save user ${userId} failed:`, err.message);
        });
    }

    // Fetch onboarding messages in background (non-blocking)
    fetchOnBoardMessages(ctx).catch((err) => {
      console.error(`❌ Onboard messages for ${userId} failed:`, err.message);
    });

  } catch (error) {
    console.error("❌ Start command error:", error.message);
    // Fallback response
    ctx.reply("Welcome! Please try again.").catch(() => {});
  }
});

bot.on("message", (ctx) => {
  const msg = ctx.message;

  const fileId =
    msg.photo?.at(-1)?.file_id ||
    msg.document?.file_id ||
    msg.video?.file_id ||
    msg.audio?.file_id ||
    msg.voice?.file_id;

  if (fileId) {
    console.log("📦 File ID:", fileId);
  }
});

bot.on("chat_join_request", async (ctx) => {
  try {
    const request = ctx.chatJoinRequest;
    const userId = request.from.id;
    const channelId = request.chat.id;

    await ctx.telegram.approveChatJoinRequest(channelId, userId);
    console.log(`✅ Approved: ${userId} to channel ${channelId}`);
    
    updateUserJoinedChannel(userId)
      .then((res) => {
        if (res) {
          console.log(`📊 Updated channel join for user ${userId}`);
        }
      })
      .catch((err) => {
        console.error(`❌ Update channel for ${userId} failed:`, err.message);
      });

  } catch (err) {
    console.error("❌ Join approve error:", err.message);
    
    if (err.message.includes("bot is not a member")) {
      console.error("⚠️ Bot must be admin in the channel!");
    } else if (err.message.includes("not enough rights")) {
      console.error("⚠️ Bot needs 'Invite users' permission!");
    }
  }
});

// Global error handler
bot.catch((err, ctx) => {
  console.error(`❌ Bot error for ${ctx.updateType}:`, err);
  ctx.reply("Something went wrong. Please try again.").catch(() => {});
});

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n🛑 ${signal} received. Shutting down...`);
  try {
    await bot.stop(signal);
    console.log("✅ Bot stopped gracefully");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
    process.exit(1);
  }
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled Rejection:', error);
});

console.log("🚀 Starting Telegram Bot...");
console.log(`🔗 WebApp: ${webAppUrl}`);

bot.launch();

bot.telegram.getMe()
  .then((me) => {
    console.log("✅ Bot is online");
    console.log(`🤖 Username: @${me.username}`);
    startDailyAlerts(bot);
  })
  .catch(err => {
    console.error("❌ Bot startup verification failed:", err.message);
  });
