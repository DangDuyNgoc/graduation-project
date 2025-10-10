import axios from "axios";
import crypto from "crypto";

import assignmentModel from "../models/assignmentModel.js";
import submissionModel from "../models/submissionModel.js";
import userModel from "../models/userModel.js";
import { deleteObjects } from "../utils/deleteObject.js";
import { putObject } from "../utils/putObject.js";
import contract from "../utils/blockchain.js";

export const uploadSubmissionController = async (req, res) => {
  try {
    const { id } = req.params; // ID of assignment

    if (!id) {
      return res.status(400).send({
        success: false,
        message: "Please provide ID of assignment",
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).send({
        success: false,
        message: "Please upload at least one file",
      });
    }

    const assignment = await assignmentModel.findById(id);
    if (!assignment) {
      return res.status(404).send({
        success: false,
        message: "Assignment not found",
      });
    }

    // check late submission
    const now = new Date();
    let isLate = false;
    let lateDuration = 0;

    if (assignment.dueDate && now > assignment.dueDate) {
      if (!assignment.allowLateSubmission) {
        return res.status(400).send({
          success: false,
          message:
            "The submission deadline has passed. Late submissions are not allowed.",
        });
      }

      isLate = true;
      lateDuration = now.getTime() - assignment.dueDate.getTime();
    }

    const materialDocs = [];
    const combinedHash = crypto.createHash("sha256");

    for (const file of req.files) {
      const fileName = `submission/${Date.now()}_${file.originalname}`;
      const { url } = await putObject(file.buffer, fileName, file.mimetype);

      combinedHash.update(file.buffer);

      try {
        const response = await axios.post(
          `http://localhost:5000/process_material_submission`,
          {
            s3_url: url,
            s3_key: fileName,
            title: file.originalname,
            fileType: file.mimetype,
            course_id: assignment.courseId?.toString() || null,
            submission_id: null,
            ownerType: "submissionMaterial",
          }
        );

        console.log("Flask processed material:", response.data);

        if (response.data?._id) {
          materialDocs.push(response.data._id);
        } else if (response.data?.id) {
          materialDocs.push(response.data.id);
        }
      } catch (error) {
        console.error(
          "Error sending material to Flask:",
          error.response?.data || error.message
        );
      }
    }

    // get combined hash of all files
    const contentHash = combinedHash.digest("hex");

    // check user info
    if (!req.user || !req.user._id) {
      return res.status(401).send({
        success: false,
        message: "Unauthorized: Missing user info",
      });
    }

    // create submission
    const submission = new submissionModel({
      student: req.user._id,
      assignment: id,
      materials: materialDocs,
      contentHash,
      isLate,
      lateDuration,
    });

    await submission.save();

    // save hash on blockchain
    try {
      const tx = await contract.storeSubmission(id.toString(), contentHash);
      await tx.wait(); // wait for transaction to be mined
      console.log("Submission stored on blockchain with hash:", contentHash);
    } catch (error) {
      console.error("Error storing submission on blockchain:", error);
    }

    // call flask api to process the submission
    try {
      const response = await axios.post(
        `http://localhost:5000/process_submission`,
        {
          submission_id: submission._id.toString(),
          material_ids: materialDocs,
        }
      );
      console.log("Flask processing result:", response.data);
    } catch (error) {
      console.error(
        "Error calling Flask API:",
        error.response?.data || error.message
      );
    }

    res.status(200).send({
      success: true,
      message: isLate
        ? `Submission submitted successfully (LATE by ${Math.floor(
            lateDuration / 60000
          )} minutes)`
        : "Submission submitted successfully",
      submission,
    });
  } catch (error) {
    console.log("Error in upload submission:", error);
    return res.status(500).send({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateSubmissionController = async (req, res) => {
    const { id } = req.params; // submission id 
    let { keepOld } = req.body; // flag to keep old files, true = append, false = replace
    keepOld = keepOld.toString().toLowerCase() === "true" ? true : false;

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
            return res.status(400).send({
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
       try {
         const response = await axios.delete(
           `http://localhost:5000/delete_submission/${submission._id.toString()}`
         );

         const s3_keys = response.data?.s3_key || [];
         console.log("Flask deleted submission and returned S3 keys:", s3_keys);

         if (Array.isArray(s3_keys) && s3_keys.length > 0) {
           await deleteObjects(s3_keys);
           console.log("Deleted old S3 files successfully!");
         }
       } catch (error) {
         console.error(
           "Error deleting old submission or S3 files:",
           error.response?.data || error.message
         );
       }
     }


    // upload the new file to S3
    const newMaterialIds = [];
    let combinedHash = crypto.createHash("sha256");

    for (const file of req.files) {
      const fileName = `submission/${Date.now()}_${file.originalname}`;
      const { url } = await putObject(file.buffer, fileName, file.mimetype);
      combinedHash.update(file.buffer);

      try {
        const response = await axios.post(
          `http://localhost:5000/process_material_submission`,
          {
            s3_url: url,
            s3_key: fileName,
            title: file.originalname,
            fileType: file.mimetype,
            course_id: assignments.courseId?.toString() || null,
            submission_id: submission._id.toString(),
            ownerType: "submissionMaterial",
          }
        );

        if (response.data?._id) {
          newMaterialIds.push(response.data._id);
        }
      } catch (error) {
        console.error(
          "Error sending new material to Flask:",
          error.response?.data || error.message
        );
      }
    }

    // update submission
    submission.isLate = isLate;
    submission.lateDuration = lateDuration;
    submission.contentHash = combinedHash.digest("hex");
    if (!keepOld) submission.materials = [];
    submission.materials = [...submission.materials, ...newMaterialIds];
    await submission.save();

    // save hash on blockchain
    try {
        const tx = await contract.storeSubmission(submission.assignment._id.toString(), submission.contentHash);
        await tx.wait(); // wait for transaction to be mined
        console.log("Submission stored on blockchain with hash:", tx.hash);
    } catch (error) {
        console.error("Error storing submission on blockchain:", error);
    }

    // call flask api to process the submission
    try {
      const response = await axios.post(
        `http://localhost:5000/process_submission`,
        {
          submission_id: submission._id.toString(),
          material_ids: newMaterialIds,
        }
      );
      console.log("Flask reprocessed submission:", response.data);
    } catch (error) {
      console.error(
        "Error calling Flask API to process submission:",
        error.response?.data || error.message
      );
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
            .populate("student")

            let materials = [];
            for (const sub of submissions) {
              const subId = sub._id.toString();
              try {
                const flaskRes = await axios.get(
                  `http://localhost:5000/get_materials_by_submission/${subId}`
                );
                materials = flaskRes.data.materials || [];
              } catch (error) {
                console.error(
                  "Error fetching materials from Flask:",
                  error.response?.data || error.message
                );
                sub.materials = [];
              }
            }

            const result = {
              ...submissions,
              materials,
            };

            res.status(200).send({
              success: true,
              message: "Get all submissions successfully",
              result,
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
            .populate("assignment")
            .populate("student");

        if (!submission) {
            return res.status(404).send({
                success: false,
                message: "Submission not found"
            })
        }

        let materials = [];
        try {
          const flaskRes = await axios.get(
            `http://localhost:5000/get_materials_by_submission/${submission._id.toString()}`
          );
          materials = flaskRes.data.materials || [];
        } catch (error) {
          console.error(
            "Error fetching materials from Flask:",
            error.response?.data || error.message
          );
        }
        const result = {
          ...submission.toObject(),
          materials,
        };

        return res.status(200).send({
            success: true,
            message: "Fetched Submission Successfully",
            result
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
            .populate("student");
        if (!submission || submission.length === 0) {
            return res.status(404).send({
                success: false,
                message: "Submission not found"
            })
        }

       let materials = [];
       for (const sub of submission) {
         try {
           const flaskRes = await axios.get(
             `http://localhost:5000/get_materials_by_submission/${sub._id.toString()}`
           );
           materials = flaskRes.data?.materials || [];
         } catch (error) {
           console.error(
             "Error fetching materials from Flask:",
             error.response?.data || error.message
           );
           materials = [];
         }
       }
       const result = {
          ...submission,
          materials,
        };

        return res.status(200).send({
            success: true,
            message: "Fetched get all submission by student id successfully",
            result
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

        // call flask api to delete related chunks schema and delete material from S3
        let flaskKeys = [];
        try {
          const flaskRes = await axios.delete(
            `http://localhost:5000/delete_submission/${submission._id.toString()}`
          );
          // delete material from S3
          if (flaskRes.data?.s3_key?.length > 0) {
            flaskKeys = flaskRes.data.s3_key;
            await deleteObjects(flaskKeys);
          }
        } catch (error) {
          console.error(
            "Error calling Flask API:",
            error.response?.data || error.message
          );
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

        let s3Keys = [];
        try {
          const flaskRes = await axios.delete(
            "http://localhost:5000/delete_all_submissions"
          );
          if (flaskRes.data?.s3_keys?.length > 0) {
            s3Keys = flaskRes.data.s3_keys;
          }
        } catch (error) {
          console.error(
            "Error calling Flask API:",
            error.response?.data || error.message
          );
        }

        // delete file on S3 if flask return key
        if (s3Keys.length > 0) {
          await deleteObjects(s3Keys);
        }

        await submissionModel.deleteMany({ assignment: id });

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

export const verifySubmissionBlockchainController = async (req, res) => {
    try {
        const { studentId, assignmentId, hash } = req.body;

        if (!studentId || !assignmentId || !hash) {
            return res.status(400).send({
                success: false,
                message: "Please provide studentId, assignmentId and hash"
            });
        }
        const isValid = await contract.verifySubmission(studentId, assignmentId, hash);

        return res.status(200).send({
            success: true,
            message: "Verify submission on blockchain successfully",
            isValid
        });
    } catch (error) {
        console.log("Error in verify submission on blockchain: ", error);
        return res.status(500).send({
            success: false,
            message: "Internal server error"
        });
    }
}