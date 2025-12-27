import cron from "node-cron";
import { axiosGet } from "../secureApi.js";


const fetchDailyAlerts = async () => {
  try {
    const res = await axiosGet("/daily-profit-alerts");
    return res;
  } catch (error) {
    console.error("Fetch daily alerts error:", error.message);
    return { success: false, alerts: [], count: 0 };
  }
};

export default function startDailyAlerts(bot) {
  console.log("⏱️ dailyAlerts loaded at", Date.now());

  cron.schedule("0 23 * * *", async () => {
    // cron.schedule("*/20 * * * * *", async () => {
    console.log("⏱️ Daily alerts cron triggered");
      
    try {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      
    if (!bot || !bot.telegram) {
      throw new Error("❌ Bot instance not passed to startDailyAlerts()");
    }

    const { success, count, alerts } = await fetchDailyAlerts();

    if (!success || !alerts?.length) {
      console.log("No daily alerts to send.");
      return;
    }

    console.log(`📨 Sending ${count} daily alerts`);

    for (const msg of alerts) {
      try {
        await bot.telegram.sendMessage(
          msg.chat_id,
          msg.text,
          {
            parse_mode: msg.parse_mode || "Markdown",
            reply_markup: msg.reply_markup
          }
        );
        await sleep(50); 
      } catch (e) {
        console.error(
          "Telegram send error:",
          e.response?.description || e.message
        );
      }
    }
  } catch (err) {
    console.error("❌ Cron alert error:", err);
  }
  });
}
