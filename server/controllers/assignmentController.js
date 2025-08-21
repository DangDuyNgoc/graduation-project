import assignmentModel from "../models/assignmentModel.js";
import courseModel from "../models/courseModel.js";

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

        const assignment = new assignmentModel({
            courseId,
            teacherId: req.userId,
            title,
            description,
            dueDate
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
        const { id } = req.params;

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of assignment"
            })
        };

        const assignment = await assignmentModel.find({ id })
            .populate("teacherId")
            .sort({ createdAt: -1 });

        if (!assignment) {
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

        const assignment = await assignmentModel.findById(id).sort({ createdAt: -1 });

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

        const assignment = await assignmentModel.findByIdAndUpdate(id, {
            title,
            description,
            dueDate
        }, { new: true });

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
                message: "Please provide at least one field to update"
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