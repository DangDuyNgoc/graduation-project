import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

export const isAuthenticated = async (req, res, next) => {
    try {
        const accessToken = req.cookies?.accessToken || req.headers.authorization?.replace("Bearer ", "");

        if (!accessToken) {
            return res.status(401).send({
                success: false,
                message: "Please login to access this resource"
            });
        }

        const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);

        const user = await userModel.findById(decoded.userId);
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        };

        req.user = user;
        return next();
    } catch (error) {
        console.error("Authentication error:", error);
        if (error.name === "TokenExpiredError") {
            return res.status(401).send({
                success: false,
                message: "Access token expired",
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                message: "Invalid access token",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};

export const isTeacher = async (req, res, next) => {
    try {
        const user = await userModel.findById(req.user?._id);
        if (user?.role === "STUDENT") {
            return res.status(403).send({
                success: false,
                message: "Access denied, teacher only"
            });
        } else {
            return next();
        }
    } catch (error) {
        console.log(error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};