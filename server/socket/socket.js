import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie"
import { getMessageModel } from "../helper/getMessageModel.js";
import { updateLastMessage } from "../controllers/conversationController.js";

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // authentication user
  io.use((socket, next) => {
    const cookies = cookie.parse(socket.handshake.headers.cookie || "");
    const token = cookies.accessToken;
    if (!token) {
      console.log("No token cookie found");
      return next(new Error("Authentication error"));
    }
    try {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      console.log("Socket auth error: ", error);
      next(new Error("Authentication error"));
    }
  });


  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.on("joinConversation", (conversationId) => {
      socket.join(conversationId);
      console.log(`User joined conversation ${conversationId}`);
    });

    // when the user is typing 
    socket.on("typing", (conversationId) => {
      // send the message to others in the chat room except current user is typing
      socket.to(conversationId).emit("userTyping", { userId: socket.userId });
    })

    // when the user stops typing
    socket.on("stopTyping", (conversationId) => {
      socket.to(conversationId).emit("userStopTyping", { userId: socket.userId });
    })

    socket.on("sendMessage", async (data) => {
      try {
        const { conversationId, text, attachments } = data;
        const Message = getMessageModel();

        // save message to database
        const newMessage = await Message.create({
          conversation: conversationId,
          sender: socket.userId,
          text,
          attachments
        });

        // updated lastMessageAt cho Conversation
        await updateLastMessage(conversationId, text, attachments);

        // send message to everyone in chat room
        io.to(conversationId).emit("receiveMessage", newMessage);

        // confirm send message successfully
        socket.emit("messageSaved", newMessage)
      } catch (error) {
        console.error("Error sending message:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};
