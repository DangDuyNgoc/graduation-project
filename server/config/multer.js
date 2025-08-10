import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fieldSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Only images are allowed"), false);
        }
        cb(null, true);
    }
});

export default upload;