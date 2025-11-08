import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_BACKEND_URL || "http://localhost:8080", {
    withCredentials: true,
    transports: ["websocket"],
});

socket.on("userInfo", ({ userId }) => {
    socket.userId = userId;
})

export default socket;