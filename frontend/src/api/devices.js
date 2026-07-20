import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export const getDevices = async () => {
  const res = await axios.get(`${API_URL}/devices`);
  return res.data;
};