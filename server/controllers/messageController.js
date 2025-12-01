import { getMessageModel } from "../helper/getMessageModel.js";
import materialsModel from "../models/materialModel.js";
import { putObject } from "../utils/putObject.js";
import { updateLastMessage } from "./conversationController.js";

export const sendMessageController = async (req, res) => {
    try {
        const { conversationId, senderId, text } = req.body;
        const messageModel = getMessageModel();

        // upload assignment file to s3
        let attachments = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(async (file) => {
                const fileName = `attachments/${Date.now()}_${file.originalname}`;
                const { url } = await putObject(file.buffer, fileName, file.mimetype);

                const material = await materialsModel.create({
                    title: file.originalname,
                    s3_url: url,
                    key: fileName,
                    fileType: file.mimetype
                });

                return material._id;
            });

            attachments = await Promise.all(uploadPromises);
        }

        const newMessage = await messageModel.create({
            conversation: conversationId,
            sender: senderId,
            text,
            attachments
        });

        await newMessage.populate([
            { path: "sender", select: "name email role avatar" },
            { path: "attachments", select: "title s3_url key fileType uploadedAt" }
        ]);

        await updateLastMessage(conversationId, text, attachments, senderId);

        res.status(200).send({
            success: true,
            message: "Send message successfully",
            newMessage
        });
    } catch (error) {
        console.log("Error in send message: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

// get all messages in one conversation
export const getMessageByConversationController = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const messageModel = getMessageModel();

        const messages = await messageModel.find({ conversation: conversationId })
            .populate({
                path: "sender",
                select: "name email role avatar"
            })
            .populate("attachments", "title s3_url key fileType")
            .sort({ createdAt: -1 })
        res.status(200).send({
            success: true,
            message: "get message successfully",
            messages
        })
    } catch (error) {
        console.log("Error in get message: ", error);
        return res.status(500).send({
            success: true,
            message: "Internal server error"
        })
    }
};

export const markConversationAsReadController = async (req, res) => {
    try {
        const userId = req.user._id;
        const { conversationId } = req.params;

        if (!conversationId) {
            return res.status(400).send({
                success: false,
                message: "conversationId is required"
            });
        };

        const messageModel = getMessageModel();

        await messageModel.updateMany(
            {
                conversation: conversationId,
                readBy: { $ne: userId },
            },
            {
                $push: { readBy: userId }
            }
        );

        res.status(200).send({
            success: true,
            message: "Marked conversation as read successfully"
        });
    } catch (error) {
        console.log("Error in mark conversation as read: ", error);
        return res.status(500).send({
            success: true,
            message: "Internal server error"
        })
    }
}

export const getUnreadMessageCountController = async (req, res) => {
    try {
        const userId = req.user._id;
        const messageModel = getMessageModel();

        const conversation = await messageModel.aggregate([
            {
                $match: {
                    sender: { $ne: userId },
                    readBy: { $nin: [userId] }
                }
            },
            {
                $group: {
                    _id: "$conversation"
                }
            },
            {
                $count: "unreadConversationCount"
            }
        ]);

        const unreadConversationCount = conversation[0]?.unreadConversationCount || 0;

        res.status(200).send({
            success: true,
            message: "Get unread message count successfully",
            unreadConversationCount,
        });
    } catch (error) {
        console.log("Error in get unread message count: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
}
