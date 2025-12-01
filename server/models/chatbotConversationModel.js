import mongoose from "mongoose";

const chatbotConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Types.ObjectId,
      ref: "user",
      required: true,
    },
    title: {
      type: String,
      default: "Chat with Chatbot",
      trim: true,
    },
    lastMessage: {
      type: String,
      default: "",
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

chatbotConversationSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.model(
  "chatbot_conversation",
  chatbotConversationSchema
);
