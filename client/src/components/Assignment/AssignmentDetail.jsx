import { Link, useParams } from "react-router-dom";
import api from "@/utils/axiosInstance";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { LoaderCircle, FileUp, Paperclip, FileText } from "lucide-react";

import DashboardLayout from "@/layout/Dashboard";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import BlockchainInfo from "../Blockchain/BlockchainInfo";

const AssignmentDetail = () => {
  const { id } = useParams(); // assignment id
  const [assignment, setAssignment] = useState(null);
  const [selectedFile, setSelectedFile] = useState([]);
  const [submission, setSubmission] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [keepOld, setKeepOld] = useState(true);
  const [plagiarismReport, setPlagiarismReport] = useState(null);
  const [modal, setModal] = useState(false);

  const ALLOWED_SIMILARITY = 0.6;

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/assignment/get-assignment/${id}`, {
        withCredentials: true,
      });

      if (data.success) {
        setAssignment(data.assignment);
        setSubmission(data.submission);
        if (data.submission._id) {
          try {
            const subRes = await api.get(
              `/submission/get-submission/${data.submission._id}`,
              {
                withCredentials: true,
              }
            );
            if (subRes.data.success) {
              setSubmission(subRes.data.submissions);
            }
          } catch (error) {
            console.log("Error fetching detailed submission:", error);
          }
        }
        console.log(data.submission._id);
        if (data.submission && data.submission._id) {
          try {
            const reportRes = await api.get(
              `/plagiarism/get-plagiarism-report/${data.submission._id}`,
              { withCredentials: true }
            );
            if (reportRes.data.success) {
              setPlagiarismReport(reportRes.data.report);
            }
          } catch (error) {
            console.log("No plagiarism report found yet", error);
          }
        }
      } else {
        toast.error(data.message || "Failed to load assignment", {
          id: "enroll_error",
        });
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [id]);

  // check status of submission from DB
  const submissionStatus = submission?.status || "Not Submit";

  // Determine whether to update/resubmit
  const canUpdateSubmission = () => {
    if (!assignment) return false;
    if (!submission) return true; // not submit

    if (
      (submission.status === "Submitted" ||
        submission.status === "Late Submission") &&
      assignment.allowLateSubmission
    ) {
      return true;
    }

    return false;
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);

    setSelectedFile((prevFiles) => {
      const newFiles = files.filter(
        (file) => !prevFiles.some((f) => f.name === file.name)
      );

      const updatedFiles = [...prevFiles, ...newFiles];
      return updatedFiles;
    });
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    setSelectedFile((prevFiles) => {
      const newFiles = files.filter(
        (file) => !prevFiles.some((f) => f.name === file.name)
      );
      const updatedFiles = [...prevFiles, ...newFiles];
      return updatedFiles;
    });
  };

  const handleSubmit = async () => {
    if (!selectedFile) return toast.error("Please select a file first!");
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      selectedFile.forEach((file) => {
        formData.append("fileUrls", file);
      });

      formData.append("keepOld", keepOld);

      const isUpdate = Boolean(submission?._id);
      const endpoint = isUpdate
        ? `/submission/update-submission/${submission._id}`
        : `/submission/add-submission/${id}`;

      const method = isUpdate ? "put" : "post";

      const { data } = await api[method](endpoint, formData, {
        withCredentials: true,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      if (data.success) {
        toast.success(
          submission
            ? "Submission Updated!"
            : null
        );
        await fetchAssignments();
        setSelectedFile([]);

        try {
          const newSubmissionId = data.submission._id;

          if (newSubmissionId) {
            toast.loading("Checking plagiarism...", { id: "plagiarism_check" });
            const plagiarismRes = await api.get(
              `/plagiarism/check-plagiarism/${newSubmissionId}`,
              { withCredentials: true }
            );
            toast.dismiss("plagiarism_check");

            if (plagiarismRes.data.success) {
              setPlagiarismReport(plagiarismRes.data.report);

              if (
                plagiarismRes.data.report.similarityScore > ALLOWED_SIMILARITY
              ) {
                toast.error("High plagiarism detected in your submission!", {
                  id: "plagiarism_result",
                });
                setModal(true);
              } else {
                toast.success("Plagiarism check passed!", {
                  id: "plagiarism_result",
                });
              }
            } else {
              toast.error(
                plagiarismRes.data.message || "Plagiarism check failed",
                { id: "plagiarism_result" }
              );
            }
          } else {
            toast.error("Invalid submission ID for plagiarism check", {
              id: "plagiarism_result",
            });
          }
        } catch (error) {
          console.log(error);
        }
      } else {
        toast.error(data.message || "Submission failed");
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-[70vh]">
          <LoaderCircle className="size-10 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!assignment) {
    return (
      <DashboardLayout>
        <div className="text-center py-10 text-gray-600">
          Assignment not found
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {assignment.title}
              </h1>
              <p className="text-gray-600">
                Due Date:{" "}
                <span className="font-semibold text-red-600">
                  {new Date(assignment.dueDate).toLocaleDateString()}
                </span>
              </p>
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <span>Points: 100</span>
                <span className="mx-4">|</span>
                <span>Status: </span>{" "}
                <span
                  className={
                    submissionStatus === "Submitted"
                      ? "text-green-600 font-semibold ml-1"
                      : submissionStatus === "Late Submitted"
                      ? "text-orange-500 font-semibold ml-1"
                      : "text-red-500 font-semibold ml-1"
                  }
                >
                  {submissionStatus}
                </span>
              </div>
              <div className="mt-2">
                {submission?.submittedAt && (
                  <p className="text-sm text-gray-500">
                    Submitted on:{" "}
                    {new Date(submission.submittedAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Assignment Materials
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The materials provided below will help you complete this assignment
            effectively.
          </p>
          <div>
            {assignment?.materials?.length > 0 ? (
              <ul className="text-sm text-blue-600">
                {assignment.materials.map((m, i) => (
                  <li key={i}>
                    <a
                      href={m.s3_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="hover:underline flex items-center"
                    >
                      <Paperclip size={16} className="mr-1" />
                      {m.title || "Download file"}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-gray-400 italic text-sm">No materials</span>
            )}
          </div>
        </div>

        {/* Submission Form */}
        {canUpdateSubmission() ? (
          <div className="bg-white shadow-sm rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Submit Your Assignment
            </h2>
            <p className="text-gray-600 mb-1">
              Upload your project files. Supported formats: PDF, DOCX.
            </p>
            <p className="text-sm text-gray-500 italic mb-2">
              Estimated time: 4-6 hours. Late submissions will incur a 10%
              penalty per day.
            </p>

            {/* keep old option */}
            {submission && (
              <div className="mt-6 text-left">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Update Mode
                </h3>

                <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                  <span className="text-gray-700 font-medium">
                    {keepOld ? "Keep old files (Append)" : "Replace old files"}
                  </span>

                  {/* Toggle switch */}
                  <button
                    type="button"
                    onClick={() => setKeepOld(!keepOld)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 ${
                      keepOld ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 ${
                        keepOld ? "translate-x-5" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                <p className="text-sm text-gray-500 mt-2 italic mb-2">
                  {keepOld
                    ? "Append mode: Keeps your old files and adds new ones."
                    : "Replace mode: Removes all previous uploads and replaces with new files."}
                </p>
              </div>
            )}

            {/* show old submission files */}
            {submission && submission.materials?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                  Previously Submitted Files
                </h3>
                <ul className="divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
                  {submission.materials.map((mat) => (
                    <li
                      key={mat._id}
                      className="flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <FileText className="text-blue-500" size={18} />
                        <span className="text-gray-800 text-sm truncate max-w-[250px]">
                          {mat.title ||
                            mat.s3_url?.split("/").pop() ||
                            "Unnamed File"}
                        </span>
                      </div>
                      <a
                        href={mat.s3_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm font-medium"
                      >
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* file upload area */}
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="mb-4 flex items-center justify-center">
                <FileUp color="#ccc" size={36} />
              </div>
              <p className="text-lg text-gray-600 mb-2">
                Drag and drop your file here, or click to browse
              </p>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
                accept=".zip,.pdf,.js,.jsx,.txt"
              />
              <label
                htmlFor="file-upload"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md cursor-pointer inline-block"
              >
                Select File
              </label>
              {selectedFile.length > 0 && (
                <div className="mt-4 space-y-2">
                  {selectedFile.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center space-x-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 shadow-sm"
                    >
                      <div className="flex items-center space-x-2">
                        <FileText className="text-blue-500 w-4 h-4" />
                        <span className="text-gray-700 text-sm">
                          {file.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFile((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                        className="text-red-500 cursor-pointer hover:text-red-700 text-sm font-medium"
                      >
                        <span> X Remove</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* submit button */}
            <div className="mt-6 text-center">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || selectedFile.length === 0}
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle className="animate-spin mr-2 size-5 text-white" />
                    <span>Submitting...</span>
                  </>
                ) : submission ? (
                  "Update Assignment"
                ) : (
                  "Submit Assignment"
                )}
              </Button>
            </div>

            {plagiarismReport && (
              <div>
                <Button>
                  <Link to={`/plagiarism-report/${submission._id}`}>
                    View Plagiarism Report
                  </Link>
                </Button>
              </div>
            )}

            {/* Blockchain card */}
            {submission && <BlockchainInfo submission={submission} />}

            {/* Modal */}
            {modal && plagiarismReport && (
              <AlertDialog open={modal} onOpenChange={setModal}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      High Plagiarism Detected
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Your submission has a high similarity score (
                      {(plagiarismReport?.similarityScore * 100).toFixed(2)}
                      %). Are you sure you want to continue submitting this
                      assignment?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setModal(false)}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction>
                      <Link to={`/plagiarism-report/${submission._id}`}>
                        View Report
                      </Link>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ) : (
          <p className="text-gray-500 italic">
            You cannot modify this submission.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AssignmentDetail;
