import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie"
import { getMessageModel } from "../helper/getMessageModel.js";
import { updateLastMessage } from "../controllers/conversationController.js";
import chatbotConversationModel from "../models/chatbotConversationModel.js";
import chatbotMessageModel from "../models/chatbotMessageModel.js";
import { clearConversationCache, getChatbotReply } from "../services/chatbotService.js";

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
      socket.userId = decoded.userId;
      next();
    } catch (error) {
      console.log("Socket auth error: ", error);
      next(new Error("Authentication error"));
    }
  });


  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    socket.emit("userInfo", { userId: socket.userId });
    socket.on("joinConversation", (conversationId) => {
      socket.join(conversationId);
      console.log(`User joined conversation ${conversationId}`);
    });

    socket.on("leaveConversation", (conversationId) => {
      socket.leave(conversationId);
      console.log(`User ${socket.userId} left conversation ${conversationId}`);
    })

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
          attachments,
          readBy: [socket.userId],
        });

        // updated lastMessageAt cho Conversation
        await updateLastMessage(conversationId, text, attachments, socket.userId);

        const populatedMessage = await newMessage.populate([
          { path: "sender", select: "name email role" },
          { path: "attachments" }
        ]);

        // send message to everyone in chat room
        io.to(conversationId).emit("receiveMessage", populatedMessage);

        // confirm send message successfully
        socket.emit("messageSaved", populatedMessage)
      } catch (error) {
        console.error("Error sending message:", error);
      }
    });

    socket.on("markAsRead", async ({ conversationId }) => {
      try {
        const message = getMessageModel();

        // update the unread message
        await message.updateMany(
          {
            conversation: conversationId,
            readBy: { $ne: socket.userId },
          },
          { $push: { readBy: socket.userId } }
        );

        io.to(conversationId).emit("messageRead", {
          conversationId,
          userId: socket.userId,
        });

        console.log(`User ${socket.userId} marked messages as read in ${conversationId}`);
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    })

    // chatbot socket
    socket.on("joinChatbot", () => {
      socket.join(`chatbot-${socket.userId}`);
    });

    socket.on("chatbotMessage", async (msg) => {
      if (!msg?.trim()) return;

      try {
        let conversation = await chatbotConversationModel.findOne({
          user: socket.userId,
        });
        if (!conversation) {
          conversation = await chatbotConversationModel.create({
            user: socket.userId,
            title: "Conversation with ChatBot",
            lastMessage: "",
            lastMessageAt: new Date(),
          });
        }

        const userMessage = await chatbotMessageModel.create({
          conversation: conversation._id,
          senderType: "user",
          text: msg,
        });

        clearConversationCache(socket.userId);

        const replyText = await getChatbotReply(
          socket.userId,
          conversation._id,
          msg
        );

        const botMessage = await chatbotMessageModel.create({
          conversation: conversation._id,
          senderType: "bot",
          text: replyText,
        });

        conversation.lastMessage = replyText;
        conversation.lastMessageAt = new Date();
        await conversation.save();

        io.to(`chatbot-${socket.userId}`).emit("receiveMessage", [
          botMessage,
        ]);
      } catch (error) {
        console.error("Chatbot socket error:", error);
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};
