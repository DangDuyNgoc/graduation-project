import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie"
import { getMessageModel } from "../helper/getMessageModel.js";
import { updateLastMessage } from "../controllers/conversationController.js";
import userModel from "../models/userModel.js";
import conversationModel from "../models/conversationModel.js";
import mongoose from "mongoose";

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

        io.to(conversationId).emit("conversationUpdated", {
          conversationId: conversationId,
          lastMessage: populatedMessage.text,
          lastMessageAt: populatedMessage.createdAt,
          lastMessageSender: populatedMessage.sender._id,
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

    // create a group chat
    socket.on("createGroup", async ({ name, participants, adminId, courseId }) => {
      try {
        if (!participants || !Array.isArray(participants) || participants.length < 3) {
          return socket.emit("error", { message: "Participants must be at least 3" });
        }

        // convert participants to ObjectId
        const participantIds = participants.map(id => new mongoose.Types.ObjectId(id));

        // create new group
        const newGroup = await conversationModel.create({
          name: name || "New Group",
          isGroup: true,
          participants: participantIds,
          groupAdmin: new mongoose.Types.ObjectId(adminId),
          course: courseId ? new mongoose.Types.ObjectId(courseId) : undefined,
        });

        // populate participants and groupAdmin
        const populatedGroup = await conversationModel.findById(newGroup._id)
          .populate("participants", "name email role avatar")
          .populate("groupAdmin", "name avatar")
          .lean();

        // send new group info to all participants
        participantIds.forEach(userId => {
          io.to(userId.toString()).emit("groupCreated", populatedGroup);
        });

        // confirm 
        socket.emit("groupCreatedSuccess", populatedGroup);

        console.log("Group created: ", populatedGroup._id);

      } catch (error) {
        console.error("Error creating group:", error);
      }
    });

    // add member to group chat
    socket.on("addMembers", async ({ conversationId, newMembers }) => {
      try {
        const conversation = await conversationModel.findById(conversationId);

        if (!conversation || !conversation.isGroup) {
          return socket.emit("error", { message: "Conversation is not a group" });
        }

        // filter members
        const membersToAdd = newMembers.filter(
          id => !conversation.participants.map(p => p.toString()).includes(id)
        );

        if (membersToAdd.length === 0) return;

        conversation.participants.push(...membersToAdd);
        await conversation.save();

        const updated = await conversationModel.findById(conversationId)
          .populate("participants", "name email role avatar")
          .populate("groupAdmin", "name avatar")

        io.to(conversationId).emit("membersAdded", updated);

        membersToAdd.forEach(uid => {
          io.to(uid).emit("addedToGroup", updated);
        });

        socket.emit("addMembersSuccess", updated);
      } catch (error) {
        console.error("Error add members to group chat:", error);
      }
    })

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};
