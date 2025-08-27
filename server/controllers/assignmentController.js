import assignmentModel from "../models/assignmentModel.js";
import courseModel from "../models/courseModel.js";
import { deleteObjects } from "../utils/deleteObject.js";
import { putObject } from "../utils/putObject.js";

export const createAssignmentController = async (req, res) => {
    try {
        const { courseId, title, description, dueDate } = req.body;

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
        const { id } = req.params;

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of assignment"
            })
        };

        const assignment = await assignmentModel.findById(id);

        if (!assignment) {
            return res.status(404).send({
                success: false,
                message: "Assignment not found"
            });
        };

        res.status(200).send({
            success: true,
            message: "Assignment fetched Successfully",
            assignment
        })
    } catch (error) {
        console.log("Error in get assignment by id: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

// get all assignment
export const getAllAssignmentController = async (req, res) => {
    try {
        const assignments = await assignmentModel.find()
            .populate("createdBy")
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

// update assignment
export const updateAssignmentController = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, dueDate } = req.body;

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

export const deleteAssignmentController = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide Id of assignment"
            })
        };

        const assignment = await assignmentModel.findByIdAndDelete(id);

        if (!assignment) {
            return res.status(404).send({
                success: false,
                message: "Assignment not found"
            })
        };

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

// delete assignment material
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
        await deleteObjects(materialKey);

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
            message: "Deleted all assignments successfully",
            assignments
        });
    } catch (error) {
        console.log("Error in delete all assignments: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};