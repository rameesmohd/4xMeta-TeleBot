import { convertToTelegramHtml } from "../utils/convertToTelegramHtml.js";

export async function sendOnboardMessage(ctx, msg) {

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
          parse_mode: "HTML", // ✅ Add parse_mode for captions too
        });
        break;

      case "video":
        await ctx.replyWithVideo(msg.fileId, {
          caption: telegramCaption,
          reply_markup: keyboard,
          parse_mode: "HTML", // ✅ Add parse_mode
        });
        break;

      case "audio":
        await ctx.replyWithAudio(msg.fileId, {
          caption: telegramCaption,
          reply_markup: keyboard,
          parse_mode: "HTML", // ✅ Add parse_mode
        });
        break;

      default:
        console.log("⚠ Unknown message type:", msg.type);
    }

    console.log(`📨 Sent onboarding message #${msg.order}`);

  } catch (err) {
    console.log("❌ Send Failed:", err);    
  }
}