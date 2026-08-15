import axios from "axios";
import {BASE_URL} from "./apiPaths";

const axiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 100000, // Set a timeout of 10 seconds
    headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
    },
});

//Request Interceptor

axiosInstance.interceptors.request.use(
    (config) => {
        const accessToken = localStorage.getItem("token");
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor
axiosInstance.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        if (error.response) {
            const { status, data, config } = error.response;
            console.error(`[API Error] ${config?.method?.toUpperCase()} ${config?.url} [Status ${status}]:`, data?.message || data || error.message);
            if (status === 401) {
                // Redirect to login page if token is invalid or expired
                if (window.location.pathname !== "/login") {
                    localStorage.removeItem("token");
                    window.location.href = "/login";
                }
            }
        } else if (error.code === 'ECONNABORTED') {
            console.error(`[API Timeout] Request timed out for ${error.config?.url}. Please try again.`);
        } else {
            console.error(`[API Network Error] Could not connect to backend server:`, error.message);
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;