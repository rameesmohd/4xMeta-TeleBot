

// cron/dailyAlerts.js
import cron from "node-cron";
import { axiosGet } from "../secureApi.js";

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default function startDailyAlerts(bot) {
  console.log("⏱️ Daily alerts cron loaded");
  
  // cron.schedule("*/20 * * * * *", async () => {
  cron.schedule("0 23 * * *", async () => {
    console.log("⏱️ Daily alerts started");

    let offset = 0;
    const limit = 500;

    while (true) {
      const res = await axiosGet("/daily-profit-alerts", {
        limit,
        offset,
      });

      if (!res?.success || !res.alerts?.length) {
        console.log("✅ No more alerts to send");
        break;
      }

      console.log(`📨 Sending batch: ${res.alerts.length}`);

      for (const msg of res.alerts) {
        console.log(msg);
        
        try {
          const imageFileId =process.env.DAILY_PERFORMANCE_IMAGE_FILE_ID || null;

          if (imageFileId) {
            // 📸 Send image with caption
            await bot.telegram.sendPhoto(
              msg.chat_id,
              imageFileId,
              {
                caption: msg.payload.text,
                parse_mode: msg.payload.parse_mode,
                reply_markup: msg.payload.reply_markup
              }
            );
          } else {
            // 💬 Send text only
            await bot.telegram.sendMessage(
              msg.chat_id,
              msg.payload.text,
              {
                parse_mode: msg.payload.parse_mode,
                reply_markup: msg.payload.reply_markup
              }
            );
          }

          await sleep(55); // safe rate (≈18 msg/sec)

        } catch (e) {
          console.error(
            "Telegram send error:",
            e.response?.description || e.message
          );
        }
      }
      offset += limit;
      await sleep(2000); // pause between batches
    }

    console.log("✅ Daily alerts finished");
  });
}
