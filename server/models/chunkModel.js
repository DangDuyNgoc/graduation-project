import mongoose from "mongoose";

const chunksSchema = new mongoose.Schema({
    courseId: {
        type: mongoose.Types.ObjectId,
        ref: "course",
        required: true
    },
    materialId: {
        type: mongoose.Types.ObjectId,
        ref: "material",
        required: true
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
    createdAt: {
        type: Date,
        default: Date.now()
    }
});

chunksSchema.index({ embedding: "vector" });

const chunksModel = mongoose.model("chunk", chunksSchema);

export default chunksModel;