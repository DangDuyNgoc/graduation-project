import dotenv from "dotenv";
import morgan from "morgan";
import express from "express";
import cors from "cors";
import colors from "colors";
import cookieParser from "cookie-parser";
import { v2 as cloudinary } from 'cloudinary';

import connectDB from "./config/db.js";
import userRouter from "./routes/userRoute.js";
import courseRoute from "./routes/courseRoute.js";
import assignmentRoute from "./routes/assignmentRoute.js";
import submissionRoute from "./routes/submissionRoute.js";
import chunkRoute from "./routes/chunkRoute.js";

dotenv.config();

connectDB();

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_SECRET_KEY,
});

const app = express();

app.use(morgan("dev"));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.send("API is running....");
})

const PORT = process.env.PORT || 8080;

app.use("/api/user", userRouter);
app.use("/api/course", courseRoute);
app.use("/api/assignment", assignmentRoute);
app.use("/api/submission", submissionRoute);
app.use("/api/chunk", chunkRoute);

app.listen(PORT, () => {
    console.log(`Server in running on ${process.env.DEV_MODE} mode on port ${PORT}`.bgCyan.white);
})