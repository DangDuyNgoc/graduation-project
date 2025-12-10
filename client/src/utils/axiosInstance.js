import axios from "axios";

const API_URL = "http://localhost:8080/api";

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });

    failedQueue = [];
};

export const setUpInterceptors = ({ clearData }) => {
    api.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;

            // if access token expired and retry yet
            if (error.response?.status === 401 && !originalRequest._retry) {
                if (isRefreshing) {
                    // if refreshing, waiting a new access token
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    })
                        .then((token) => {
                            originalRequest.headers['Authorization'] = `Bearer ${token}`;
                            return api(originalRequest);
                        })
                        .catch((error) => Promise.reject(error));
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const res = await api.get("/user/refresh-token");
                    if (res?.data?.success) {
                        const newToken = res.data.accessToken;
                        // set token into headers
                        api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
                        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
                        processQueue(null, newToken);

                        isRefreshing = false;

                        return api(originalRequest);
                    }
                } catch (error) {
                    // if failed refresh
                    console.error("Refresh token failed:", error);

                    processQueue(error, null);
                    isRefreshing = false;

                    // calling clearData 
                    if (typeof clearData === "function") {
                        clearData();
                    }

                    return Promise.reject(error);
                }
            }
            return Promise.reject(error);
        }
    );
};

export default api;