import express from "express";
import {
    createOrGetConversation,
    getAllUserConversations,
    getOneConversationController
} from "../controllers/conversationController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";

const conversationRoute = express.Router();

conversationRoute.post("/create-or-get", isAuthenticated, createOrGetConversation);
conversationRoute.get("/get-all-conversations/:userId", isAuthenticated, getAllUserConversations);
conversationRoute.get("/get/:conversationId", isAuthenticated, getOneConversationController);

export default conversationRoute;