import axios from "axios";

const API_URL = "http://localhost:8080/api";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => {
    error ? p.reject(error) : p.resolve(token);
  });
  failedQueue = [];
};

export const setUpInterceptors = ({ clearData }) => {
  api.interceptors.response.use(
    (res) => res,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then(() => api(originalRequest));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          await api.get("/user/refresh-token");
          processQueue(null);
          isRefreshing = false;
          return api(originalRequest);
        } catch (err) {
          processQueue(err);
          isRefreshing = false;

          clearData();
          window.location.href = "/login"; 

          return Promise.reject(err);
        }
      }

      return Promise.reject(error);
    }
  );
};

export default api;
