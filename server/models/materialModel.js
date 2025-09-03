import mongoose from "mongoose";

const materialsSchema = new mongoose.Schema({
    courseId: {
        type: mongoose.Types.ObjectId,
        ref: "course",
        required: true
    },
    title: {
        type: String,
    },
    s3_url: {
        type: String,
    },
    key: {
        type: String, // S3 object key
    },
    fileType: {
        type: String, // e.g., 'image/jpeg', 'application/pdf'
    },
    uploadedAt: {
        type: Date,
        default: Date.now(),
    },
    processingStatus: {
        type: String,
        enum: ["pending", "processing", "done", "error"],
        default: "pending"
    },
    chunkCount: {
        type: Number,
        default: 0
    },
    extractedTextLength: {
        type: Number,
        default: 0
    }
});

const materialsModel = mongoose.model("material", materialsSchema);

export default materialsModel;
