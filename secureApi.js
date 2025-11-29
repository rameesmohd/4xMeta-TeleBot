import axios from "axios";
import crypto from "crypto";

const axiosPost = async(url, data={})=> {
  try {
    const signature = crypto
      .createHmac("sha256", process.env.BOT_SECRET)
      .update(JSON.stringify(data))
      .digest("hex");

    const response = await axios.post(`${process.env.API_URL}${url}`, data, {
      headers: {
        "x-signature": signature,
        "Content-Type": "application/json",
      },
    });

    // console.log(response);
    
    return response.data;
  } catch (err) {
    console.error("🔐 securePost error:", err.response?.data || err.message);
    throw err;
  }
}

export {
  axiosPost
}