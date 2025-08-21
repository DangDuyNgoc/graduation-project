import express from 'express';
import {
    forgotPasswordController,
    getUserInfoController,
    loginController,
    logoutController,
    refreshTokenController,
    registrationController,
    requestResetPasswordController,
    updateUserController,
    uploadAvatarController,
    verifyOtpController
} from '../controllers/authController.js';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import uploadImage from '../middlewares/uploadImage.js';

const userRouter = express.Router();

userRouter.post("/registration", registrationController);
userRouter.post("/login", loginController);
userRouter.get("/logout", logoutController);
userRouter.post("/upload-avatar", isAuthenticated, uploadImage.single("avatar"), uploadAvatarController);
userRouter.post("/update-user", isAuthenticated, updateUserController);
userRouter.post("/request-password-reset", requestResetPasswordController);
userRouter.post("/verify-otp", verifyOtpController);
userRouter.post("/forgot-password", forgotPasswordController);
userRouter.get("/me", isAuthenticated, getUserInfoController);
userRouter.get("/refresh-token", refreshTokenController);

export default userRouter;