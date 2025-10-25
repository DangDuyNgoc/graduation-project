import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { getMessageModel } from "../helper/getMessageModel";

export const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*", 
      methods: ["GET", "POST"]
    }
  });

  // authentication user
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if(!token) {
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
    
    socket.on("sendMessage", async (data) => {
      try {
        const { conversationId, senderId, text, attachments } = data;
        const Message = getMessageModel();

        // save message to database
        const newMessage = await Message.create({
          conversation: conversationId,
          sender: senderId || socket.userId,
          text,
          attachments
        });

        // updated lastMessageAt cho Conversation
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessageAt: new Date()
        });

        // Phát tin nhắn tới mọi người trong room
        io.to(conversationId).emit("receiveMessage", newMessage);
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
