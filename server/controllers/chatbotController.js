import chatbotConversationModel from "../models/chatbotConversationModel.js";
import chatbotMessageModel from "../models/chatbotMessageModel.js";

export const getChatHistoryController = async (req, res) => {
  const userId = req.user?._id;
  if (!userId)
    return res.status(401).json({ success: false, message: "Unauthorized" });

  try {
    let conversation = await chatbotConversationModel.findOne({ user: userId });

    // if no conversation, create a default one with a welcome message
    if (!conversation) {
      conversation = await chatbotConversationModel.create({
        user: userId,
        title: "New conversation",
        lastMessage: "Can I help you?",
        lastMessageAt: new Date(),
      });

      await chatbotMessageModel.create({
        conversation: conversation._id,
        senderType: "bot",
        text: "Can I help you?",
      });
    }

    // take all messages
    const messages = await chatbotMessageModel
      .find({ conversation: conversation._id })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      conversation: {
        _id: conversation._id,
        title: conversation.title,
        lastMessageAt: conversation.lastMessageAt,
      },
      messages,
    });
  } catch (error) {
    console.error("ChatBot History Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load chat history",
    });
  }
};

