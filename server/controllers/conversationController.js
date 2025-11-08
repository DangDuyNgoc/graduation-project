import mongoose from "mongoose";
import conversationModel from "../models/conversationModel.js";

export const createOrGetConversation = async (req, res) => {
    try {
        const { participants, isGroup, name, adminId } = req.body;

        if (!participants || !Array.isArray(participants) || participants.length < 2) {
            return res.status(400).send({
                success: false,
                message: "Participants are required and should be more than 2"
            });
        };

        // convert participants -> ObjectId[]
        const participantsIds = participants.map((id) => new mongoose.Types.ObjectId(id));

        // group chat
        if (isGroup) {
            const newGroup = await conversationModel.create({
                name: name || "New Group",
                isGroup: true,
                participants: participantsIds,
                groupAdmin: adminId
            });

            return res.status(200).send({
                success: true,
                message: "Group chat created successfully",
                conversation: newGroup
            });
        };

        // private chat
        const existing = await conversationModel.findOne({
            isGroup: false,
            participants: { $all: participantsIds },
            $expr: { $eq: [{ $size: "$participants" }, participantsIds.length] },
        });

        if (existing) {
            return res.status(200).send({
                success: true,
                message: "Conversation fetched successfully",
                conversation: existing
            });
        };

        // if not found, create new
        const newConversation = await conversationModel.create({
            isGroup: false,
            participants: participantsIds
        });

        return res.status(200).send({
            success: true,
            message: "Private conversation created successfully",
            conversation: newConversation
        });
    } catch (error) {
        console.log("Error in create or get conversation: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    };
};

// get all conversations of user
export const getUserConversations = async (req, res) => {
    try {
        const { userId } = req.params;
        const conversations = await conversationModel.find({
            participants: userId
        })
            .populate("participants", "name email role")
            .sort({ updatedAt: -1 })

        return res.status(200).send({
            success: true,
            message: "Get user conversations successfully",
            conversations
        })
    } catch (error) {
        console.log("Error in get user conversations: ", error);
        return res.status(500).send({
            success: true,
            message: "Internal server error"
        })
    }
};

export const updateLastMessage = async (conversationId, text, attachments) => {
    try {
        await conversationModel.findByIdAndUpdate(conversationId, {
            lastMessage: text || (attachments?.length ? "attached files" : ""),
            lastMessageAt: new Date(),
        })
    } catch (error) {
        console.log("Error in update message: ", error);
    }
}