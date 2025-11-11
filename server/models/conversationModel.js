import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    isGroup: {
        type: Boolean,
        default: false
    },
    participants: [
        {
            type: mongoose.Types.ObjectId,
            ref: "user",
            required: true
        }
    ],
    lastMessage: {
        type: String
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    lastMessageSender: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    },
    groupAdmin: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    },
    unreadMessages: [
        {
            user: { type: mongoose.Types.ObjectId, ref: "user" },
            count: { type: Number, default: 0 },
        },
    ],
}, { timestamps: true });

conversationSchema.index({ participants: 1 });

const conversationModel = mongoose.model("conversation", conversationSchema);
export default conversationModel;