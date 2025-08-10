import mongoose from "mongoose";

const embeddingSchema = new mongoose.Schema({
    submissionId: {
        type: mongoose.Types.ObjectId,
        ref: "submission",
        index: true
    },
    assignmentId: {
        type: mongoose.Types.ObjectId,
        ref: "assignment",
        index: true
    },
    dimension: {
        type: Number
    },
    embedding: [
        {
            type: Number
        }
    ],
    model: {
        type: String
    }
}, { timestamps: true });

const embeddingModel = mongoose.model("embedding", embeddingSchema);

export default embeddingModel;