import courseModel from "../models/courseModel.js";
import userModel from "../models/userModel.js";
import { deleteObjects, deleteOneObject } from "../utils/deleteObject.js";
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
                    key: fileName, // S3 object key
                    fileType: file.mimetype,
                }
            });

            materials = await Promise.all(uploadPromises);
        }

        const course = new courseModel({
            name,
            description,
            teacherId: req.user._id,
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

        // build update data object
        const updateData = {};
        if (name) updateData.name = name;
        if (description) updateData.description = description;

        // upload new materials if provided
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

            const materials = await Promise.all(uploadPromises);

            // Update the course with new materials
            updateData.$push = { materials: { $each: materials } };
        }

        const course = await courseModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true });
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

// delete course 
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

// delete all materials of a course
export const deleteCourseMaterialsController = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide ID of course"
            })
        };

        const course = await courseModel.findById(id);
        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            });
        };

        // Check if the course has materials to delete
        if (!course.materials || course.materials.length === 0) {
            return res.status(400).send({
                success: false,
                message: "No materials to delete for this course"
            });
        }

        // delete materials from S3
        await deleteObjects(course.materials.map(material => material.key));

        // remove materials from course
        course.materials = [];
        await course.save();
        return res.status(200).send({
            success: true,
            message: "Deleted course materials successfully",
        });
    } catch (error) {
        console.log("Error in delete course materials: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        })
    }
};

// delete one material of a course
export const deleteOneCourseMaterialController = async (req, res) => {
    try {
        const { courseId, materialKey } = req.body;

        if (!courseId || !materialKey) {
            return res.status(400).send({
                success: false,
                message: "Please provide course ID and material key"
            });
        };

        const course = await courseModel.findById(courseId);
        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            });
        };

        // find the material to delete
        const materialIndex = course.materials.findIndex(m => m.key === materialKey);
        if (materialIndex === -1) {
            return res.status(404).send({
                success: false,
                message: "Material not found in this course",
            });
        };

        // delete the material from S3
        await deleteOneObject(materialKey);

        // remove the material from the course
        course.materials.splice(materialIndex, 1);
        await course.save();

        return res.status(200).send({
            success: true,
            message: "Deleted one course material successfully",
            course
        });
    } catch (error) {
        console.log("Error in delete one course material: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

// add students to course by email
export const addStudentsToCourseController = async (req, res) => {
    try {
        const { id } = req.params;
        const { emails } = req.body;

        if (!emails) {
            return res.status(400).send({
                success: false,
                message: "Please provide emails of students to add"
            });
        };

        const course = await courseModel.findById(id);
        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            });
        };

        const students = await userModel.find({ email: { $in: emails } });
        if (!students || students.length === 0) {
            return res.status(404).send({
                success: false,
                message: `No student found with email: ${emails}`,
            });
        };

        // extract student IDs from found students
        const studentIds = students.map(sid => sid._id);
        const foundEmails = students.map(s => s.email);
        const notFoundEmails = emails.filter(email => !foundEmails.includes(email));

        if (notFoundEmails.length > 0) {
            return res.status(404).send({
                success: false,
                message: `No student found with email: ${notFoundEmails}`
            });
        };

        const updateCourse = await courseModel.findByIdAndUpdate(id,
            { $addToSet: { studentIds: { $each: studentIds } } },
            { new: true }
        );

        return res.status(200).send({
            success: true,
            message: "Added students to course successfully",
            course: updateCourse
        });
    } catch (error) {
        console.log("Error in add students to course: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};

// remove students from course by email
export const removeStudentsFromCourseController = async (req, res) => {
    try {
        const { id } = req.params;
        const { studentIds } = req.body;

        if (!id) {
            return res.status(400).send({
                success: false,
                message: "Please provide course ID"
            });
        }

        if (!studentIds || studentIds.length === 0) {
            return res.status(400).send({
                success: false,
                message: "Please provide emails of students to remove"
            });
        };

        const course = await courseModel.findById(id);
        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            });
        };

        // remove many students
        const updatedCourse = await courseModel.findByIdAndUpdate(
            id,
            { $pull: { studentIds: { $in: studentIds } } },
            { new: true }
        );

        return res.status(200).send({
            success: true,
            message: "Removed students from course successfully",
            course: updatedCourse
        });
    } catch (error) {
        console.log("Error in remove students from course: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
};