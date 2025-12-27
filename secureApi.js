import axios from "axios";
import dotenv from 'dotenv';
import crypto from "crypto";
import http from "http";
import https from "https";

dotenv.config();

const API_URL = process.env.API_URL;
const BOT_SECRET = process.env.BOT_SECRET;

if (!API_URL || !BOT_SECRET) {
  throw new Error("Missing API_URL or BOT_SECRET in env");
}

/* ---------------- SIGNATURE ---------------- */
const signData = (data = {}) => {
  return crypto
    .createHmac("sha256", BOT_SECRET)
    .update(JSON.stringify(data))
    .digest("hex");
};

/* ---------------- AXIOS INSTANCE ---------------- */
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 8000,
  maxRedirects: 2,
  validateStatus: (status) => status >= 200 && status < 500,
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

/* ---------------- POST ---------------- */
const axiosPost = async (url, data = {}) => {
  try {
    const signature = signData(data);

    const res = await apiClient.post(url, data, {
      headers: {
        "Content-Type": "application/json",
        "x-signature": signature,
      },
    });

    return res.data;
  } catch (err) {
    console.error(
      "🔐 securePost error:",
      err.response?.data || err.message
    );
    throw err;
  }
};

/* ---------------- GET ---------------- */
const axiosGet = async (url, params = {}) => {
  try {
    const signature = signData(params);

    const res = await apiClient.get(url, {
      params,
      headers: {
        "Content-Type": "application/json",
        "x-signature": signature,
      },
    });

    return res.data;
  } catch (err) {
    console.error(
      "🔐 secureGet error:",
      err.response?.data || err.message
    );
    throw err;
  }
};

export { axiosPost, axiosGet };
