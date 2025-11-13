import mongoose from "mongoose";

const chatbotMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Types.ObjectId,
      ref: "chatbot_conversation",
      required: true,
    },
    senderType: {
      type: String,
      enum: ["user", "bot"],
      required: true,
    },
    text: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

chatbotMessageSchema.index({ conversation: 1, createdAt: 1 });

export default mongoose.model("chatbot_message", chatbotMessageSchema);
