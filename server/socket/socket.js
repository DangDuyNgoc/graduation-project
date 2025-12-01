import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie"
import { getMessageModel } from "../helper/getMessageModel.js";
import { updateLastMessage } from "../controllers/conversationController.js";
import userModel from "../models/userModel.js";
import conversationModel from "../models/conversationModel.js";
import mongoose from "mongoose";
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

    // join user room for personal notification
    socket.join(socket.userId.toString());

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

    // send message
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
          { path: "sender", select: "name email role avatar" },
          { path: "attachments" }
        ]);

        // send message to everyone in chat room
        io.to(conversationId).emit("receiveMessage", populatedMessage);

        // confirm send message successfully
        socket.emit("messageSaved", populatedMessage)

        // get conversation and emit conversation updated for all participants
        const conversation = await conversationModel.findById(conversationId).lean();

        // notify receiver about new unread message
        const receiverIdObj = conversation.participants.find(
          (id) => id.toString() !== socket.userId.toString()
        );

        const receiverId = receiverIdObj ? receiverIdObj.toString() : null;

        let unreadCount = 0;
        if (receiverId) {
          unreadCount = await Message.countDocuments({
            conversation: conversationId,
            readBy: { $nin: [new mongoose.Types.ObjectId(receiverId)] },
          })
        }

        // emit conversationUpdated for sender
        io.to(socket.userId.toString()).emit("conversationUpdated", {
          conversationId: conversation._id,
          lastMessage: populatedMessage.text || (attachments?.length ? "attached files" : ""),
          lastMessageAt: populatedMessage.createdAt,
          lastMessageSender: socket.userId,
          unreadCount: 0,
        });

        if (receiverId) {
          io.to(receiverId.toString()).emit("conversationUpdated", {
            conversationId: conversation._id,
            lastMessage: populatedMessage.text || (attachments?.length ? "attached files" : ""),
            lastMessageAt: populatedMessage.createdAt,
            lastMessageSender: socket.userId,
            unreadCount,
          })

          // notify receiver to refresh unread badge for that conversation
          io.to(receiverId.toString()).emit("unreadUpdated", { conversationId });
        }

        // io.to(receiverId.toString()).emit("newUnreadMessage", {
        //   conversationId,
        //   message: populatedMessage,
        // });

        console.log("Sent message:", {
          conversationId,
          from: socket.userId,
          to: receiverId,
          unreadCount,
          messageId: populatedMessage._id.toString()
        });
      } catch (error) {
        console.error("Error sending message:", error);
      }
    });

    // marked read
    socket.on("markAsRead", async ({ conversationId }) => {
      try {
        const message = getMessageModel();

        // update the unread message
        await message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: socket.userId },
            readBy: { $ne: socket.userId },
          },
          { $push: { readBy: socket.userId } }
        );

        io.to(conversationId).emit("messageRead", {
          conversationId,
          userId: socket.userId,
        });

        // update unread count for the user
        io.to(conversationId).emit("unreadUpdated", { conversationId });

        console.log(`User ${socket.userId} marked messages as read in ${conversationId}`);
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    // edit message
    socket.on("editMessage", async ({ messageId, newText }) => {
      try {
        const messageModel = getMessageModel();
        const message = await messageModel.findById(messageId);

        if (!message) return null;
        if (message.sender.toString() !== socket.userId) return;

        message.text = newText;
        message.isEdited = true;
        await message.save();

        const populatedMessage = await message.populate([
          { path: "sender", select: "name email role" },
          { path: "attachments" }
        ]);

        io.to(message.conversation.toString()).emit("messageEdited", populatedMessage);
      } catch (error) {
        console.error("Error editing message:", error);
      }
    });

    // deleted message
    socket.on("deleteMessage", async ({ messageId }) => {
      try {
        const messageModel = getMessageModel();
        const message = await messageModel.findById(messageId);

        if (!message) return null;
        if (message.sender.toString() !== socket.userId) return;

        // get user name
        const user = await userModel.findById(socket.userId);
        const userName = user ? user.name : "Someone";

        message.isDeleted = true;
        message.text = `${userName} deleted the message`;
        message.attachments = [];
        await message.save();

        // update last message for conversation
        const latestMsg = await messageModel.findOne({
          conversation: message.conversation,
          isDeleted: { $ne: true },
        })
          .sort({ createdAt: -1 })
          .lean();

        const lastText = message.text;

        await conversationModel.findByIdAndUpdate(message.conversation, {
          lastMessage: lastText,
          lastMessageAt: latestMsg ? latestMsg.createdAt : null,
          lastMessageSender: latestMsg ? latestMsg.sender : null,
        });

        const updated = {
          _id: message._id.toString(),
          conversation: message.conversation,
          text: message.text,
          isDeleted: true,
          attachments: [],
          deletedBy: socket.userId,
          deletedByName: userName
        };

        io.to(message.conversation.toString()).emit("messageDeleted", updated);
        io.to(message.conversation.toString()).emit("conversationUpdated", {
          conversationId: message.conversation,
          lastMessage: lastText,
          lastMessageAt: latestMsg ? latestMsg.createdAt : null,
          lastMessageSender: latestMsg ? latestMsg.sender : null,
        })
      } catch (error) {
        console.error("Error deleting message:", error);
      }
    });

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

        io.to(`chatbot-${socket.userId}`).emit("receiveMessage", [ userMessage ]);

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
