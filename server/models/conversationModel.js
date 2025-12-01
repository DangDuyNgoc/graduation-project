import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    course: {
        type: mongoose.Types.ObjectId,
        ref: "course"
    },
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
        type: String,
        default: ""
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
    deletedFor: [
        {
            type: mongoose.Types.ObjectId,
            ref: "user"
        }
    ]
}, { timestamps: true });

conversationSchema.index({ participants: 1 });

const conversationModel = mongoose.model("conversation", conversationSchema);
export default conversationModel;