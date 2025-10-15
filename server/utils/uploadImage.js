import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_SECRET_KEY,
});

const uploadImageCloudinary = async (image, folderName = "binkey") => {
    const buffet = image?.buffer || Buffer.from(await image.arrayBuffer());

    const uploadImage = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: folderName }, (error, uploadResult) => {
            if (error) reject(error)
            else resolve(uploadResult);
        }).end(buffet)
    })

    return uploadImage;
};

export default uploadImageCloudinary;