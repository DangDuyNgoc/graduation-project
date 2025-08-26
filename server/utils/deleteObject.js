import { DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./s3Credential.js";

export const deleteOneObject = async (key) => {
    try {
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
        }
        const command = new DeleteObjectCommand(params);
        const data = await s3Client.send(command);

        if (data.$metadata.httpStatusCode !== 204) {
            throw new Error("Failed to delete file from S3");
        };

        return { success: true, message: "File deleted successfully" };
    } catch (error) {
        console.error("Error deleting file from S3:", error);
        throw new Error("File deletion failed");
    }
};

export const deleteObjects = async (keys) => {
    try {
        const command = new DeleteObjectsCommand({
            Bucket: process.env.AWS_S3_BUCKET,
            Delete: {
                Objects: keys.map(key => ({ Key: key })),
            },
            Quiet: false,
        });

        const data = await s3Client.send(command);

        if (data.$metadata.httpStatusCode !== 200) {
            throw new Error("Failed to delete files from S3");
        };

        return { success: true, message: "Files deleted successfully" };
    } catch (error) {
        console.error("Error deleting files from S3:", error);
        throw new Error("Files deletion failed");
    }
};