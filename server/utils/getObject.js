import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./s3Credential.js";

export const getObject = async (key) => {
    try {
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: key,
        }

        const command = new GetObjectCommand(params);
        const data = await s3Client.send(command);

        if (!data.Body) {
            throw new Error("Failed to retrieve file from S3");
        };
    } catch (error) {
        console.error("Error retrieving file from S3:", error);
        throw new Error("File retrieval failed");
    }
}