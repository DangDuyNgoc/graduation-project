import mongoose from "mongoose";

const emailRegexPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: function (value) {
                return emailRegexPattern.test(value);
            }
        },
    },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        default: null,
    },
    avatar: {
        public_id: String,
        url: String,
    },
    verify_email: {
        type: Boolean,
        default: false,
    },
    role: {
        type: String,
        enum: ["STUDENT", "TEACHER"],
        required: true,
    }
}, { timestamps: true });

const userModel = mongoose.model("user", userSchema);

export default userModel;