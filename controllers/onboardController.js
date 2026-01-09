import { axiosGet } from "../secureApi.js";
import { sendOnboardMessage } from "../services/sendOnboardMessage.js";

/* ---------------- CACHE ---------------- */
let cachedMessages = null;
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

  cachedMessages = messages
    .filter(m => typeof m.delayMinutes === "number")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  lastFetchedAt = now;
  return cachedMessages;
};

/* ---------------- MAIN FUNCTION ---------------- */
const fetchOnBoardMessages = async (ctx) => {
  try {
    const userId = ctx.from?.id;
    if (!userId) return;

    // prevent re-scheduling for same user
    // if (scheduledUsers.has(userId)) return;
    scheduledUsers.add(userId);

    const messages = await getOnboardMessages();
    // console.log(messages);
    
    if (!messages.length) return;

    for (const msg of messages) {
      const delayMs = Math.max(0, msg.delayMinutes) * 60 * 1000;

      setTimeout(async () => {
        try {
          await sendOnboardMessage(ctx, msg);
        } catch (err) {
          console.error(
            `❌ Onboard send failed (user ${userId}):`,
            err.message
          );
        }
      }, delayMs);
    }
  } catch (error) {
    console.error("❌ fetchOnBoardMessages error:", error.message);
  }
};

export { fetchOnBoardMessages };
