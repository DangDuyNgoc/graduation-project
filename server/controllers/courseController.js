import axios from "axios";
import cloudinary from "cloudinary";
import courseModel from "../models/courseModel.js";
import userModel from "../models/userModel.js";
import { deleteObjects, deleteOneObject } from "../utils/deleteObject.js";
import { putObject } from "../utils/putObject.js";
import assignmentModel from "../models/assignmentModel.js";
import submissionModel from "../models/submissionModel.js";
import uploadImageCloudinary from "../utils/uploadImage.js";
import PlagiarismReportModel from "../models/PlagiarismReport.js";

export const createCourseController = async (req, res) => {
    req.file = req.files?.thumbnail?.[0];
    req.files = req.files?.materials || [];
    try {
        const { name, description } = req.body;

        if (!name || !description) {
            return res.status(400).send({
                success: false,
                message: "Please fill all the fields"
            })
        };

        const uploadThumbnail = await uploadImageCloudinary(req.file, "binkey/courses");
        if (!uploadThumbnail || !uploadThumbnail.public_id || !uploadThumbnail.secure_url) {
            return res.status(500).send({
                success: false,
                message: "Thumbnail upload failed"
            });
        }

        let course = new courseModel({
            name,
            description,
            thumbnail: {
                public_id: uploadThumbnail.public_id,
                url: uploadThumbnail.secure_url
            },
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

export const getCourseByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

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

        // check enrolled user
        const isEnrolled = course.studentIds.some(
            (studentId) => studentId.toString() === userId.toString()
        );

        const isTeacher = course.teacherId._id.toString() === userId.toString();

        if (!isEnrolled && !isTeacher) {
            return res.status(403).json({
                success: false,
                message: "You have not enrolled in this course yet.",
                enrolled: false,
            });
        };

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

// get courses by teacher id
export const getCoursesByTeacherId =  async(req, res) => {
  const teacherId = req.user._id;
  try {
    if (!teacherId) {
      return res.status(400).send({
        success: false,
        message: "Please provide ID of course",
      });
    }

    const courses = await courseModel.find({ teacherId }).populate("teacherId");
    if (!courses || courses.length === 0) {
      return res.status(404).send({
        success: false,
        message: "Course not found",
      });
    }

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
          courseObj.materials = materialsFromFlask;

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
      message: "Courses fetched successfully",
      course: coursesWithMaterials,
    });
  } catch (error) {
    console.log("Error in get courses teacher: ", error);
    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
}

// get all information of student by course id
export const getAllInfoStudentByCourseIdController = async (req, res) => {
  try {
    const { id } = req.params;

    const course = await courseModel
      .findById(id)
      .populate({
        path: "studentIds",
        model: userModel,
        select: "name email phone avatar _id",
        // match: { role: "STUDENT" },
      })
      .select("studentIds name _id");

    if (!course || !course.studentIds || course.studentIds.length === 0) {
      return res.status(404).send({
        success: false,
        message: "No students found for this course.",
      });
    }

    res.status(200).send({
      success: true,
      message: "Fetched all students successfully.",
      students: course.studentIds,
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    return res.status(500).send({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};

// get all information of students have not in course
export const getAllInfoStudentController = async (req, res) => {
  try {
    const { courseId } = req.query;
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;

    const query = { role: "STUDENT" };

    if (courseId) {
      const course = await courseModel.findById(courseId).select("studentIds");
      if (!course) {
        return res.status(404).send({
          success: false,
          message: "Course not found",
        });
      }
      query._id = { $nin: course.studentIds };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const total = await userModel.countDocuments(query);

    const students = await userModel
      .find(query)
      .select("_id name email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    if (students.length === 0) {
      return res.status(404).send({
        success: false,
        message: "No students found",
      });
    }

    res.status(200).send({
      success: true,
      message: "Fetched all students successfully",
      students,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all students error:", error);
    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
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
              courseObj.materials = materialsFromFlask;

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
    req.file = req.files?.thumbnail?.[0];
    req.files = req.files?.materials || [];
    try {
        const { name, description } = req.body;
        const { id } = req.params;

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

        let course = await courseModel.findById(id);
        if (!course) {
            return res.status(404).send({
                success: false,
                message: "Course not found",
            })
        };

        // update thumbnail if it has
        if (req.file) {
            //  delete old thumbnail if exists
            if (course.thumbnail?.public_id) {
                try {
                    await cloudinary.uploader.destroy(course.thumbnail.public_id);
                } catch (error) {
                    console.log("Error deleting old thumbnail: ", error)
                }
            }

            // upload new thumbnail
            const uploadResult = await uploadImageCloudinary(req.file, "binkey/courses");
            if (!uploadResult?.public_id || !uploadResult?.secure_url) {
                return res.status(500).send({
                    success: false,
                    message: "Thumbnail upload failed",
                });
            };

            // attached the new thumbnail
            updateData.thumbnail = {
                public_id: uploadResult.public_id,
                secure_url: uploadResult.secure_url
            };
        };

        // update name, description or thumbnail
        course = await courseModel.findByIdAndUpdate(
            id,
            updateData,
            { new: true }
        );

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
        await deleteObjects(s3_key_map.flat(Infinity).filter(Boolean));

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
            
            // delete plagiarismReport from DB
            await PlagiarismReportModel.deleteMany({
              submissionId: { $in: submissionIds },
            });

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

      // delete all data from DB: courses, assignments, submissions, and plagiarismReport
      await Promise.all([
        PlagiarismReportModel.deleteMany({}),
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