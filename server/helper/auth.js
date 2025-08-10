import bcrypt from 'bcrypt';

export const hashPassword = async (password) => {
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        return hash;
    } catch (error) {
        console.log("Error hashing password:", error);
    }
}

export const comparePassword = async (password, hashPassword) => {
    return bcrypt.compare(password, hashPassword);
}