import axios from "axios";
import crypto from "crypto";

const signData = (data = {}) => {
  return crypto
    .createHmac("sha256", process.env.BOT_SECRET)
    .update(JSON.stringify(data))
    .digest("hex");
};

const axiosPost = async (url, data = {}) => {
  try {
    const signature = signData(data);

    const response = await axios.post(`${process.env.API_URL}${url}`, data, {
      headers: {
        "x-signature": signature,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (err) {
    console.error("🔐 securePost error:", err.response?.data || err.message);
    throw err;
  }
};

const axiosGet = async (url, params = {}) => {
  try {
    const signature = signData(params);

    const response = await axios.get(`${process.env.API_URL}${url}`, {
      params,
      headers: {
        "x-signature": signature,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (err) {
    console.error("🔐 secureGet error:", err.response?.data || err.message);
    throw err;
  }
};

export { axiosPost, axiosGet };
