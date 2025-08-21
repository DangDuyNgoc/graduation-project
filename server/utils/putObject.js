import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./s3Credential";

export const putObject = async (file, fileName, mimetype) => {
    try {
        const params = {
            Bucket: process.env.AWS_S3_BUCKET,
            Key: `${fileName}`,
            Body: file,
            ContentType: mimetype,
        }

        const command = new PutObjectCommand(params);
        const data = await s3Client.send(command);

        if (!data.$metadata.httpStatusCode || data.$metadata.httpStatusCode !== 200) {
            throw new Error("Failed to upload file to S3");
        }

        let url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${params.Key}`;
        console.log("File uploaded successfully:", url);
        return { url, key: params.Key };
    } catch (error) {
        console.error("Error uploading file to S3:", error);
        throw new Error("File upload failed");
    }
}