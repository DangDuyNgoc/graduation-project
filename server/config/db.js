import mongoose from "mongoose";
import colors from "colors";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URL);
        console.log(
            colors.green(`Connected to database ${conn.connection.host}`.bgWhite)
        );
    } catch (error) {
        console.log(colors.red(`Error in connecting to database ${error}`.bgWhite));
    }
};

export default connectDB;