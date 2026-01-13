import { convertToTelegramHtml } from "../utils/convertToTelegramHtml.js";

const sendOnboardMessage = async (ctx, msg) => {
  // 🔹 Get user's first name safely
  const firstName = ctx?.from?.first_name || " ";

  // 🔹 Replace {name} placeholder before converting HTML
  const rawCaption = msg.caption
    ? msg.caption.replace(/{name}/gi, firstName)
    : "";

  const telegramCaption = convertToTelegramHtml(rawCaption);

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

export {    
    sendOnboardMessage,  
}