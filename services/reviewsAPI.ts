import axios from "axios";

const API_BASE = "https://backend.listtra.com/api/reviews";

export const fetchSellerSummary = async (sellerId: string) => {
  const res = await axios.get(`${API_BASE}/seller/${sellerId}/summary/`);
  return res.data;
};

export const fetchSellerReviews = async (sellerId: string) => {
  const res = await axios.get(`${API_BASE}/seller/${sellerId}/`);
  return res.data;
};

export const submitReview = async (
  token: string,
  data: {
    reviewed_user: string;
    reviewed_product: string;
    rating: number;
    review_text?: string;
  }
) => {
  const res = await axios.post(`${API_BASE}/`, data, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};
