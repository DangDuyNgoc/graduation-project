import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
    },
    teacherId: {
        type: mongoose.Types.ObjectId,
        ref: "user",
        required: true
    },
    studentIds: [
        {
            type: mongoose.Types.ObjectId,
            ref: "user",
        }
    ],
    materials: [
        {
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
            }
        }
    ]
}, { timestamps: true });

const courseModel = mongoose.model("course", courseSchema);

export default courseModel;