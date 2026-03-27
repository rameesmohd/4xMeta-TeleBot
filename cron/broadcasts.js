import { axiosGet, axiosPost } from "../secureApi.js";
import { sendBroadcastMessage } from "../services/sendBroadcastMessage.js";
import cron from "node-cron";
import isPermanentTelegramError from "../utils/isPermanentTelegramError.js";
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let isRunning = false;

export default async function startBroadcast(bot) {
  cron.schedule("0 * * * *", async () => {
  // cron.schedule("0 */3 * * *", async () => {
  // cron.schedule("*/20 * * * * *", async () => {
    if (isRunning) return;
    isRunning = true;
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

        // while (true) {
        //   // 3️⃣ Fetch users with pagination
        //   const userRes = await axiosGet("/broadcast/users", {
        //     message: message._id,
        //     skip,
        //     limit: LIMIT
        //   });

        //   if (!userRes?.success) {
        //     console.log("⚠ Failed to fetch users, skipping batch");
        //     break;
        //   }

        //   const users = userRes.users || [];

        //   // 🛑 EXIT CONDITION
        //   if (users.length == 0) {
        //     console.log(`✅ Finished message ${message._id}`);
        //     console.log(`=========================================`);
        //     break;
        //   }

          
        //   for (const user of users) {
        //     try {
        //       console.log(`🚀 Sending message ${message._id} to ${user.chat_id}`);
        //       await sendBroadcastMessage(bot, user);
        //       await sleep(100);
        //     } catch (err) {
        //       const desc =
        //       err?.response?.description ||
        //       err?.description ||
        //       err?.message ||
        //       "";
        //       console.log(`⚠ Failed to send to ${user.chat_id}: `, err?.response?.description || err.message || err);
        //       if (isPermanentTelegramError(err)) {
        //         axiosPost("/bot-user/mark-inactive", {
        //           chat_id: user.chat_id,
        //           reason: desc,
        //         }).catch(e =>
        //           console.error(`⚠️ Mark-inactive failed for ${user.chat_id}`, e.message)
        //         );
        //       }
        //     }
        //   }

        //   // 5️⃣ Advance pagination
        //   skip += users.length;
        // }
        
        // 6️⃣ Mark message as completed
       
        while (true) {
          const userRes = await axiosGet("/broadcast/users", {
            message: message._id,
            skip,
            limit: LIMIT,
          });

          if (!userRes?.success) {
            console.log("⚠ Failed to fetch users, skipping batch");
            break;
          }

          const users = userRes.users || [];

          if (users.length === 0) {
            console.log(`✅ Finished message ${message._id}`);
            break;
          }

          for (const user of users) {
            try {
              await sendBroadcastMessage(bot, user);
              await sleep(100);
            } catch (err) {
              const desc = err?.response?.description || err?.description || err?.message || "";
              console.log(`⚠ Failed to send to ${user.chat_id}:`, desc);
              if (isPermanentTelegramError(err)) {
                axiosPost("/bot-user/mark-inactive", {
                  chat_id: user.chat_id,
                  reason: desc,
                }).catch(e =>
                  console.error(`⚠️ Mark-inactive failed for ${user.chat_id}`, e.message)
                );
              }
              if (err?.response?.error_code === 429) {
                const retryAfter = err.response?.parameters?.retry_after || 5;
                await sleep(retryAfter * 1000);
              }
            }
          }

          // Safety: if backend returned fewer than LIMIT, we're done — no need for another round trip
          if (users.length < LIMIT) {
            console.log(`✅ Last batch for message ${message._id}`);
            break;
          }

          skip += users.length;
        }

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
      return { ok: true };
    } catch (error) {
      console.log("Broadcast error: ",error);
    } finally {
      isRunning = false;
    }
  })
}
