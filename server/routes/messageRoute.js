import express from "express";
import { getMessageByConversationController, sendMessageController } from "../controllers/messageController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import uploadMaterials from "../middlewares/uploadMaterials.js";

const messageRoute = express.Router();

messageRoute.post("/send",
    isAuthenticated,
    uploadMaterials.array("materials", 10),
    sendMessageController
);
messageRoute.get("/get-message/:conversationId", isAuthenticated, getMessageByConversationController);

export default messageRoute;
