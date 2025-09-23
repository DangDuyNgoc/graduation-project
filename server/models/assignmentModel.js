import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
    },
    dueDate: {
        type: Date,
        default: Date.now
    },
    allowLateSubmission: {
        type: Boolean,
        default: false
    },
    lateSubmissionDuration: {
        type: Number, // in hours
        default: 0
    },
    materials: [
        {
            title: {
                type: String
            },
            s3_url: {
                type: String,
            },
            key: {
                type: String,
            },
            fileType: {
                type: String,
            },
            uploadedAt: {
                type: Date,
                default: Date.now,
            }
        }
    ],
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: "user",
        required: true
    },
    courseId: {
        type: mongoose.Types.ObjectId,
        ref: "course",
        required: true
    }
}, { timestamps: true });

const assignmentModel = mongoose.model("assignment", assignmentSchema);

export default assignmentModel;