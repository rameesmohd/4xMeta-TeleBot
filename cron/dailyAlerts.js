// cron/dailyAlerts.js
import cron from "node-cron";
import { axiosGet, axiosPost } from "../secureApi.js";
import isPermanentTelegramError from "../utils/isPermanentTelegramError.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function startDailyAlerts(bot) {
  console.log("⏱️ Daily alerts cron loaded");

  cron.schedule("0 23 * * 1-5",async () => {
  // cron.schedule("*/20 * * * * *", async () => {
      console.log("⏱️ Daily alerts started");

      let offset = 0;
      const limit = 500;

      while (true) {
        let res;
        try {
          res = await axiosGet("/daily-profit-alerts", { limit, offset });
        } catch (apiErr) {
          console.error("❌ API fetch error:", apiErr.message);
          break;
        }

        if (!res?.success || !res.alerts?.length) {
          console.log("✅ No more alerts to send");
          break;
        }

        console.log(`📨 Sending batch: ${res.alerts.length}`);

        for (const msg of res.alerts) {
          const chatId = msg.chat_id; // ✅ freeze for catch scope safety

          try {
            const imageFileId = process.env.DAILY_PERFORMANCE_IMAGE_FILE_ID || null;

            if (imageFileId) {
              await bot.telegram.sendPhoto(chatId, imageFileId, {
                caption: msg.payload.text,
                parse_mode: msg.payload.parse_mode,
                reply_markup: msg.payload.reply_markup,
              });
            } else {
              await bot.telegram.sendMessage(chatId, msg.payload.text, {
                parse_mode: msg.payload.parse_mode,
                reply_markup: msg.payload.reply_markup,
              });
            }

            await sleep(55);
          } catch (e) {
            const errorCode = e.response?.error_code;
            const errorDesc = e.response?.description || e.message;

            console.error(`Telegram send error (${chatId}):`, errorDesc);

            // ✅ Permanent → update DB & skip
            if (isPermanentTelegramError(e)) {
              try {
                await axiosPost("/bot-user/mark-second-inactive", {
                  chat_id: chatId,
                });
                console.log(`🚫 Marked ${chatId} second bot inactive`);
              } catch (dbErr) {
                console.error("❌ Failed to update is_second_bot:", dbErr.message);
              }
              continue;
            }

            // ✅ Rate limit → wait and continue
            if (errorCode === 429) {
              const retryAfter = e.response?.parameters?.retry_after || 5;
              await sleep(retryAfter * 1000);
              continue;
            }

            // ✅ Any other temporary error → just continue
            continue;
          }
        }

        offset += limit;
        await sleep(2000);
      }

      console.log("✅ Daily alerts finished");
    },
    // { timezone: "Asia/Kolkata" } 
  );
}
