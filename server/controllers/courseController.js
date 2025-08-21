import courseModel from "../models/courseModel.js";
import { putObject } from "../utils/putObject.js";

export const createCourseController = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !description) {
            return res.status(400).send({
                success: false,
                message: "Please fill all the fields"
            })
        };

        // upload course to S3
        let materials = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(async (file) => {
                const fileName = `courses/${Date.now()}_${file.originalname}`;
                const { url } = await putObject(file.buffer, fileName, file.mimetype);

                return {
                    title: file.originalname,
                    s3_url: url,
                    fileType: file.mimetype,
                }
            });

            materials = await Promise.all(uploadPromises);
        }

        const course = new courseModel({
            name,
            description,
            teacherId: req.userId,
            materials,
        });

        await course.save();

        return res.status(200).send({
            success: true,
            message: "Create Course Successfully",
            course: course
        })
    } catch (error) {
        console.log("Error in create course: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

export const getCourseController = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of course"
            })
        };

        const course = await courseModel.findById(id).populate("teacherId");

        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            })
        };

        return res.status(200).send({
            success: true,
            message: "Course details fetched successfully",
            course
        });
    } catch (error) {
        console.log("Error in get course: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

export const getAllCourseController = async (req, res) => {
    try {
        const course = await courseModel.find({})
            .sort({ createdAt: -1 })
            .populate("teacherId");

        return res.status(200).send({
            success: true,
            message: "All Courses fetched successfully",
            course
        });
    } catch (error) {
        console.log("Error in get all courses: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

export const updateCourseController = async (req, res) => {
    try {
        const { name, description } = req.body;
        const { id } = req.params;

        if (!name && !description) {
            return res.status(400).send({
                success: false,
                message: "Please provide at least one field to update"
            })
        };

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of course"
            })
        };

        const course = await courseModel.findByIdAndUpdate(id,
            {
                name, description
            }, { new: true });
        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            })
        };

        return res.status(200).send({
            success: true,
            message: "Updated Course Successfully",
            course: course
        })
    } catch (error) {
        console.log("Error in update course: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

export const deleteCourseController = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of course"
            })
        };

        const course = await courseModel.findByIdAndDelete(id);
        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            })
        };

        return res.status(200).send({
            success: true,
            message: "Deleted Course Successfully",
        })
    } catch (error) {
        console.log("Error in delete course: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};