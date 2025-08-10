import dotenv from "dotenv";
import morgan from "morgan";
import express from "express";
import cors from "cors";
import colors from "colors";
import cookieParser from "cookie-parser";
import { v2 as cloudinary } from 'cloudinary';

import connectDB from "./config/db.js";
import userRouter from "./routes/userRoute.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import categoryRoute from "./routes/categoryRoute.js";
import subCategoryRoute from "./routes/subCategoryRoute.js";

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
app.use("/api/product", productRouter);
app.use("/api/category", categoryRoute);
app.use("/api/sub-category", subCategoryRoute);
app.use("/api/cart", cartRouter);

app.listen(PORT, () => {
    console.log(`Server in running on ${process.env.DEV_MODE} mode on port ${PORT}`.bgCyan.white);
})