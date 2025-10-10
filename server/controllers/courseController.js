import axios from "axios";
import courseModel from "../models/courseModel.js";
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

        const materialIds = [];
        // upload course to S3
        if (req.files && req.files.length > 0) {
          for (const file of req.files) {
            const fileName = `courses/${Date.now()}_${file.originalname}`;
            const { url } = await putObject(
              file.buffer,
              fileName,
              file.mimetype
            );

            let materialId = null;

            try {
              const flaskRes = await axios.post(
                "http://localhost:5000/process_material_course",
                {
                  courseId: course._id.toString(),
                  title: file.originalname,
                  s3_url: url,
                  s3_key: fileName,
                  fileType: file.mimetype,
                  ownerType: "courseMaterial",
                }
              );

              if (flaskRes.data.success) {
                materialId = flaskRes.data._id;
                console.log("Flask material saved:", materialId);

                await axios.post(
                  `http://localhost:5000/process_material/${materialId}`
                );
              } else {
                console.error("Flask save error:", flaskRes.data.error);
              }
            } catch (error) {
              console.error(
                "Error calling Flask:",
                error.response?.data || error.message
              );
            }

            if (materialId) materialIds.push(materialId);
          }
        }

        if (materialIds.length > 0) {
          course.materials.push(...materialIds);
          await course.save();
        }

        // populate before sending request
        course = await courseModel.findById(course._id)
            .populate("teacherId")

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

        if (!course || course.length === 0) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            })
        };

        let materials = [];
        try {
            const flaskRes = await axios.get(
                `http://localhost:5000/get_materials_by_course/${course._id.toString()}`
            );
            if (flaskRes.data.success) {
                materials = flaskRes.data?.materials;
            }
        } catch (err) {
            console.log("[WARNING] Flask materials fetch failed:", err.message);
        }

        const result = {...course.toObject(), materials}

        return res.status(200).send({
            success: true,
            message: "Course details fetched successfully",
            result
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
        const courses = await courseModel.find({})
            .sort({ createdAt: -1 })
            .populate("teacherId")

        const coursesWithMaterials = await Promise.all(
          courses.map(async (course) => {
            try {
              const flaskRes = await axios.get(
                `http://localhost:5000/get_materials_by_course/${course._id.toString()}`
              );

              const materialsFromFlask =
                flaskRes.data?.success && Array.isArray(flaskRes.data.materials)
                  ? flaskRes.data.materials
                  : [];

              const courseObj = course.toObject();
              courseObj.teacherId = {
                ...courseObj.teacherId,
                materialFlask: materialsFromFlask,
              };

              return courseObj;
            } catch (err) {
              console.log(
                `[WARNING] Failed to fetch materials for course ${course._id}:`,
                err.message
              );
              return {
                ...course.toObject(),
                materials: [],
              };
            }
          })
        );

        return res.status(200).send({
            success: true,
            message: "All Courses fetched successfully",
            course: coursesWithMaterials
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
          console.log("Updating materials for course:", course._id);

          // delete old materials on Flask
          const s3_key_map = [];
          try {
            const flaskRes = await axios.delete(
              `http://localhost:5000/delete_course/${course._id.toString()}`
            );

            if (
              Array.isArray(flaskRes.data?.s3_keys) &&
              flaskRes.data.s3_keys.length > 0
            ) {
              s3_key_map.push(...flaskRes.data.s3_keys);
            }
            console.log("Deleted old materials in Flask for course:", id);
          } catch (error) {
            console.error(
              "Error deleting old materials in Flask:",
              error.response?.data || error.message
            );
          }

          // delete old file on S3
          const allKeys = s3_key_map.flat(Infinity).filter(Boolean);
          if (allKeys.length > 0) {
            await deleteObjects(allKeys);
            console.log("Deleted old files on S3:", allKeys.length);
          }

          // upload new file
          const uploadPromises = req.files.map(async (file) => {
            const fileName = `courses/${Date.now()}_${file.originalname}`;
            const { url } = await putObject(
              file.buffer,
              fileName,
              file.mimetype
            );

            let materialId = null;

            try {
              const flaskRes = await axios.post(
                "http://localhost:5000/process_material_course",
                {
                  courseId: course._id.toString(),
                  title: file.originalname,
                  s3_url: url,
                  s3_key: fileName,
                  fileType: file.mimetype,
                  ownerType: "courseMaterial",
                }
              );

              if (flaskRes.data.success) {
                materialId = flaskRes.data._id;
                console.log("Flask material saved:", materialId);

                await axios.post(
                  `http://localhost:5000/process_material/${materialId}`
                );
              } else {
                console.error("Flask save error:", flaskRes.data.error);
              }
            } catch (error) {
              console.error(
                "Error calling Flask:",
                error.response?.data || error.message
              );
            }

            return materialId;
          });

          const materialIds = await Promise.all(uploadPromises);
          const validMaterialIds = materialIds.filter(Boolean); // remove null

          // update materials for course
          if (validMaterialIds.length > 0) {
            course.materials = validMaterialIds; // overwrite
            await course.save();
          }
        }

      course = await courseModel.findById(course._id).populate("teacherId");

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

        const course = await courseModel.findById(id);
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
        let s3_key_map = []
        for (const materialId of course.materials) {
          try {
            const res = await axios.delete(
              `http://localhost:5000/delete_material/${parseInt(materialId)}`
            );
            const s3Key = res.data?.s3_key;
            if (s3Key) s3_key_map.push(s3Key);
          } catch (error) {
            console.error(
              `Failed to delete material ${materialId} in Flask:`,
              error.response?.data || error.message
            );
          }
        }

        // delete materials from S3
        await deleteObjects(s3_key_map);

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

        const course = await courseModel.findById(courseId);
        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            });
        };

        // call flask api
        try {
            await axios.delete(`http://localhost:5000/delete_material/${materialId}`)
        } catch (error) {
            console.error("Error calling Flask API:", error.response?.data || error.message);
        }

        // delete the material from S3
        await deleteOneObject(materialKey);

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

        const course = await courseModel.findById(id);
        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            })
        };

        // call flask api 
        const s3_key_map = [];
        try {
          const flaskRes = await axios.delete(
            `http://localhost:5000/delete_course/${id.toString()}`
          );
          if (flaskRes.data?.s3_keys.length > 0) s3_key_map.push(flaskRes.data?.s3_keys);
        } catch (error) {
          console.error(
            "Error calling Flask API:",
            error.response?.data || error.message
          );
        }

        // get all assignments of the course
        const assignments = await assignmentModel.find({ courseId: id });
        const assignmentIds = assignments.map(a => a._id);

        if (assignmentIds.length > 0) {
            // get all submissions of the assignments
            const submissions = await submissionModel.find({ assignment: { $in: assignmentIds } });
            const submissionIds = submissions.map(s => s._id);

            // delete submissions from DB
            await submissionModel.deleteMany({ _id: { $in: submissionIds } });

            // delete assignments from DB
            await assignmentModel.deleteMany({ _id: { $in: assignmentIds } });
        }

        // delete materials from S3
        const allKeys = s3_key_map.flat(Infinity).filter(Boolean);
        if (allKeys.length > 0) {
          try {
            await deleteObjects(allKeys);
          } catch (err) {
            console.error("Error deleting S3 objects:", err);
          }
        }

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
      const course = await courseModel.find({}).populate("teacherId");

      if (!course || course.length === 0) {
        return res.status(400).send({
          success: false,
          message: "Course not found",
        });
      }

      // call flask api
      const s3_key_map = [];
      try {
        const flaskRes = await axios.delete(
          `http://localhost:5000/delete_all_courses`
        );
        if (
          flaskRes.data?.success === true &&
          Array.isArray(flaskRes.data?.s3_keys)
        ) {
          s3_key_map.push(...flaskRes.data.s3_keys);
        }
      } catch (error) {
        console.error(
          "Error calling Flask API:",
          error.response?.data || error.message
        );
      }

      // Delete S3 files
      const allKeys = s3_key_map.flat(Infinity).filter(Boolean);
      if (allKeys.length > 0) await deleteObjects(allKeys);

      // delete all data from DB: courses, assignments and submissions
      await Promise.all([
        submissionModel.deleteMany({}),
        assignmentModel.deleteMany({}),
        courseModel.deleteMany({}),
      ]);

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