import { axiosGet, axiosPost } from '../secureApi.js';

const saveBotUser=async(ctx)=>{
    try {
        const userId = ctx.from.id;
        const user = ctx.from;
        const refCode = ctx.startPayload || null
        const isApp = process.env.BOT_ROLE=="APP"
        
        await axiosPost("/save-user", {
            telegramId: user?.id,
            first_name: user.first_name || null,
            last_name: user.last_name || null,
            username: user.username || null,
            language_code: user.language_code || null,
            is_premium: user.is_premium || false,
            referred_by: refCode,
            
            ...(isApp ? { is_second_bot: true } : {})
        });

        console.log(`✅ User ${userId} saved successfully`);
        return true
    } catch (err) {
        console.error("❌ Failed:", err.response?.data || err.message);
        return false
    }
}

const updateUserJoinedChannel = async (ctx) => {
  try {
    await axiosPost("/joined-channel", {
      id: ctx.from.id,
      user: {
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        is_premium: ctx.from.is_premium,
      },
    });
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
};

const userExists = async (telegramId) => {
  const res = await axiosGet(`/user-exists/${telegramId}`);
  return !!(res?.exists ?? res?.data?.exists ?? res?.data?.data?.exists);
};

export {
    saveBotUser,
    updateUserJoinedChannel,
    userExists
}