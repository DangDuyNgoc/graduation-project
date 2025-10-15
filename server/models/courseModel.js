import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    description: {
        type: String,
    },
    thumbnail: {
        public_id: {
            type: String,
        },
        url: {
            type: String,
        }
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
            type: mongoose.Types.ObjectId,
            ref: "material",
        }
    ]
}, { timestamps: true });

const courseModel = mongoose.model("course", courseSchema);

export default courseModel;