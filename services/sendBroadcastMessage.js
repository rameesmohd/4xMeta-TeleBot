const sendBroadcastMessage = async (bot, alert) => {
  const { chat_id, type, fileId, payload } = alert;
  try {
    switch (type) {
      case "text":
        await bot.telegram.sendMessage(chat_id, payload.text, {
          parse_mode: payload.parse_mode,
          reply_markup: payload.reply_markup
        });
        break;

      case "image":
        await bot.telegram.sendPhoto(chat_id, fileId, {
          caption: payload.text,
          parse_mode: payload.parse_mode,
          reply_markup: payload.reply_markup
        });
        break;

      case "video":
        await bot.telegram.sendVideo(chat_id, fileId, {
          caption: payload.text,
          parse_mode: payload.parse_mode,
          reply_markup: payload.reply_markup
        });
        break;

      case "audio":
        await bot.telegram.sendAudio(chat_id, fileId, {
          caption: payload.text,
          parse_mode: payload.parse_mode,
          reply_markup: payload.reply_markup
        });
        break;

      default:
        console.warn(`⚠️ Unknown message type: ${type}`);
    }

    return true;
  } catch (err) {
    // Handle specific Telegram errors
    const errMsg = err.response?.description || err.message;
    
    if (errMsg.includes("bot was blocked")) {
      console.log(`⚠️ User ${chat_id} blocked bot`);
    } else if (errMsg.includes("user is deactivated")) {
      console.log(`⚠️ User ${chat_id} deactivated`);
    } else if (errMsg.includes("chat not found")) {
      console.log(`⚠️ Chat ${chat_id} not found`);
    } else {
      console.error(`❌ Error for ${chat_id}:`, errMsg);
    }
    
    return false;
  }
};

export {
  sendBroadcastMessage
}