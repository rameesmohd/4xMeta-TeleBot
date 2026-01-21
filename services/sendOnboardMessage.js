import { convertToTelegramHtml } from "../utils/convertToTelegramHtml.js";

const isValidUrl = (value) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const buildKeyboard = (buttons = []) => {
  if (!buttons?.length) return undefined;

  return {
    inline_keyboard: buttons.map((btn) => {
      // 🔹 WebApp
      if (btn.type === "webapp") {
        return [{ text: btn.text, web_app: { url: btn.url } }];
      }

      // 🔹 Callback (preferred: btn.command)
      if (btn.type === "callback") {
        return [
          {
            text: btn.text,
            callback_data: btn.command || btn.data || btn.url || btn.text,
          },
        ];
      }

      // 🔹 If not valid URL -> treat as callback (backward compatibility)
      if (!isValidUrl(btn.url)) {
        return [
          {
            text: btn.text,
            callback_data: btn.data || btn.url || btn.text,
          },
        ];
      }

      // 🔹 Normal URL
      return [{ text: btn.text, url: btn.url }];
    }),
  };
};

// ✅ Send as a NEW message (your old behavior)
const sendOnboardMessage = async (ctx, msg) => {
  const firstName = ctx?.from?.first_name || " ";

  const rawCaption = msg.caption ? msg.caption.replace(/{name}/gi, firstName) : "";
  const telegramCaption = convertToTelegramHtml(rawCaption);

  const keyboard = buildKeyboard(msg.buttons);

  try {
    let sent;

    switch (msg.type) {
      case "text":
        sent = await ctx.reply(telegramCaption || "-", {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
        break;

      case "image":
        sent = await ctx.replyWithPhoto(msg.fileId, {
          caption: telegramCaption,
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
        break;

      case "video":
        sent = await ctx.replyWithVideo(msg.fileId, {
          caption: telegramCaption,
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
        break;

      case "audio":
        sent = await ctx.replyWithAudio(msg.fileId, {
          caption: telegramCaption,
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
        break;

      default:
        console.log("⚠ Unknown message type:", msg.type);
        return null;
    }

    console.log(`📨 Sent onboarding message #${msg.order}`);

    if (msg.pin) {
      await ctx.telegram.pinChatMessage(ctx.chat.id, sent.message_id, {
        disable_notification: true,
      }).catch((e) => console.log("📌 Pin failed:", e.message));
    }
    return sent;
  } catch (err) {
    console.log("❌ Send onboarding failed:", err);
    return null;
  }
};

// ✅ Edit INLINE (same Telegram message) if msg.inline === true
// Works when user clicks callback button (ctx has message to edit).
const editOnboardMessageInline = async (ctx, msg) => {
  const firstName = ctx?.from?.first_name || " ";
  const rawCaption = msg.caption ? msg.caption.replace(/{name}/gi, firstName) : "";
  const telegramCaption = convertToTelegramHtml(rawCaption);
  const keyboard = buildKeyboard(msg.buttons);

  try {
    // If text message: editMessageText
    if (msg.type === "text") {
      await ctx.editMessageText(telegramCaption || "-", {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
      return true;
    }

    // For media: best option is editMessageMedia so fileId can change too
    // Telegram supports: photo, video, audio, document, animation
    // We'll use editMessageMedia for image/video/audio.
    if (msg.type === "image") {
      await ctx.editMessageMedia(
        { type: "photo", media: msg.fileId, caption: telegramCaption, parse_mode: "HTML" },
        { reply_markup: keyboard }
      );
      return true;
    }

    if (msg.type === "video") {
      await ctx.editMessageMedia(
        { type: "video", media: msg.fileId, caption: telegramCaption, parse_mode: "HTML" },
        { reply_markup: keyboard }
      );
      return true;
    }

    if (msg.type === "audio") {
      await ctx.editMessageMedia(
        { type: "audio", media: msg.fileId, caption: telegramCaption, parse_mode: "HTML" },
        { reply_markup: keyboard }
      );
      return true;
    }

    // fallback
    return false;
  } catch (err) {
    console.log("❌ Inline edit failed, fallback to send new:", err?.message || err);
    return false;
  }
};

// ✅ Main helper: inline vs new
const sendOrEditOnboardMessage = async (ctx, msg) => {
  if (msg?.inline) {
    const ok = await editOnboardMessageInline(ctx, msg);
    if (ok) return;
  }
  await sendOnboardMessage(ctx, msg);
};

// services/sendOnboardMessage.js

const sendOnboardMessageOnRequest = async (ctx, msg, chatId = null) => {
  const targetChatId = chatId ?? ctx?.chat?.id; // 👈 allow explicit DM target
  if (!targetChatId) throw new Error("Missing target chatId");

  const firstName = ctx?.from?.first_name || " ";
  const rawCaption = msg.caption ? msg.caption.replace(/{name}/gi, firstName) : "";
  const telegramCaption = convertToTelegramHtml(rawCaption);

  const keyboard = buildKeyboard(msg.buttons);

  try {
    let sent;

    switch (msg.type) {
      case "text":
        sent = await ctx.telegram.sendMessage(targetChatId, telegramCaption || "-", {
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
        break;

      case "image":
        sent = await ctx.telegram.sendPhoto(targetChatId, msg.fileId, {
          caption: telegramCaption,
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
        break;

      case "video":
        sent = await ctx.telegram.sendVideo(targetChatId, msg.fileId, {
          caption: telegramCaption,
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
        break;

      case "audio":
        sent = await ctx.telegram.sendAudio(targetChatId, msg.fileId, {
          caption: telegramCaption,
          reply_markup: keyboard,
          parse_mode: "HTML",
        });
        break;

      default:
        console.log("⚠ Unknown message type:", msg.type);
        return null;
    }

    console.log(`📨 Sent onboarding message #${msg.order}`);

    if (msg.pin) {
      await ctx.telegram
        .pinChatMessage(targetChatId, sent.message_id, { disable_notification: true })
        .catch((e) => console.log("📌 Pin failed:", e.message));
    }

    return sent;
  } catch (err) {
    console.log("❌ Send onboarding failed:", err);
    return null;
  }
};



export { sendOnboardMessage, sendOrEditOnboardMessage,sendOnboardMessageOnRequest };
