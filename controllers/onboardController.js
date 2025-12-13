export async function sendOnboardMessage(ctx, msg) {
 const keyboard = msg.buttons?.length
  ? {
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
        await ctx.reply(msg.caption, {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
        break;

      case "image":
        await ctx.replyWithPhoto(msg.fileId, {
          caption: msg.caption,
          reply_markup: keyboard,
        });
        break;

      case "video":
        await ctx.replyWithVideo(msg.fileId, {
          caption: msg.caption,
          reply_markup: keyboard,
        });
        break;

      case "audio":
        await ctx.replyWithAudio(msg.fileId, {
          caption: msg.caption,
          reply_markup: keyboard,
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
