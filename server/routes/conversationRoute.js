import express from "express";
import { createOrGetConversation, getUserConversations } from "../controllers/conversationController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";

const conversationRoute = express.Router();

conversationRoute.post("/create-or-get", isAuthenticated, createOrGetConversation);
conversationRoute.get("/get-conversation/:userId", isAuthenticated, getUserConversations);

export default conversationRoute;