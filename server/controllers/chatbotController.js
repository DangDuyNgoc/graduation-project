// import { formatMessage } from "../helper/formatMessage.js";
// import { getChatbotReply } from "../services/chatbotService.js";
// import { logError } from "../utils/logger.js";

// export const chatBotController = async (req, res) => {
//   const { message } = req.body;
//   if (!message || !message.trim())
//     return res.status(400).json({ error: "Message cannot be empty" });

//   try {
//     const reply = await getChatbotReply(message);
//     const formattedReply = formatMessage(reply);
//     res.json({ reply: formattedReply });
//   } catch (err) {
//     logError(err);
//     res.status(500).json({ error: "Chatbot server error" });
//   }
// };
