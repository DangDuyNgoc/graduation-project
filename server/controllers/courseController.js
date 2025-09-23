import axios from "axios";
import courseModel from "../models/courseModel.js";
import materialsModel from "../models/materialModel.js";
import userModel from "../models/userModel.js";
import { deleteObjects, deleteOneObject } from "../utils/deleteObject.js";
import { putObject } from "../utils/putObject.js";
import assignmentModel from "../models/assignmentModel.js";
import submissionModel from "../models/submissionModel.js";

export const createCourseController = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || !description) {
            return res.status(400).send({
                success: false,
                message: "Please fill all the fields"
            })
        };

        let course = new courseModel({
            name,
            description,
            teacherId: req.user._id,
        });

        await course.save();

        // upload course to S3
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(async (file) => {
                const fileName = `courses/${Date.now()}_${file.originalname}`;
                const { url } = await putObject(file.buffer, fileName, file.mimetype);

                const material = new materialsModel({
                    courseId: course._id,
                    title: file.originalname,
                    s3_url: url,
                    key: fileName, // S3 object key
                    fileType: file.mimetype,
                    ownerType: "courseMaterial"
                });

                await material.save();

                // call flask api to processing embedding 
                try {
                    const flaskRes = await axios.post(
                        `http://localhost:5000/process_material/${material._id}`,
                    );
                    // console.log("Flask processing result:", flaskRes.data);
                } catch (error) {
                    console.error("Error calling Flask API:", error.response?.data || error.message);
                };

                return material._id;
            });

            const materialIds = await Promise.all(uploadPromises);

            // push material into course
            course.materials.push(...materialIds);

            await course.save();
        }

        // populate before sending request
        course = await courseModel.findById(course._id)
            .populate("teacherId")
            .populate("materials");

        return res.status(200).send({
            success: true,
            message: "Create Course Successfully",
            course: course
        });
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

        const course = await courseModel.findById(id)
            .populate("teacherId")
            .populate("materials");

        if (!course || course.length === 0) {
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
            .populate("teacherId")
            .populate("materials");

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

        let course = await courseModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true });
        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            })
        };

        // upload new materials if provided
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(async (file) => {
                const fileName = `courses/${Date.now()}_${file.originalname}`;
                const { url } = await putObject(file.buffer, fileName, file.mimetype);

                const material = new materialsModel({
                    courseId: course._id,
                    title: file.originalname,
                    s3_url: url,
                    key: fileName,
                    fileType: file.mimetype,
                    ownerType: "courseMaterial"
                })

                await material.save();

                // call flask api to processing embedding 
                try {
                    const flaskRes = await axios.post(
                        `http://localhost:5000/process_material/${material._id}`,
                    );
                    console.log("Flask processing result:", flaskRes.data);
                } catch (error) {
                    console.error("Error calling Flask API:", error.response?.data || error.message);
                };

                return material._id;
            });

            const materialIds = await Promise.all(uploadPromises);
            course.materials.push(...materialIds);

            await course.save();
        };

        course = await courseModel.findById(course._id)
            .populate("teacherId")
            .populate("materials");

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

        const course = await courseModel.findById(id).populate("materials");
        if (!course || course.length === 0) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            });
        };

        // Check if the course has materials to delete
        if (course.materials.length === 0) {
            return res.status(400).send({
                success: false,
                message: "No materials to delete for this course"
            });
        }

        // call flask api
        try {
            await axios.delete(`http://localhost:5000/delete_course/${id}`)
        } catch (error) {
            console.error("Error calling Flask API:", error.response?.data || error.message);
        }

        // delete materials from S3
        await deleteObjects(course.materials.map(material => material.key));
        await materialsModel.deleteMany({ courseId: id });

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
        const { courseId, materialKey, materialId } = req.body;

        if (!courseId || !materialKey || !materialId) {
            return res.status(400).send({
                success: false,
                message: "Please provide course ID, material key and material ID"
            });
        };

        const course = await courseModel.findById(courseId).populate("materials");
        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            });
        };

        // find the material to delete
        const material = await materialsModel.findById(materialId);
        if (!material) {
            return res.status(404).send({
                success: false,
                message: "Material not found in this course",
            });
        };

        // delete the material from S3
        await deleteOneObject(materialKey);
        await materialsModel.findByIdAndDelete(materialId);

        // call flask api
        try {
            await axios.delete(`http://localhost:5000/delete_material/${materialId}`)
        } catch (error) {
            console.error("Error calling Flask API:", error.response?.data || error.message);
        }

        // remove the material from the course
        course.materials.pull(materialId);
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

        const course = await courseModel.findById(id).populate("materials");
        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            })
        };

        // call flask api 
        try {
            await axios.delete(`http://localhost:5000/delete_course/${id}`)
        } catch (error) {
            console.error("Error calling Flask API:", error.response?.data || error.message);
        }

        // get all assignments of the course
        const assignments = await assignmentModel.find({ courseId: id });

        for (const assignment of assignments) {
            // get all submissions of the assignment
            const submissions = await submissionModel.find({ assignment: assignment._id });
            for (const submission of submissions) {
                if (submission.materials && submission.materials.length > 0) {
                    const subMaterials = await materialsModel.find({ _id: { $in: submission.materials } });
                    const subKeys = subMaterials.map(m => m.key);

                    if (subKeys.length > 0) {
                        await deleteObjects(subKeys);
                    }
                    await materialsModel.deleteMany({ _id: { $in: submission.materials } });
                }
            }
            await submissionModel.deleteMany({ assignment: assignment._id });
        }

        await assignmentModel.deleteMany({ courseId: id });

        // delete materials from S3
        if (course.materials && course.materials.length > 0) {
            const materialKey = course.materials.map(mat => mat.key)
                .filter(key => typeof key === "string" && key.length > 0);

            await deleteObjects(materialKey);
            await materialsModel.deleteMany({ courseId: id });
        };

        await courseModel.findByIdAndDelete(id);

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

// delete all course 
export const deleteAllCourseController = async (req, res) => {
    try {
        const course = await courseModel.find({})
            .populate("teacherId")
            .populate("materials")

        if (!course) {
            return res.status(400).send({
                success: false,
                message: "Course not found",
            });
        };

        const allMaterials = await materialsModel.find({});
        const allKeys = allMaterials.map(mat => mat.key);

        if (allKeys.length > 0) {
            // delete all file from S3
            await deleteObjects(allKeys);
        };

        // call flask api
        for (const c of course) {
            try {
                for (const mat of allMaterials) {
                    await axios.delete(`http://localhost:5000/delete_course/${c._id}`)
                }
            } catch (error) {
                console.error("Error calling Flask API:", error.response?.data || error.message);
            }
        }

        await materialsModel.deleteMany({});

        await courseModel.deleteMany({});

        return res.status(200).send({
            success: true,
            message: "Deleted all course successfully",
        });
    } catch (error) {
        console.log("Error in delete all course: ", error);
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