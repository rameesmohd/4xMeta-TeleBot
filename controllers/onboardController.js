import { convertToTelegramHtml } from "../utils/convertToTelegramHtml.js";
import { axiosGet } from '../secureApi.js';

const sendOnboardMessage=async(ctx, msg)=>{

  const telegramCaption = msg.caption ? convertToTelegramHtml(msg.caption) : "";

  const keyboard = msg.buttons?.length ? 
    {
      inline_keyboard: msg.buttons.map((btn) => {
        if (btn.type === "webapp") {
          return [
            {
              text: btn.text,
              web_app: { url: btn.url },
            },
          ];
        }

        return [
          {
            text: btn.text,
            url: btn.url,
          },
        ];
      }),
    }
  : undefined;

  try {
    switch (msg.type) {
      case "text":
        await ctx.reply(telegramCaption, {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
        break;

      case "image":
        await ctx.replyWithPhoto(msg.fileId, {
          caption: telegramCaption,
          reply_markup: keyboard,
          parse_mode: "HTML", 
        });
        break;

      case "video":
        await ctx.replyWithVideo(msg.fileId, {
          caption: telegramCaption,
          reply_markup: keyboard,
          parse_mode: "HTML", 
        });
        break;

      case "audio":
        await ctx.replyWithAudio(msg.fileId, {
          caption: telegramCaption,
          reply_markup: keyboard,
          parse_mode: "HTML", 
        });
        break;

      default:
        console.log("⚠ Unknown message type:", msg.type);
    }

    console.log(`📨 Sent onboarding message #${msg.order}`);

  } catch (err) {
    console.log("❌ Send onboarding failed:", err);    
  }
}

const fetchOnBoardMessages=async(ctx)=>{
  try {
    // 🔥 FETCH onboarding messages
    const messages = await axiosGet("/onboard/list");    
    if(messages.length>0){  
      messages.sort((a, b) => a.order - b.order);
      messages.forEach((msg) => {
        setTimeout(() => sendOnboardMessage(ctx, msg), msg.delayMinutes * 60 * 1000);
      });
    }
  } catch (error) {
    console.log(error.message);
  }
}

export {
  sendOnboardMessage,
  fetchOnBoardMessages
}