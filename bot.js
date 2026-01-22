import { Telegraf } from "telegraf";
import dotenv from 'dotenv';
import { fetchCallbackMessage, fetchOnBoardMessages, fetchOnBoardMessagesOnRequest } from "./controllers/messageController.js";
import { saveBotUser } from "./controllers/userController.js";
import startDailyAlerts from "./cron/dailyAlerts.js";
import startBroadcast from "./cron/broadcasts.js";
dotenv.config();

const webAppUrl = process.env.WEBAPP_URL;
const welcome = process.env.WELCOME_FILE_ID || "";
const bot = new Telegraf(process.env.BOT_TOKEN);
const managerId = process.env.MANAGER_ID || "000000";
const botRole = process.env.BOT_ROLE || "APP";

const SEEN_USERS_MAX = 1000;
const seenUsers = new Map();

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

function hasSeenUser(userId) {
  return seenUsers.has(userId);
}

function markSeenUser(userId) {
  // If already exists, refresh position (move to end)
  if (seenUsers.has(userId)) {
    seenUsers.delete(userId);
  }

  seenUsers.set(userId, true);

  // FIFO eviction
  if (seenUsers.size > SEEN_USERS_MAX) {
    const oldestKey = seenUsers.keys().next().value;
    seenUsers.delete(oldestKey);
  }
}

bot.start(async (ctx) => {  
  const userId = ctx.from.id;

  if (isRateLimited(userId)) {
    console.log(`⏱️ Rate limited: ${userId}`);
    return;
  }

  let caption = `*Welcome aboard, ${ctx.from.first_name}!*

*Manager #${managerId} selected successfully*

👤 *Manager: Calvin Trades*

_You’ve just joined a transparent, performance-driven trading ecosystem built for long-term consistency._

Tap below to open the WebApp ⬇️`;

  try {
    if(botRole === "APP") {
    // 🚀 SEND REPLY IMMEDIATELY - Don't wait for API calls!
    welcome ?
       await ctx.replyWithVideo(
          welcome,
          {
            caption,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "Open Platform", web_app: { url: webAppUrl } }],
              ],
            },
          }
        )
      : await ctx.reply(
          caption, 
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "Open Platform", web_app: { url: webAppUrl } }],
              ],
            },
          }
        )
    }

    if (!hasSeenUser(userId)) {
      saveBotUser(ctx)
        .then((res) => {
          if (res) {
            markSeenUser(userId);
            console.log(`✅ User ${userId} saved`);
          }
        })
        .catch((err) => {
          console.error(`❌ Save user ${userId} failed:`, err.message);
        });
    }

    if(botRole=="TRADER"){
      // Fetch onboarding messages in background (non-blocking)
      fetchOnBoardMessages(ctx).catch((err) => {
        console.error(`❌ Onboard messages for ${userId} failed:`, err.message);
      });
    }

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
  await fetchOnBoardMessagesOnRequest(ctx)
});

bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  if (isRateLimited(userId)) {
    await ctx.answerCbQuery(`Already processing…`);
    return;
  }
  await fetchCallbackMessage(ctx)
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

    if(botRole=="APP"){
      startDailyAlerts(bot);
    }

    if(botRole=="TRADER"){
       startBroadcast(bot)
    }
    
  })
  .catch(err => {
    console.error("❌ Bot startup verification failed:", err.message);
  });
