import mongoose from "mongoose";

const chunksSchema = new mongoose.Schema({
    courseId: {
        type: mongoose.Types.ObjectId,
        ref: "course",
        default: null,
    },
    materialId: {
        type: mongoose.Types.ObjectId,
        ref: "material",
        default: null,
    },
    submissionId: {
        type: mongoose.Types.ObjectId,
        ref: "submission",
        default: null,
    },
    text: {
        type: String,
        required: true
    },
    embedding: {
        type: [Number],
        required: true,
    },
    chunkIndex: {
        type: Number,
        required: true
    },
    faissId: {
        type: Number, // mapping to FAISS index
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

chunksSchema.index({ embedding: "vector" });

const chunksModel = mongoose.model("chunk", chunksSchema);

export default chunksModel;