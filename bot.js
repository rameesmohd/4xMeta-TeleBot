import { Telegraf } from "telegraf";
import dotenv from 'dotenv';
import { fetchOnBoardMessages } from "./controllers/onboardController.js";
import { saveBotUser, updateUserJoinedChannel } from "./controllers/userController.js";
import startDailyAlerts from "./cron/dailyAlerts.js";
import startBroadcast from "./cron/broadcasts.js";
import { axiosGet } from "./secureApi.js";
import { sendOnboardMessage, sendOrEditOnboardMessage } from "./services/sendOnboardMessage.js";

dotenv.config();

const webAppUrl = process.env.WEBAPP_URL;
const welcome = process.env.WELCOME_FILE_ID || "";
const bot = new Telegraf(process.env.BOT_TOKEN);
const managerId = process.env.MANAGER_ID || "000000";
const botRole = process.env.BOT_ROLE || "APP";
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
  // const link = ctx.startPayload?.trim();
  // const isValidLink = seenUsers.has(userId) || link && /^\d+$/.test(link);

  if (isRateLimited(userId)) {
    console.log(`⏱️ Rate limited: ${userId}`);
    return;
  }

  // if (!isValidLink) {
  //   return ctx.reply(
  //     "⚠️ *Invalid or missing invite link*\n\nPlease open the correct manager link.",
  //     { parse_mode: "Markdown" }
  //   );
  //  }

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
      : await ctx.reply(caption, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Open Platform", web_app: { url: webAppUrl } }],
            ],
          },
        })
    }

    if (!seenUsers.has(userId)) {
      // 📌 PIN ONLY FIRST MESSAGE
      // ctx.telegram.pinChatMessage(
      //   ctx.chat.id,
      //   sentMessage.message_id,
      //   { disable_notification: false }
      // );

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
  const request = ctx.chatJoinRequest;
  const userId = request.from.id;
  const channelId = request.chat.id;
  const channelUrl = process.env.CHANNEL_URL; // https://t.me/yourchannel
  const botUsername = process.env.BOT_USERNAME; // without @
  const startLink = `https://t.me/${botUsername}?start=onboard`;

  const firstName = request.from.first_name || "Trader";

  const text =
`🎉 *Congrats ${firstName}!*

Welcome to the community.
Your request has been approved ✅  

Tap below to open the channel 👇
`;

  try {
    // ✅ Send ONE DM
    await ctx.telegram.sendMessage(userId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "Open Channel", url: channelUrl }],
          // [{ text: "Start / Learn more", url: startLink }],
        ],
      },
    });

    // ✅ Approve join request (optional: approve immediately)
    await ctx.telegram.approveChatJoinRequest(channelId, userId);

    // Optional: if you want to mark "joined channel" even before /start
    updateUserJoinedChannel(ctx).catch(() => {});
  } catch (err) {
    console.error("❌ join_request flow failed:", err.message);

    // If DM blocked (403), at least approve or just log.
    // You can also consider NOT approving until they start the bot,
    // but that requires storing pending requests.
    try {
      await ctx.telegram.approveChatJoinRequest(channelId, userId);
    } catch {}
  }
});

// ✅ Global handler for onboarding "command" callbacks
// Put this AFTER specific actions like COPY_REQUEST, so they still work.
bot.on("callback_query", async (ctx) => {
  try {
    const cmd = ctx.callbackQuery?.data;
    if (!cmd) return;

    // Ignore commands handled elsewhere
    if (cmd === "COPY_REQUEST") return;

    // Fetch onboarding message by command
    const resp = await axiosGet("/onboard/by-command", { command: cmd });
    const onboardMsg = resp?.data || resp?.data?.data || resp?.data?.data?.data || resp?.data || resp;

    if (!onboardMsg || !onboardMsg.type) {
      await ctx.answerCbQuery("No action found", { show_alert: false }).catch(() => {});
      return;
    }

    // Decide inline vs new message
    await sendOrEditOnboardMessage(ctx, onboardMsg);

    await ctx.answerCbQuery().catch(() => {});
  } catch (err) {
    console.error("❌ callback_query handler error:", err?.message || err);
    await ctx.answerCbQuery("Error", { show_alert: false }).catch(() => {});
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
