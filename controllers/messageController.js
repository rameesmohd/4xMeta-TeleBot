import { axiosGet } from "../secureApi.js";
import { sendOnboardMessage, sendOnboardMessageOnRequest, sendOrEditOnboardMessage } from "../services/sendOnboardMessage.js";
import { userExists } from "./userController.js";

/* ---------------- CACHE ---------------- */
let cachedMessages = [];
let lastFetchedAt = 0;
const CACHE_TTL = 1 * 60 * 1000; // 1 minute

// Track scheduled users to avoid duplicate timers
const scheduledUsers = new Set();

/* ---------------- FETCH WITH CACHE ---------------- */
const getOnboardMessages = async () => {
  const now = Date.now();

  if (cachedMessages && now - lastFetchedAt < CACHE_TTL) {
    return cachedMessages;
  }

  const messages = await axiosGet("/onboard/list");
  if (!Array.isArray(messages)) return [];

  // ✅ Only schedule delay-based messages (command === null)
  cachedMessages = messages
    .filter((m) => (m.command == null || m.command === "") && typeof m.delayMinutes === "number")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  lastFetchedAt = now;
  return cachedMessages;
};

/* ---------------- NEW: Fetch by command ---------------- */
const fetchOnboardByCommand = async (command) => {
  if (!command) return null;
  const res = await axiosGet("/onboard/by-command", { command });

  // handle both response shapes
  if (res?.success && res?.data) return res.data;
  if (res?.data?.data) return res.data.data;
  return res?.data || res;
};

/* ---------------- HELPER: Process messages with delay ---------------- */
const processMessagesWithDelay = async (ctx, messages, userId, sendFunction) => {
  if (!Array.isArray(messages)) return;

  const telegram = ctx.telegram;
  const chatId = ctx.chat?.id || userId;
  const firstName = ctx.from?.first_name;

  for (const msg of messages) {
    const delayMs = Math.max(0, msg.delayMinutes || 0) * 60 * 1000;

    setTimeout(async () => {
      try {
        const delayedCtx = {
          telegram,
          chat: { id: chatId },
          from: { first_name: firstName, id: userId },
        };

        // ✅ IMPORTANT: for delayed messages use the telegram-based sender
        await sendFunction(delayedCtx, msg, chatId);
      } catch (err) {
        console.error(`❌ Onboard send failed (user ${userId}):`, err?.message || err);
      }
    }, delayMs);
  }
};

/* ---------------- MAIN FUNCTION ---------------- */
const fetchOnBoardMessages = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    // prevent re-scheduling for same user (enable if you want)
    // if (scheduledUsers.has(userId)) return;
    scheduledUsers.add(userId);

    const messages = await getOnboardMessages();
    if (!messages.length) return;

    await processMessagesWithDelay(ctx, messages, userId,sendOnboardMessage);
  } catch (error) {
    console.error("❌ fetchOnBoardMessages error:", error.message);
  }
};

const fetchOnBoardMessagesOnRequest = async (ctx) => {
  const request = ctx.chatJoinRequest;
  const userId = request.from.id;
  const channelId = request.chat.id;

  try {
    // ✅ 1) check existence from WebApp server
    const exists = await userExists(userId);

    // ✅ 2) choose command
    const command = exists ? "REQUEST_APPROVED_CURR" : "REQUEST_APPROVED_NEW";

    // ✅ 3) fetch onboarding message by command
    const onboardMsg = await fetchOnboardByCommand(command);

    // ✅ 4) DM user with delay handling
    if (onboardMsg?.length) {
      const userCtx = { ...ctx, chat: { id: userId } };
      
      // Handle array with delayMinutes
      if (Array.isArray(onboardMsg)) {
        await processMessagesWithDelay(userCtx, onboardMsg, userId,sendOnboardMessageOnRequest);
      } else {
        // Single message fallback
        await sendOnboardMessageOnRequest(userCtx, onboardMsg);
      }
    } else {
      await ctx.telegram.sendMessage(userId, "Approved ✅");
    }

    // ✅ 5) approve join request
    await ctx.telegram.approveChatJoinRequest(channelId, userId);

    // ✅ optional: tell webapp user joined
    // await axiosPost(`/users/${userId}/joined-channel`, {...})
  } catch (err) {
    console.error("❌ join_request flow failed:", err.message);
    try {
      await ctx.telegram.approveChatJoinRequest(channelId, userId);
    } catch {}
  }
};

const fetchCallbackMessage = async (ctx) => {
  try {
    const cmd = ctx.callbackQuery?.data;
    if (!cmd) return;

    // Ignore commands handled elsewhere
    if (cmd === "COPY_REQUEST") return;

    // Fetch onboarding message by command
    const resp = await fetchOnboardByCommand(cmd);
    const onboardMsg = resp?.data || resp?.data?.data || resp?.data?.data?.data || resp;

    if (!onboardMsg || !onboardMsg.length) {
      await ctx.answerCbQuery("No action found", { show_alert: false }).catch(() => {});
      return;
    }

    // Handle array with delayMinutes
    if (Array.isArray(onboardMsg)) {
      const userId = ctx.from?.id;
      
      // For callback queries with multiple messages, use appropriate send function
      // If first message has delayMinutes, process with delays
      const hasDelays = onboardMsg.some(m => typeof m.delayMinutes === 'number');
      
      if (hasDelays) {
        await processMessagesWithDelay(ctx, onboardMsg, userId, sendOnboardMessageOnRequest);
      } else {
        // No delays, send first message as edit/reply
        await sendOrEditOnboardMessage(ctx, onboardMsg[0]);
      }
    } else {
      // Single message - use existing edit logic
      await sendOrEditOnboardMessage(ctx, onboardMsg);
    }

    await ctx.answerCbQuery().catch(() => {});
  } catch (err) {
    console.error("❌ callback_query handler error:", err?.message || err);
    await ctx.answerCbQuery("Error", { show_alert: false }).catch(() => {});
  }
};

export { 
  fetchOnBoardMessages, 
  fetchOnboardByCommand, 
  fetchOnBoardMessagesOnRequest, 
  fetchCallbackMessage 
};