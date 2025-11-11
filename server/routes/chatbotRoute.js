import express from "express";
import { chatBotController } from "../controllers/chatbotController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";

const chatbotRoute = express.Router();

chatbotRoute.post("/chat", isAuthenticated, chatBotController);

export default chatbotRoute;
