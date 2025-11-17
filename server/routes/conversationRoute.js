import express from "express";
import {
    createOrGetConversation,
    deleteConversationForUserController,
    getAllUserConversations,
    getConversationByCourseController,
    getOneConversationController
} from "../controllers/conversationController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";

const conversationRoute = express.Router();

conversationRoute.post("/create-or-get", isAuthenticated, createOrGetConversation);
conversationRoute.get("/get-all-conversations/:userId", isAuthenticated, getAllUserConversations);
conversationRoute.get("/get/:conversationId", isAuthenticated, getOneConversationController);
conversationRoute.delete("/delete/:conversationId", isAuthenticated, deleteConversationForUserController);
conversationRoute.get("/course-participants/:courseId", isAuthenticated, getConversationByCourseController);

export default conversationRoute;