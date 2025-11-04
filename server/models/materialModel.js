import mongoose from "mongoose";

const materialsSchema = new mongoose.Schema({
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
        default: Date.now,
    },
});

const materialsModel = mongoose.model("material", materialsSchema);

export default materialsModel;
