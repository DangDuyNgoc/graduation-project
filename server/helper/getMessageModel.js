import mongoose from "mongoose";
import messageSchema from "../models/MessageModel";

export const getMessageModel = (year, month) => {
    const now = new Date();
    const y = year || now.getFullYear();
    const m = month || String((now.getMonth() + 1).padStart(2, "0"));

    const collectionName = `message_${y}_${m}`;

    // check if the model is not created yet
    if (!mongoose.models[collectionName]) {
        mongoose.model(collectionName, messageSchema, collectionName);
    };

    return mongoose.models[collectionName];
}