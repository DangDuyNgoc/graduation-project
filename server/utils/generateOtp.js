import jwt from 'jsonwebtoken';
import crypto from "crypto";

export const generateOtp = (user) => {
    try {
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const token = jwt.sign({
            userId: user._id,
            otp
        }, process.env.JWT_SECRET, {
            expiresIn: '10m' // OTP valid for 10 minutes
        });
        return { otp, token };
    } catch (error) {
        console.error("Error generating OTP:", error);
        throw new Error("Failed to generate OTP");
    }
}

export const generateCode = (length = 4) => {
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += crypto.randomInt(0, 10);
  }
  return otp;
};

export const generateOtpReg = (user) => {
    try {
        const otp = generateCode();
        const token = jwt.sign({
            email: user.email,
            otp
        }, process.env.JWT_SECRET, {
            expiresIn: '10m' // OTP valid for 10 minutes
        });
        return { otp, token };
    } catch (error) {
        console.error("Error generating OTP:", error);
        throw new Error("Failed to generate OTP");
    }
}