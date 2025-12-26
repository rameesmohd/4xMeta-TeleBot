import { axiosGet } from '../secureApi.js';
import { sendOnboardMessage } from "../services/sendMessages.js";

const fetchOnBoardMessages=async(ctx)=>{
  try {
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
  fetchOnBoardMessages
}