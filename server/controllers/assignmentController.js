import axios from "axios";
import assignmentModel from "../models/assignmentModel.js";
import courseModel from "../models/courseModel.js";
import submissionModel from "../models/submissionModel.js";
import { deleteObjects, deleteOneObject } from "../utils/deleteObject.js";
import { putObject } from "../utils/putObject.js";
import PlagiarismReportModel from "../models/PlagiarismReport.js";

export const createAssignmentController = async (req, res) => {
    try {
        const {
            courseId,
            title,
            description,
            dueDate,
            allowLateSubmission,
            lateSubmissionDuration
        } = req.body;

        if (!title || !dueDate) {
            return res.status(400).send({
                success: false,
                message: "Please fill all the fields"
            })
        };

        const course = await courseModel.findById(courseId);

        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            })
        };

        // validate late submission duration
        let validLateDuration = 0;
        if (allowLateSubmission) {
            const durationInMinutes = parseInt(lateSubmissionDuration) || 60;

            if (durationInMinutes > 1440) {
                return res.status(400).send({
                    success: false,
                    message: "Late submission duration cannot exceed 24 hours",
                })
            }
            validLateDuration = durationInMinutes;
        }

        // upload assignment file to s3
        let materials = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(async (file) => {
                const fileName = `assignments/${Date.now()}_${file.originalname}`;
                const { url } = await putObject(file.buffer, fileName, file.mimetype);

                return {
                    title: file.originalname,
                    s3_url: url,
                    key: fileName,
                    fileType: file.mimetype,
                };
            });

            materials = await Promise.all(uploadPromises);
        }

        const assignment = new assignmentModel({
            courseId,
            createdBy: req.user._id,
            title,
            description,
            dueDate,
            allowLateSubmission: !!allowLateSubmission,
            lateSubmissionDuration: validLateDuration,
            materials
        });

        await assignment.save();

        res.status(200).send({
            success: true,
            message: "Assignment Created Successfully",
            assignment: assignment
        });

    } catch (error) {
        console.log("Error in create assignment: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

export const getAssignmentByCourseController = async (req, res) => {
    try {
        const { id } = req.params; // course id

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of assignment"
            })
        };

        const assignment = await assignmentModel.find({ courseId: id })
            .populate("createdBy")
            .sort({ createdAt: -1 });

        if (assignment.length === 0) {
            return res.status(404).send({
                success: false,
                message: "Assignment not found"
            })
        };

        res.status(200).send({
            success: true,
            message: "Get Assignment By Course Successfully",
            assignment
        });
    } catch (error) {
        console.log("Error in get assignment by course: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

export const getAssignmentController = async (req, res) => {
    try {
        const { id } = req.params; // assignment id
        const userId = req.user._id;

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of assignment"
            })
        };

        const assignment = await assignmentModel
            .findById(id)

        const submission = await submissionModel
            .findOne({
                assignment: id,
                student: userId,
            })

        if (!assignment) {
            return res.status(404).send({
                success: false,
                message: "Assignment not found"
            });
        };

        res.status(200).send({
            success: true,
            message: "Assignment fetched Successfully",
            assignment,
            submission: submission || null
        })
    } catch (error) {
        console.log("Error in get assignment by id: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

// get all assignments
export const getAllAssignmentController = async (req, res) => {
    try {
        const assignments = await assignmentModel.find()
            .populate("createdBy", "name email")
            .populate("courseId", "name")
            .sort({ createdAt: -1 });

        res.status(200).send({
            success: true,
            message: "All assignments fetched Successfully",
            assignments
        });
    } catch (error) {
        console.log("Error in get all assignment: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

// get all assignments for student
export const getAllAssignmentForStudentController = async (req, res) => {
    try {
        const studentId = req.user._id;

        // get all courses which student's enrolling in
        const courses = await courseModel.find({ studentIds: studentId }, "_id name")

        // if student's not enrolled in any courses
        if (courses.length === 0) {
            return res.status(404).send({
                success: false,
                message: "You're not enrolled in any courses",
                assignments: [],
            })
        };

        // get all assignments in that courses
        const courseIds = courses.map((c) => c._id);
        const assignments = await assignmentModel
            .find({ courseId: { $in: courseIds } })
            .populate("createdBy", "name")
            .populate("courseId", "name")

        // get all submissions of student
        const submissions = await submissionModel.find({
            student: studentId,
            assignment: { $in: assignments.map(a => a._id) }
        });

        const now = new Date();

        // combine assignment + submission 
        const result = assignments.map(a => {
            const submission = submissions.find(
                s => s.assignment.toString() === a._id.toString()
            );

            let status = "Not Submit";
            let isLate = false;
            let lateDuration = 0;

            if (submission) {
                if (submission.isLate) {
                    status = "Late Submitted";
                    isLate = true;
                    lateDuration = submission.lateDuration || 0;
                } else {
                    status = submission.status || "Submitted";
                }
            };

            const dueDate = new Date(a.dueDate);
            let isOverdue = false;
            let finalDeadline = dueDate;

            if (a.allowLateSubmission && a.lateSubmissionDuration) {
                finalDeadline = new Date(
                    dueDate.getTime() + a.lateSubmissionDuration * 60000
                )
            };

            if (now > finalDeadline) {
                isOverdue = true;
            };

            const timeRemaining = Math.max(0, Math.floor((finalDeadline - now) / 60000));

            return {
                assignmentId: a._id,
                title: a.title,
                description: a.description,
                dueDate: a.dueDate,
                allowLateSubmission: a.allowLateSubmission,
                lateSubmissionDuration: a.lateSubmissionDuration,
                courseName: a.courseId?.name,
                teacherName: a.createdBy?.name,
                status,
                isLate,
                lateDuration,
                submittedAt: submission?.submittedAt || null,
                isOverdue,
                timeRemaining
            }
        });

        res.status(200).send({
            success: true,
            message: "Fetched Assignments For Student Successfully",
            total: result.length,
            assignments: result
        })
    } catch (error) {
        console.log("Error in get all assignments for student: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
}

// update assignment
export const updateAssignmentController = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            dueDate,
            allowLateSubmission,
            lateSubmissionDuration
        } = req.body;

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of assignment"
            })
        };

        if (!title && !dueDate) {
            return res.status(400).send({
                success: false,
                message: "Please provide at least one field to update"
            })
        };

        // build update object
        const updateData = {};
        if (title) updateData.title = title;
        if (description) updateData.description = description;
        if (dueDate) updateData.dueDate = dueDate;

        if (allowLateSubmission !== undefined) {
            updateData.allowLateSubmission = !!allowLateSubmission;

            if (updateData.allowLateSubmission) {
                const durationInMinutes = parseInt(lateSubmissionDuration) || 60;

                if (durationInMinutes > 1440) {
                    return res.status(400).send({
                        success: false,
                        message: "Late submission duration cannot exceed 24 hours (1440 minutes)",
                    });
                }

                updateData.lateSubmissionDuration = durationInMinutes;
            } else {
                updateData.lateSubmissionDuration = 0;
            }
        }

        // upload new materials if provided
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(async (file) => {
                const fileName = `assignments/${Date.now()}_${file.originalname}`;
                const { url } = await putObject(file.buffer, fileName, file.mimetype);

                return {
                    title: file.originalname,
                    s3_url: url,
                    key: fileName,
                    fileType: file.mimetype,
                };
            });

            const newMaterials = await Promise.all(uploadPromises);
            updateData.$push = { materials: { $each: newMaterials } };
        }

        const assignment = await assignmentModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true });

        if (!assignment) {
            return res.status(404).send({
                success: false,
                message: "Assignment not found"
            })
        };

        res.status(200).send({
            success: true,
            message: "Updated Assignment successfully",
            assignment: assignment
        });
    } catch (error) {
        console.log("Error in update assignment: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

// delete one assignment
export const deleteAssignmentController = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide Id of assignment"
            })
        };

        const assignment = await assignmentModel.findById(id);

        if (!assignment) {
            return res.status(404).send({
                success: false,
                message: "Assignment not found"
            })
        };

        // find all submission of this assignment
        const submissions = await submissionModel.find({ assignment: id });

        // delete materials of submissions 
        const flaskResults = await Promise.allSettled(
            submissions.map((sub) =>
                axios.delete(
                    `http://localhost:5000/delete_submission/${sub._id.toString()}`
                )
            )
        );
        const flaskKeys = flaskResults
            .filter((r) => r.status === "fulfilled" && r.value?.data?.success)
            .flatMap((r) => r.value.data.s3_key || [])
            .filter(Boolean);

        flaskResults
            .filter((r) => r.status === "rejected" || !r.value?.data?.success)
            .forEach((r) => {
                console.error(
                    "Flask deletion failed:",
                    r.reason?.message || r.value?.data?.message || "Unknown error"
                );
            });

        const assignmentMaterials = assignment.materials || [];
        const allKeys = [
            ...flaskKeys,
            ...assignmentMaterials.map((m) => m.key),
        ].filter(Boolean);

        // delete all materials from s3
        if (allKeys.length > 0) {
            await deleteObjects(allKeys);
        }

        // delete submissions and assignment
        await PlagiarismReportModel.deleteMany({
          submissionId: { $in: submissions.map((s) => s._id) },
        });
        await submissionModel.deleteMany({ assignment: id });
        await assignmentModel.findByIdAndDelete(id);

        res.status(200).send({
            success: true,
            message: "Deleted Assignment Successfully"
        });
    } catch (error) {
        console.log("Error in delete assignment: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

// delete one assignment material
export const deleteOneAssignmentMaterialController = async (req, res) => {
    try {
        const { assignmentId, materialKey } = req.body;

        if (!assignmentId || !materialKey) {
            return res.status(400).send({
                success: false,
                message: "Please provide assignmentId and materialKey"
            });
        };

        const assignment = await assignmentModel.findById(assignmentId);
        if (!assignment) {
            return res.status(404).send({
                success: false,
                message: "Assignment not found"
            });
        };

        // find material to delete
        const materialIndex = assignment.materials.findIndex(mat => mat.key === materialKey);
        if (materialIndex === -1) {
            return res.status(404).send({
                success: false,
                message: "Material not found in assignment"
            });
        };

        // delete material from s3
        await deleteOneObject(materialKey);

        // remove material from assignment 
        assignment.materials.splice(materialIndex, 1);
        await assignment.save();

        res.status(200).send({
            success: true,
            message: "Deleted assignment material successfully",
            assignment
        });
    } catch (error) {
        console.log("Error in delete assignment material: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

// delete all materials of an assignment 
export const deleteAllMaterialsAssignmentController = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide course ID"
            });
        };

        const assignments = await assignmentModel.findById(id);
        if (!assignments) {
            return res.status(404).send({
                success: false,
                message: "No assignments found for this course"
            });
        };

        // check if the assignment have the materials to delete
        if (!assignments.materials || assignments.materials.length === 0) {
            return res.status(404).send({
                success: false,
                message: "No materials found in these assignments"
            });
        };

        // delete all materials from s3
        await deleteObjects(assignments.materials.map(mat => mat.key));

        // remove all assignments from db
        assignments.materials = [];
        await assignments.save();

        res.status(200).send({
            success: true,
            message: "Deleted all material assignments successfully",
            assignments
        });
    } catch (error) {
        console.log("Error in delete material all assignments: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

// delete all assignments 
export const deleteAllAssignmentController = async (req, res) => {
    try {
        const assignments = await assignmentModel.find({});

        if (assignments.length === 0) {
            return res.status(404).send({
                success: false,
                message: "Assignments not found"
            });
        };

        // delete material and return s3_key
        let s3_key_map = [];
        let mess = null;
        try {
            const flaskRes = await axios.delete(
                `http://localhost:5000/delete_all_submissions`
            );
            const { success, s3_keys, message } = flaskRes.data || {};
            mess = message;
            if (success && Array.isArray(s3_keys) && s3_keys.length > 0) {
                s3KeysFromFlask = s3_keys;
            }
        } catch (error) {
            console.error(
                "Failed to delete all submissions in Flask: ",
                error.message
            );
        }

        // get all materials from assignments
        const assignmentMaterials = assignments.flatMap(a => a.materials);

        // create a list of key file S3 to delete
        const s3Keys = [
            ...s3_key_map,
            ...assignmentMaterials.map(m => m.key),
        ].filter(Boolean);

        if (s3Keys.length > 0) {
            await deleteObjects(s3Keys);
        };

        // delete related plagiarismReport
        await PlagiarismReportModel.deleteMany({});

        // delete related submission
        await submissionModel.deleteMany({});

        // delete assignments
        await assignmentModel.deleteMany({});

        return res.status(200).send({
            success: true,
            message: mess
        });

    } catch (error) {
        console.log("Error in delete all assignments: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};