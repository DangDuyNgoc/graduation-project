import assignmentModel from "../models/assignmentModel.js";
import submissionModel from "../models/submissionModel.js";
import { putObject } from "../utils/putObject.js";

export const uploadSubmissionController = async (req, res) => {
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

        const assignments = await assignmentModel.findById(id);
        if (!assignments) {
            return res.status(404).send({
                success: false,
                message: "Assignment not found"
            })
        };

        // check late submission
        const now = new Date();
        let isLate = false;
        let lateDuration = 0;

        if (assignments.dueDate && now > assignments.dueDate) {
            if (!assignments.allowLateSubmission) {
                return res.status.send({
                    success: false,
                    message: "The submission deadline has passed. Late submissions are not allowed."
                });
            };

            isLate = true;
            lateDuration = now.getTime() - assignments.dueDate.getTime();
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
            message: isLate ? `Submission submitted successfully(LATE by ${Math.floor(lateDuration / 60000)
                } minutes)`
                : "Submission submitted successfully",
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

};

export const getAllSubmissionController = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return req.status(400).send({
                success: false,
                message: "Please provide ID"
            });
        };

        const assignment = await assignmentModel.findById(id);
        if (!assignment) {
            return res.status(404).send({
                success: false,
                message: "Assignment not found"
            })
        };

        const submissions = await submissionModel.find()
            .populate("assignment")
            .populate("student")

        res.status(200).send({
            success: true,
            message: "Get all submissions successfully",
            submissions
        });
    } catch (error) {
        console.log("Error in get all submissions: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
}
