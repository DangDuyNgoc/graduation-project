import jwt from 'jsonwebtoken';

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