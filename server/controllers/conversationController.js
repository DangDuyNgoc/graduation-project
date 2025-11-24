import mongoose from "mongoose";
import conversationModel from "../models/conversationModel.js";

export const createOrGetConversation = async (req, res) => {
    try {
        const { participants, createConversation } = req.body;

        if (!participants || !Array.isArray(participants) || participants.length < 2) {
            return res.status(400).send({
                success: false,
                message: "Participants are required and should be more than 2"
            });
        };

        // convert participants -> ObjectId[]
        const participantsIds = participants.map((id) => new mongoose.Types.ObjectId(id));

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

        if (!createConversation) {
            return res.status(200).send({
                success: true,
                message: "No conversation found",
                conversation: null
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
export const getAllUserConversations = async (req, res) => {
    try {
        const { userId } = req.params;
        const conversations = await conversationModel.find({
            participants: userId,
            deletedFor: { $ne: userId }
        })
            .populate("participants", "name email role avatar")
            .populate("lastMessage", "text attachments createdAt")
            .sort({ updatedAt: -1 })

        return res.status(200).send({
            success: true,
            message: "Fetched all conversations successfully",
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

// get one conversation 
export const getOneConversationController = async (req, res) => {
    try {
        const { conversationId } = req.params;

        if (!conversationId) {
            return res.status(400).send({
                success: false,
                message: "Please provide conversation id",
            });
        };

        const conversation = await conversationModel.findById(conversationId)
            .populate("participants", "name email role avatar")
            .populate("groupAdmin", "name")
            .lean();

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: "Conversation not found",
            });
        }

        if (conversation.lastMessageSender) {
            const lastSender = await conversationModel
                .populate(conversation, {
                    path: "lastMessageSender",
                    select: "name avatar email"
                });

            conversation.lastMessageSender = lastSender.lastMessageSender;
        }

        return res.status(200).send({
            success: true,
            message: "Fetched Conversation by id successfully",
            conversation
        });
    } catch (error) {
        console.log("Error in get conversation by ID: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal Server Error",
        })
    }
}

export const updateLastMessage = async (conversationId, text, attachments, senderId) => {
    try {
        const conversation = await conversationModel.findById(conversationId).lean();
        if (!conversation) return;

        await conversationModel.findByIdAndUpdate(conversationId, {
            lastMessage: text || (attachments?.length ? "attached files" : ""),
            lastMessageAt: new Date(),
            lastMessageSender: senderId,

        })
    } catch (error) {
        console.log("Error in update message: ", error);
    }
};

export const deleteConversationForUserController = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user._id;

        if (!conversationId) {
            return res.status(404).send({
                success: false,
                message: "Conversation not found",
            });
        }

        const conversation = await conversationModel.findById(conversationId);

        if (!conversation) {
            return res.status(400).send({
                success: false,
                message: "Please provide conversation id",
            });
        };

        // check if the user join the conversation
        if (!conversation.participants.includes(userId)) {
            return res.status(403).send({
                success: false,
                message: "You are not part of this conversation",
            });
        };

        if (!conversation.deletedFor.includes(userId)) {
            conversation.deletedFor.push(userId);
            await conversation.save();
        }

        return res.status(200).send({
            success: true,
            message: "Conversation deleted for you successfully"
        });
    } catch (error) {
        console.log("Error in delete conversation for user: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

export const getConversationByCourseController = async (req, res) => {
    try {
        const { courseId } = req.params;

        if (!courseId) {
            return res.status(400).send({
                success: false,
                message: "Please provide courseId",
            });
        };

        const conversation = await conversationModel.findOne({ course: courseId, isGroup: true })
            .populate("participants", "name email avatar")
            .populate("groupAdmin", "name")
            .lean();

        if (!conversation) {
            return res.status(404).send({
                success: false,
                message: "Conversation not found",
            });
        };

        const result = {
            _id: conversation._id,
            name: conversation.name,
            groupAdmin: conversation.groupAdmin ? { _id: conversation.groupAdmin._id, name: conversation.groupAdmin.name } : null,
            participants: conversation.participants.map(p => ({
                _id: p._id,
                name: p.name,
                email: p.email,
                avatar: p.avatar || null
            }))
        };

        return res.status(200).send({
            success: true,
            message: "Fetched conversation by course successfully",
            conversations: [result]
        });
    } catch (error) {
        console.log("Error in ger conversation by course Id: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
}

// update group chat
export const updateGroupChatController = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { name, membersToAdd, membersToRemove } = req.body;

        if (!conversationId) {
            return res.status(400).send({
                success: false,
                message: "Please provide conversationId"
            });
        };

        const update = {};

        if (name) update.name = name;
        if (Array.isArray(membersToAdd) && membersToAdd.length > 0) {
            update.$addToSet = { participants: { $each: membersToAdd } }
        };

        // remove members
        if (Array.isArray(membersToRemove) && membersToRemove.length > 0) {
            update.$pull = { participants: { $in: membersToRemove } }
        };

        const conversation = await conversationModel.findByIdAndUpdate(
            conversationId, update,
            { new: true }
        )

        if (!conversation) {
            return res.status(404).send({
                success: false,
                message: "Conversation not found"
            })
        }

        res.status(200).send({
            success: true,
            message: "Updated Successfully",
            conversation
        });
    } catch (error) {
        console.log("Error in get conversation update: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
}
