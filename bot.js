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

const SEEN_USERS_MAX = 500;
const seenUsers = new Map();

// ============================================
// IMPROVED RATE LIMITING
// ============================================

const rateLimitStore = new Map();

const RATE_LIMITS = {
  start: { window: 10000, maxAttempts: 3 },      // 3 /start in 10 seconds
  callback: { window: 2000, maxAttempts: 5 },    // 5 callbacks in 2 seconds
  message: { window: 5000, maxAttempts: 10 }     // 10 messages in 5 seconds
};

function checkRateLimit(userId, action = 'message') {
  const config = RATE_LIMITS[action];
  const now = Date.now();
  const key = `${userId}:${action}`;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { attempts: 1, firstAttempt: now });
    return { allowed: true, remaining: config.maxAttempts - 1 };
  }

  const data = rateLimitStore.get(key);
  const timeElapsed = now - data.firstAttempt;

  // Reset window if expired
  if (timeElapsed > config.window) {
    rateLimitStore.set(key, { attempts: 1, firstAttempt: now });
    return { allowed: true, remaining: config.maxAttempts - 1 };
  }

  // Check if limit exceeded
  if (data.attempts >= config.maxAttempts) {
    const waitTime = Math.ceil((config.window - timeElapsed) / 1000);
    return { 
      allowed: false, 
      remaining: 0, 
      waitTime,
      resetIn: config.window - timeElapsed 
    };
  }

  // Increment attempts
  data.attempts++;
  return { allowed: true, remaining: config.maxAttempts - data.attempts };
}

// Cleanup old entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    const action = key.split(':')[1];
    const config = RATE_LIMITS[action] || RATE_LIMITS.message;
    
    if (now - data.firstAttempt > config.window * 2) {
      rateLimitStore.delete(key);
    }
  }
}, 120000);

// ============================================
// SEEN USERS CACHE
// ============================================

function hasSeenUser(userId) {
  return seenUsers.has(userId);
}

function markSeenUser(userId) {
  if (seenUsers.has(userId)) {
    seenUsers.delete(userId);
  }

  seenUsers.set(userId, true);

  if (seenUsers.size > SEEN_USERS_MAX) {
    const oldestKey = seenUsers.keys().next().value;
    seenUsers.delete(oldestKey);
  }
}

// ============================================
// BOT HANDLERS
// ============================================

bot.start(async (ctx) => {  
  const userId = ctx.from.id;

  // Check rate limit for /start
  const rateCheck = checkRateLimit(userId, 'start');
  
  if (!rateCheck.allowed) {
    console.log(`⏱️ Rate limited /start: ${userId} (wait ${rateCheck.waitTime}s)`);
    
    // Provide helpful feedback
    await ctx.reply(
      `⏳ Please wait ${rateCheck.waitTime} seconds before using /start again.`,
      { parse_mode: "Markdown" }
    ).catch(() => {});
    
    return;
  }

  let caption = `*Welcome aboard, ${ctx.from.first_name}!*

*Manager #${managerId} selected successfully*

👤 *Manager: Calvin Trades*

_You've just joined a transparent, performance-driven trading ecosystem built for long-term consistency._

Tap below to open the WebApp ⬇️`;

  try {
    if(botRole === "APP") {
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

    if(botRole === "TRADER"){
      fetchOnBoardMessages(ctx).catch((err) => {
        console.error(`❌ Onboard messages for ${userId} failed:`, err.message);
      });
    }

  } catch (error) {
    console.error("❌ Start command error:", error.message);
    ctx.reply("Welcome! Please try again.").catch(() => {});
  }
});

bot.on("message", (ctx) => {
  const userId = ctx.from.id;
  const rateCheck = checkRateLimit(userId, 'message');
  
  if (!rateCheck.allowed) {
    console.log(`⏱️ Rate limited message: ${userId}`);
    // Don't reply - just ignore excessive messages
    return;
  }

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
  await fetchOnBoardMessagesOnRequest(ctx);
});

bot.on("callback_query", async (ctx) => {
  const userId = ctx.from.id;
  const rateCheck = checkRateLimit(userId, 'callback');
  
  if (!rateCheck.allowed) {
    console.log(`⏱️ Rate limited callback: ${userId}`);
    await ctx.answerCbQuery(
      `⏳ Too many clicks! Wait ${rateCheck.waitTime}s`,
      { show_alert: false }
    ).catch(() => {});
    return;
  }

  await fetchCallbackMessage(ctx);
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

    if(botRole === "APP"){
      startDailyAlerts(bot);
    }

    if(botRole === "TRADER"){
       startBroadcast(bot);
    }
    
  })
  .catch(err => {
    console.error("❌ Bot startup verification failed:", err.message);
  });