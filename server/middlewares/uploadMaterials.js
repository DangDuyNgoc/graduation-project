import multer from "multer";

const storage = multer.memoryStorage();
const uploadMaterials = multer({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            "application/pdf",
            "application/msword", // .doc
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
            "application/vnd.ms-powerpoint", // .ppt
            "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
            "application/vnd.ms-excel", // .xls
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/octet-stream"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error("Unsupported file type"), false);
        };
        cb(null, true);
    }
});

export default uploadMaterials;