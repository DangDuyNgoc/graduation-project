import express from "express";
import {
  // chatBotController,
  getChatHistoryController,
} from "../controllers/chatbotController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";

const chatbotRoute = express.Router();

// chatbotRoute.post("/chat", isAuthenticated, chatBotController);
chatbotRoute.get("/chat-history", isAuthenticated, getChatHistoryController);

export default chatbotRoute;
