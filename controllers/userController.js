import { axiosGet, axiosPost } from '../secureApi.js';

const saveBotUser=async(ctx)=>{
    try {
        const userId = ctx.from.id;
        const user = ctx.from;
        const refCode = ctx.startPayload || null
        
        await axiosPost("/save-user", {
            telegramId: user?.id,
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            username: user.username || null,
            language_code: user.language_code || null,
            is_premium: user.is_premium || false,
            referred_by: refCode,
        });

        console.log(`✅ User ${userId} saved successfully`);
        return true
    } catch (err) {
        console.error("❌ Failed:", err.response?.data || err.message);
        return false
    }
}

const updateUserJoinedChannel = async (userId) => {
  try {
    await axiosPost("/joined-channel", { id: userId });
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};


export {
    saveBotUser,
    updateUserJoinedChannel
}