import chatbotConversationModel from "../models/chatbotConversationModel.js";
import chatbotMessageModel from "../models/chatbotMessageModel.js";
// import { getChatbotReply } from "../services/chatbotService.js";

// export const chatBotController = async (req, res) => {
//   const userId = req.user?._id;
//   const { message } = req.body;

//   if (!userId)
//     return res.status(401).json({ success: false, message: "Unauthorized" });
//   if (!message || !message.trim())
//     return res
//       .status(400)
//       .json({ success: false, message: "Message cannot be empty" });

//   try {
//     // check and create conversation if not exists
//     let conversation = await chatbotConversationModel.findOne({ user: userId });
//     if (!conversation) {
//       conversation = await chatbotConversationModel.create({
//         user: userId,
//         title: "Conversation with ChatBot",
//         lastMessage: "",
//         lastMessageAt: new Date(),
//       });
//     }

//     // save user message
//     const userMessage = await chatbotMessageModel.create({
//       conversation: conversation._id,
//       senderType: "user",
//       text: message,
//     });

//     // chatbot reply
//     const replyText = await getChatbotReply(message);

//     const botMessage = await chatbotMessageModel.create({
//       conversation: conversation._id,
//       senderType: "bot",
//       text: replyText,
//     });

//     // update conversation
//     conversation.lastMessage = replyText;
//     conversation.lastMessageAt = new Date();
//     await conversation.save();

//     return res.status(200).json({
//       success: true,
//       conversationId: conversation._id,
//       messages: [userMessage, botMessage],
//     });
//   } catch (error) {
//     console.error("ChatBot Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to process chatbot conversation",
//     });
//   }
// };

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
