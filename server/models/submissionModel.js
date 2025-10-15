import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema({
    student: {
        type: mongoose.Types.ObjectId,
        ref: "user",
        required: true,
    },
    assignment: {
        type: mongoose.Types.ObjectId,
        ref: "assignment",
        index: true,
    },
    materials: [
        {
            type: String,
        }
    ],
    contentHash: {
        type: String, // SHA-256 of content
    },
    plagiarismScore: {
        type: Number // ex: 15%
    },
    aiFeedback: {
        type: String
    },
    blockchainTxHash: {
        type: String // hash of transaction and save on the blockchain
    },
    isLate: {
        type: Boolean,
        default: false,
    },
    lateDuration: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ["Not Submit", "Submitted", "Late Submitted"],
        default: "Not Submit"
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const submissionModel = mongoose.model("submission", submissionSchema);

export default submissionModel;