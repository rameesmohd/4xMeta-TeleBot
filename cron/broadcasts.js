import { axiosGet, axiosPost } from "../secureApi.js";
import { sendBroadcastMessage } from "../services/sendBroadcastMessage.js";
import cron from "node-cron";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default async function startBroadcast(bot) {
  cron.schedule("0 * * * *", async () => {
  // cron.schedule("0 */3 * * *", async () => {
  // cron.schedule("*/20 * * * * *", async () => {
    try {
      console.log("⏱️ Broadcast started");

      // 1️⃣ Fetch messages ONCE
      const msgRes = await axiosGet("/broadcast/messages");

      if (!msgRes?.success || !msgRes.messages?.length) {
        console.log("ℹ No messages to broadcast");
        return;
      }

      const messages = msgRes.messages || [];
      const LIMIT = 500;

      // 2️⃣ Process each message
      for (const message of messages) {
        console.log(`=========================================`);
        console.log(`📨 Processing message ${message._id}`);

        let skip = 0;

        while (true) {
          // 3️⃣ Fetch users with pagination
          const userRes = await axiosGet("/broadcast/users", {
            message: message._id,
            skip,
            limit: LIMIT
          });

          if (!userRes?.success) {
            console.log("⚠ Failed to fetch users, skipping batch");
            break;
          }

          const users = userRes.users || [];

          // 🛑 EXIT CONDITION
          if (users.length == 0) {
            console.log(`✅ Finished message ${message._id}`);
            console.log(`=========================================`);
            break;
          }

          
          for (const user of users) {
            console.log(
              `🚀 Sending message ${message._id} to ${user.chat_id} user)`
            );
            await sendBroadcastMessage(bot, user);
            await sleep(100);
          }

          // 5️⃣ Advance pagination
          skip += users.length;
        }

        // 6️⃣ Mark message as completed
        const completeRes = await axiosPost("/broadcast/mark-done", {
          message: message._id
        });

        if(completeRes?.success){
          console.log(`✅ Marked message ${message._id} as done`); 
        } else {
          console.log(`⚠ Failed to mark message ${message._id} as done`);
        }
      }
      console.log(`🎯 Broadcast completed handled total ${messages.length || 0} messages`);
    } catch (error) {
      console.log("Broadcast error: ",error);
    }
  })
}
