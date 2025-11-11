// utils/socket.js
import { io } from "socket.io-client";

let socket = null;

export const connectSocket = () => {
    if (socket) {
        socket.disconnect();
    }

    socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:8080", {
        withCredentials: true,
        transports: ["websocket"],
    });

    socket.on("connect", () => {
        console.log("🔌 Socket connected:", socket.id);
    });

    socket.on("userInfo", ({ userId }) => {
        socket.userId = userId;
        console.log("Socket authenticated with userId:", userId);
    });

    socket.on("disconnect", () => {
        console.log("Socket disconnected");
    });

    return socket;
};

export const getSocket = () => {
    if (!socket) connectSocket();
    return socket;
};