import mongoose from "mongoose";

const submissionSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Types.ObjectId,
        ref: "user",
        required: true,
    },
    assignmentId: {
        type: mongoose.Types.ObjectId,
        ref: "assignment",
        index: true,
    },
    fileUrl: {
        type: String,
        required: true
    },
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
    submittedAt: {
        type: Date,
        default: Date.now()
    }
}, { timestamps: true });

const submissionModel = mongoose.model("submission", submissionSchema);

export default submissionModel;