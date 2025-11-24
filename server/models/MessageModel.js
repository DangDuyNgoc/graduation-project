import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    conversation: {
        type: mongoose.Types.ObjectId,
        ref: "conversation",
        required: true
    },
    sender: {
        type: mongoose.Types.ObjectId,
        ref: "user",
    },
    text: {
        type: String,
        trim: true,
    },
    attachments: [
        {
            type: mongoose.Types.ObjectId,
            ref: "material"
        }
    ],
    readBy: [
        { type: mongoose.Types.ObjectId, ref: "user" }
    ],
    isEdited: {
        type: Boolean,
        default: false,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedBy: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    },
    deletedByName: {
        type: String
    },
    isSYstem: {
        type: Boolean,
        default: false,
    }
}, { timestamps: true });

messageSchema.index({ conversation: 1, createdAt: -1 });
export default messageSchema;