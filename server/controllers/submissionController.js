import axios from "axios";

import assignmentModel from "../models/assignmentModel.js";
import materialsModel from "../models/materialModel.js";
import submissionModel from "../models/submissionModel.js";
import userModel from "../models/userModel.js";
import { deleteObjects } from "../utils/deleteObject.js";
import { putObject } from "../utils/putObject.js";

export const uploadSubmissionController = async (req, res) => {
    try {
        const { id } = req.params; // ID of assignment

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
                return res.status(400).send({
                    success: false,
                    message: "The submission deadline has passed. Late submissions are not allowed."
                });
            };

            isLate = true;
            lateDuration = now.getTime() - assignments.dueDate.getTime();
        };

        const materialDocs = [];

        for (const file of req.files) {
            const fileName = `submission/${Date.now()}_${file.originalname}`;
            const { url } = await putObject(file.buffer, fileName, file.mimetype)

            const material = new materialsModel({
                submissionId: null,
                title: file.originalname,
                s3_url: url,
                key: fileName,
                fileType: file.mimetype,
                ownerType: "submissionMaterial"
            });

            await material.save();
            materialDocs.push(material);
        };

        // create submission
        const submission = new submissionModel({
            student: req.user._id,
            assignment: id,
            materials: materialDocs.map(m => m._id),
            isLate,
            lateDuration
        });

        await submission.save();

        // update submission into materials
        await materialsModel.updateMany(
            { _id: { $in: materialDocs.map(m => m._id) } },
            { $set: { submissionId: submission._id } }
        );

        // call flask api to process the submission
        try {
            await axios.post(`http://localhost:5000/process_submission/${submission._id}`);
        } catch (error) {
            console.error("Error calling Flask API:", error.response?.data || error.message);
        }

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
    const { id } = req.params; // submission id 
    let { keepOld } = req.body; // flag to keep old files, true = append, false = replace

    if (!id) {
        return res.status(400).send({
            success: false,
            message: "Please provide ID of submission"
        })
    };

    const submission = await submissionModel.findById(id).populate("assignment");

    if (!submission) {
        return res.status(404).send({
            success: false,
            message: "Submission not found"
        });
    };

    const assignments = submission.assignment;
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

    if (submission.student.toString() !== req.user._id.toString()) {
        return res.status(403).send({
            success: false,
            message: "You are not allowed to update this submission"
        });
    }

    if (!req.files || req.files.length === 0) {
        return res.status(400).send({
            success: false,
            message: "Please upload at least one file"
        });
    };

    // if replace keepOld = false, delete chunks + old materials
    if (!keepOld) {
        // call flask api to delete related chunks schema
        try {
            await axios.post(`http://localhost:5000/delete_submission_chunks/${submission._id}`);
        } catch (error) {
            console.error("Error calling Flask API in deleting files:", error.response?.data || error.message);
        }

        // delete old material (DB + S3)
        const oldMaterials = await materialsModel.find({ _id: { $in: submission.materials } });
        if (oldMaterials.length > 0) {
            const oldKeys = oldMaterials.map(m => m.key);
            await deleteObjects(oldKeys);
            await materialsModel.deleteMany({ _id: { $in: submission.materials } });
        };

        submission.materials = [];
    }


    // upload the new file to S3
    const newMaterialDocs = [];
    for (const file of req.files) {
        const fileName = `submission/${Date.now()}_${file.originalname}`;
        const { url } = await putObject(file.buffer, fileName, file.mimetype);

        const material = new materialsModel({
            submissionId: submission._id,
            ownerType: "submissionMaterial",
            title: file.originalname,
            s3_url: url,
            key: fileName,
            fileType: file.mimetype,
        });

        await material.save();
        newMaterialDocs.push(material);
    };

    // update submission
    submission.materials = [...submission.materials, ...newMaterialDocs.map(m => m._id)];
    submission.isLate = isLate;
    submission.lateDuration = lateDuration;
    await submission.save();

    // call flask api to process the submission
    try {
        await axios.post(`http://localhost:5000/process_submission/${submission._id}`);
    } catch (error) {
        console.error("Error calling Flask API in processing submission:", error.response?.data || error.message);
    }

    res.status(200).send({
        success: true,
        message: isLate
            ? `Submission updated successfully (LATE by ${Math.floor(lateDuration / 60000)} minutes)`
            : "Submission updated successfully",
        submission
    });
};

export const getAllSubmissionController = async (req, res) => {
    try {
        const { id } = req.params; // assignment id

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of assignment"
            });
        };

        const assignment = await assignmentModel.findById(id);
        if (!assignment) {
            return res.status(404).send({
                success: false,
                message: "Assignment not found"
            })
        };

        const submissions = await submissionModel.find({ assignment: id })
            .populate("assignment")
            .populate("materials")
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
};

// get one submission
export const getSubmissionController = async (req, res) => {
    try {
        const { id } = req.params; //submissionId

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of submission"
            });
        };

        const submission = await submissionModel.findById(id)
            .populate("materials")
            .populate("assignment")
            .populate("student");

        if (!submission) {
            return res.status(404).send({
                success: false,
                message: "Submission not found"
            })
        }

        return res.status(200).send({
            success: true,
            message: "Fetched Submission Successfully",
            submission
        })

    } catch (error) {
        console.log("Error in get one submission: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

// get all Submissions by student id
export const getStudentSubmissionsController = async (req, res) => {
    try {
        const { id } = req.params; // studentId
        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of student"
            });
        };

        const student = await userModel.findById(id);
        if (!student) {
            return res.status(404).send({
                success: false,
                message: "Student not found"
            });
        };

        const submission = await submissionModel.find({ student: id })
            .populate("assignment")
            .populate("materials")
            .populate("student");
        if (!submission) {
            return res.status(404).send({
                success: false,
                message: "Submission not found"
            })
        }

        return res.status(200).send({
            success: true,
            message: "Fetched get all submission by student id successfully",
            submission
        });

    } catch (error) {
        console.log("Error in get all submissions by student id: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

export const deleteOneSubmissionController = async (req, res) => {
    try {
        const { id } = req.params; // submission id
        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of assignment"
            });
        };

        const submission = await submissionModel.findById(id);
        if (!submission) {
            return res.status(404).send({
                success: false,
                message: "Submission not found"
            });
        }
        const material = await materialsModel.find({ _id: { $in: submission.materials } });
        if (!material) {
            return res.status(404).send({
                success: false,
                message: "Material not found"
            });
        };

        // delete material from S3
        const keys = material.map(m => m.key);
        await deleteObjects(keys);
        await materialsModel.deleteMany({ _id: { $in: submission.materials } });

        // call flask api to delete related chunks schema
        try {
            await axios.post(`http://localhost:5000/delete_submission/${submission._id}`);
        } catch (error) {
            console.error("Error calling Flask API:", error.response?.data || error.message);
        }

        await submissionModel.findByIdAndDelete(id);

        return res.status(200).send({
            success: true,
            message: "Deleted submission successfully"
        });

    } catch (error) {
        console.log("Error in delete one submissions: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

// delete all submissions of an assignment
export const deleteAllSubmissionsController = async (req, res) => {
    try {
        const { id } = req.params; // assignmentId
        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of assignment"
            });
        };

        const assignment = await assignmentModel.findById(id);
        if (!assignment) {
            return res.status(404).send({
                success: false,
                message: "Assignment not found"
            });
        };

        const submissions = await submissionModel.find({ assignment: id });
        if (submissions.length === 0) {
            return res.status(404).send({
                success: false,
                message: "No submissions found for this assignment"
            });
        };

        for (const submission of submissions) {
            const materials = await materialsModel.find({ _id: { $in: submission.materials } });
            if (materials.length > 0) {
                const keys = materials.map(m => m.key);
                await deleteObjects(keys);
                await materialsModel.deleteMany({ _id: { $in: submission.materials } });
            };
            await submissionModel.findByIdAndDelete(submission._id);
        };

        // call flask api to delete related chunks schema
        try {
            await axios.post('http://localhost:5000/delete_all_submission');
        } catch (error) {
            console.error("Error calling Flask API:", error.response?.data || error.message);
        }

        return res.status(200).send({
            success: true,
            message: "Deleted all submissions of an assignment successfully"
        });

    } catch (error) {
        console.log("Error in delete all submissions of an assignment: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};