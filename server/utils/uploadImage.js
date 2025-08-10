import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_SECRET_KEY,
});

const uploadImageCloudinary = async (image) => {
    const buffet = image?.buffer || Buffer.from(await image.arrayBuffer());

    const uploadImage = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream({ folder: "binkey" }, (error, uploadResult) => {
            return resolve(uploadResult);
        }).end(buffet)
    })

    return uploadImage;
};

export default uploadImageCloudinary;