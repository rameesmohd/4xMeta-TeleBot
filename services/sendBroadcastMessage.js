const sendBroadcastMessage = async (bot, alert) => {
  const { chat_id, type, fileId, payload } = alert;
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
};

export {
  sendBroadcastMessage
}