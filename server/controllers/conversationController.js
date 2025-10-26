import conversationModel from "../models/conversationModel";

export const createOrGetConversation = async (req, res) => {
    try {
        const { participants, isGroup, name, adminId } = req.body;

        if (!participants || Array.isArray(participants) || participants.length < 2) {
            return res.status(400).send({
                success: false,
                message: "Participants are required and should be more than 2"
            });
        };

        // group chat
        if (isGroup) {
            const newGroup = await conversationModel.create({
                name: name || "New Group",
                isGroup: true,
                participants,
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
            participants: { $all: participants, $size: 2 }
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
            participants
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