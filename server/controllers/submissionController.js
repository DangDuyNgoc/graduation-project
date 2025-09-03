import submissionModel from "../models/submissionModel.js";
import { putObject } from "../utils/putObject.js";

export const uploadSubmission = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of assignment"
            })
        };

        if (!req.files || req.files.length === 0) {
            return res.status(400).send({
                success: false,
                message: "Please upload at least one file"
            });
        };


        const uploadPromises = req.files.map(async (file) => {
            const fileName = `submission/${Date.now()}_${file.originalname}`;
            const { url } = await putObject(file.buffer, fileName, file.mimetype)

            return url;
        });
        const fileUrls = await Promise.all(uploadPromises);

        const submission = new submissionModel({
            student: req.user._id,
            assignment: id,
            fileUrls
        });

        await submission.save();

        res.status(200).send({
            success: true,
            message: "Submission submitted successfully",
            submission
        });

    } catch (error) {
        console.log("Error in upload submission: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

export const updateSubmissionController = async (req, res) => {

}