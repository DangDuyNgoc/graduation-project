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
        required: true
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
    ]
}, { timestamps: true });

messageSchema.index({ conversation: 1, createdAt: -1 });
export default messageSchema;