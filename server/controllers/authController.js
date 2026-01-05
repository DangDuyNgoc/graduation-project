import jwt from "jsonwebtoken";
import cloudinary from "cloudinary";
import { createAccessToken, createRefreshToken, sendToken } from "../config/jwt.js";
import { hashPassword, comparePassword, pendingUsers } from "../helper/auth.js";
import userModel from "../models/userModel.js";
import uploadImageCloudinary from "../utils/uploadImage.js";
import { generateOtp, generateOtpReg } from "../utils/generateOtp.js";
import { fileURLToPath } from "url";
import path from "path";
import { sendEmail } from "../utils/sendEmail.js";
import ejs from "ejs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const registrationController = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).send({
        success: false,
        message: "All fields are required",
      });
    }

    const existingUser = await userModel.findOne({ email });
    const pendingUser = pendingUsers.get(email);

    if (existingUser) {
      return res.status(400).send({
        success: false,
        message: "User already exists",
      });
    }

    if (pendingUser) {
      pendingUsers.delete(email);
    }

    const hashedPassword = await hashPassword(password);
    const tokenData = generateOtpReg({ email });
    const otp = tokenData.otp;

    pendingUsers.set(email, {
      name,
      email,
      password: hashedPassword,
      role,
      token: tokenData.token,
      expiresAt: Date.now() + 10 * 60 * 1000,
      resendCooldown: Date.now() + 60 * 1000,
    });

    await sendEmail({
      email,
      subject: "Registering Email Verification",
      template: "verifyCodeOtp.ejs",
      data: { otp },
    });

    return res.status(200).send({
      success: true,
      message: `Please check your email: ${email} to verify your account.`,
      token: tokenData.token,
    });
  } catch (error) {
    pendingUsers.delete(req.body.email);
    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
};

export const validateRegisterController = async (req, res) => {
  try {
    const { email, otp, token } = req.body;

    const pendingUser = pendingUsers.get(email);
    if (!pendingUser) {
      return res.status(400).send({
        success: false,
        message: "No pending registration found",
      });
    }

    if (!otp || !token) {
      return res.status(400).send({
        success: false,
        message: "OTP and token are required",
      });
    }

    if (pendingUser.expiresAt < Date.now()) {
      pendingUsers.delete(email);
      return res.status(400).send({
        success: false,
        message: "OTP expired. Please register again.",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(403).send({
        success: false,
        message: "Invalid or expired token",
      });
    }

    if (decoded.email !== email) {
      return res.status(400).send({
        success: false,
        message: "Email does not match token",
      });
    }

    if (decoded.otp !== otp) {
      return res.status(400).send({
        success: false,
        message: "Invalid OTP",
      });
    }

    await userModel.create({
      name: pendingUser.name,
      email: pendingUser.email,
      password: pendingUser.password,
      role: pendingUser.role,
    });

    pendingUsers.delete(email);

    return res.status(200).send({
      success: true,
      message: "Email verified and user registered successfully",
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
};

export const resendRegisterOtpController = async (req, res) => {
  try {
    const { email } = req.body;

    const pendingUser = pendingUsers.get(email);
    if (!pendingUser) {
      return res.status(400).send({
        success: false,
        message: "No pending registration found",
      });
    }

    const now = Date.now();

    if (pendingUser.resendCooldown > now) {
      return res.status(429).send({
        success: false,
        message: "Please wait before requesting another OTP",
        cooldownLeft: pendingUser.resendCooldown - now,
      });
    }

    if (pendingUser.expiresAt > now) {
      return res.status(400).send({
        success: false,
        message: "OTP is still valid",
        remainingTime: pendingUser.expiresAt - now,
      });
    }

    const tokenData = generateOtpReg({ email });
    const otp = tokenData.otp;

    pendingUser.token = tokenData.token;
    pendingUser.expiresAt = now + 10 * 60 * 1000;
    pendingUser.resendCooldown = now + 60 * 1000;

    await sendEmail({
      email,
      subject: "Resend Email Verification",
      template: "verifyCodeOtp.ejs",
      data: { otp },
    });

    return res.status(200).send({
      success: true,
      message: "OTP resent successfully",
      token: tokenData.token,
    });
  } catch (error) {
    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
};

export const loginController = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).send({
                success: false,
                message: "Please fill all the fields"
            });
        }

        // check if user exists
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(400).send({
                success: false,
                message: "User does not exist"
            });
        }

        // check password
        const matchPassword = await comparePassword(password, user.password);
        if (!matchPassword) {
            return res.status(400).send({
                success: false,
                message: "Invalid credentials"
            });
        }

        const accessToken = createAccessToken(user._id);
        const refreshToken = createRefreshToken(user._id);
        sendToken(res, accessToken, refreshToken);

        return res.status(200).send({
            success: true,
            message: "User logged in successfully",
            user,
            accessToken: accessToken,
            refreshToken: refreshToken
        });

    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

export const logoutController = async (req, res) => {
    try {
        res.cookie("accessToken", "", {
            expires: new Date(Date.now()),
            httpOnly: true,
            sameSite: "strict",
            secure: true,
        })

        res.cookie("refreshToken", "", {
            expires: new Date(Date.now()),
            httpOnly: true,
            sameSite: "strict",
            secure: true,
        })

        return res.status(200).send({
            success: true,
            message: "User logged out successfully"
        });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

export const getUserInfoController = async (req, res) => {
    try {
        const userId = req.user?._id;
        const user = await userModel.findById(userId);

        if (!user) {
            return res.status(400).send({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).send({
            success: true,
            message: "User info retrieved successfully",
            user
        })
    } catch (error) {
        console.error("Get user info error:", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

// upload avatar
export const uploadAvatarController = async (req, res) => {
    try {
        const userId = req.user?._id;
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }
        if (!req.file) {
            return res.status(400).send({
                success: false,
                message: "No file uploaded"
            });
        }

        // delete old avatar if exists
        if (user.avatar && user.avatar.public_id) {
            await cloudinary.v2.uploader.destroy(user.avatar.public_id);
        }

        // upload new avatar
        const uploadImage = await uploadImageCloudinary(req.file, "binkey/avatar");
        if (!uploadImage || !uploadImage.public_id || !uploadImage.secure_url) {
            return res.status(500).send({
                success: false,
                message: "Image upload failed"
            });
        }

        // save avatar info to user
        user.avatar = {
            public_id: uploadImage.public_id,
            url: uploadImage.secure_url
        };
        await user.save();

        return res.status(200).send({
            success: true,
            message: "Avatar uploaded successfully",
            user: user
        });
    } catch (error) {
        console.error("Upload avatar error:", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};


export const updateUserController = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;
        const userId = req.user?._id;
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        if (email) {
            const existingUser = await userModel.findOne({ email });
            if (existingUser && existingUser._id.toString() !== userId.toString()) {
                return res.status(400).send({
                    success: false,
                    message: "Email already in use"
                });
            }
        }
        if (password) {
            const isSamePassword = await comparePassword(password, user.password);

            if (isSamePassword) {
                return res.status(400).send({
                    success: false,
                    message: "New password cannot be the same as the old password"
                });
            }

            user.password = await hashPassword(password);
        }
        user.name = name || user.name;
        user.email = email || user.email;
        user.phone = phone || user.phone;

        await user.save();
        return res.status(200).send({
            success: true,
            message: "User updated successfully",
            user
        });
    } catch (error) {
        console.error("Update user error:", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

// get all information of teacher
export const getAllInfoTeacherController = async (req, res) => {
    try {
        const teacher = await userModel.find({ role: "TEACHER" })
            .select("-password")
            .sort({ createdAt: -1 });

        if (!teacher || teacher.length === 0) {
            return res.status(404).send({
                success: false,
                message: "No teachers found"
            });
        }

        res.status(200).send({
            success: true,
            message: "Fetcher All Teachers Successfully!",
            teacher,
        })
    } catch (error) {
        console.error("Get all teachers error:", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
}

// request reset password
export const requestResetPasswordController = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).send({
                success: false,
                message: "Email is required"
            });
        }

        // check if user exists
        const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        // generate OTP
        const token = generateOtp(user);
        const otp = token.otp;

        const data = { otp };
        const html = await ejs.renderFile(
            path.join(__dirname, "../mail/resetPassword.ejs"),
            data
        )

        try {
            await sendEmail({
                email: user.email,
                subject: "Reset Password",
                template: "resetPassword.ejs",
                data
            })
            return res.status(200).send({
                success: true,
                message: `Please check your email: ${user.email} to reset your password!`,
                token: token.token // send the JWT token
            });
        } catch (error) {
            console.error("Error rendering email template:", error);
            return res.status(500).send({
                success: false,
                message: "Failed to render email template"
            });
        }
    } catch (error) {
        console.error("Request reset password error:", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

// verify otp reset password
export const verifyOtpController = async (req, res) => {
    try {
        const { otp, token } = req.body;
        if (!otp || !token) {
            return res.status(400).send({
                success: false,
                message: "OTP and token are required"
            });
        };

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            console.error("Invalid token:", error);
            return res.status(403).send({
                success: false,
                message: "Invalid or expired token"
            });
        }
        if (decoded.otp !== otp) {
            return res.status(400).send({
                success: false,
                message: "Invalid OTP"
            });
        }

        return res.status(200).send({
            success: true,
            message: "OTP verified successfully. You can now reset your password."
        });
    } catch (error) {
        console.error("Verify OTP error:", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

// reset password
export const forgotPasswordController = async (req, res) => {
    try {
        const { newPassword, token } = req.body;
        if (!newPassword || !token) {
            return res.status(400).send({
                success: false,
                message: "New password and token are required"
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            console.error("Invalid token:", error);
            return res.status(403).send({
                success: false,
                message: "Invalid or expired token"
            });
        };
        const user = await userModel.findById(decoded.userId);
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        };

        const matchPassword = await comparePassword(newPassword, user.password);

        if (matchPassword) {
            return res.status(400).send({
                success: false,
                message: "New password cannot be the same as the old password"
            });
        };

        const hashedPassword = await hashPassword(newPassword);
        user.password = hashedPassword;
        await user.save();
        return res.status(200).send({
            success: true,
            message: "Password reset successfully",
            user: user
        });
    } catch (error) {
        console.error("Forgot password error:", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

export const refreshTokenController = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).send({
                success: false,
                message: "No refresh token provided"
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

        } catch (error) {
            console.error("Invalid refresh token:", error);
            return res.status(403).send({
                success: false,
                message: "Invalid refresh token"
            });
        }

        const user = await userModel.findById(decoded.userId);
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        const newAccessToken = createAccessToken(user._id);
        const newRefreshToken = createRefreshToken(user._id);
        sendToken(res, newAccessToken, newRefreshToken);

        res.status(200).json({
            success: true,
            message: "Access token refreshed successfully",
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        console.error("Refresh token error:", error);
        res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};