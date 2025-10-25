import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    name: {
        type: String,
    },
    isGroup: {
        type: Boolean,
        default: false
    },
    participants: {
        type: mongoose.Types.ObjectId,
        ref: "user",
        required: true
    },
    lastMessage: {
        type: Date,
        default: Date.now
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    groupAdmin: {
        type: mongoose.Types.ObjectId,
        ref: "user"
    }
}, { timestamps: true });

conversationSchema.index({ participants: 1 });

const conversationModel = mongoose.model("conversation", conversationSchema);
export default conversationModel;