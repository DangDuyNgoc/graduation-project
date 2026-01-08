import { getPlagiarismReportApiById } from "@/api/plagiarismReportApi";
import { getOneSubmissionApiById } from "@/api/submissionApi";
import LoadingSpinner from "@/components/Common/LoadingSpinner";
import PlagiarismReport from "@/components/PlagiarismReport/PlagiarismReport";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { ExternalLink, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useParams } from "react-router-dom";

export default function TeacherSubmissionStudentPage() {
  const { id } = useParams();
  const [submission, setSubmission] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [subRes, repRes] = await Promise.all([
          getOneSubmissionApiById(id),
          getPlagiarismReportApiById(id),
        ]);

        if (subRes.success) setSubmission(subRes.submissions);
        else toast.error(subRes.message || "Failed to fetch submission");

        if (repRes.success) {
          const reportWithUrls = {
            ...repRes.report,
            files: repRes.report.files.map((file) => {
              const match = subRes.submissions.materials.find(
                (m) => m.title === file.fileName
              );
              return {
                ...file,
                s3_url: match ? match.s3_url : null,
              };
            }),
          };

          setReport(reportWithUrls);
        } else
          toast.error(repRes.message || "Failed to fetch plagiarism report");
      } catch (err) {
        console.error(err);
        toast.error("Error fetching submission details");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleVerifyBlockchain = async (submissionId) => {
    console.log("submission ID, ", submissionId);
    try {
      toast.loading("Verifying on blockchain.....", { id: "verify" });
      const { data } = await api.post(
        `/submission/verify/${submissionId}`,
        {},
        { withCredentials: true }
      );
      toast.dismiss("verify");

      if (data.success) {
        if (data.isValid) {
          toast.success("Submission is Valid!");
        } else {
          toast.error("Submission Tampered (Does not match blockchain)");
        }
      } else {
        toast.error(data.message || "Verification failed");
      }
    } catch (error) {
      console.log(error);
      toast.dismiss("verify");
    }
  };

  return (
    <DashboardLayout>
      {loading ? (
        <LoadingSpinner text="Loading..." className="py-20" />
      ) : !submission ? (
        <p className="text-gray-500 text-center mt-10">No submission found.</p>
      ) : (
        <div className="mx-auto mt-3 p-6 bg-white rounded-xl shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <img
              src={
                submission.student?.avatar?.url ||
                "https://res.cloudinary.com/dsfdghxx4/image/upload/v1730813754/nrxsg8sd9iy10bbsoenn_bzlq2c.png"
              }
              alt="avatar"
              className="w-14 h-14 rounded-full object-cover border"
            />
            <div>
              <h2 className="text-lg font-semibold">
                {submission.student?.name}
              </h2>
              <p className="text-sm text-gray-500">
                {submission.student?.email}
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-xl font-semibold text-gray-800 mb-1">
              {submission.assignment?.title}
            </h3>
            <p className="text-gray-700 text-sm mb-3">
              {submission.assignment?.description}
            </p>
            <p className="text-sm text-gray-500">
              Due:{" "}
              {new Date(submission.assignment?.dueDate).toLocaleString([], {
                timeZone: "UTC",
                dateStyle: "medium",
                timeStyle: "medium",
              })}
              {submission.assignment?.allowLateSubmission && (
                <span className="text-yellow-600 ml-2">(Late allowed)</span>
              )}
            </p>
          </div>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">Submitted Files:</h4>
            {submission.assignment?.materials?.length > 0 ? (
              <div className="space-y-2">
                {submission.assignment.materials.map((file) => (
                  <a
                    key={file._id}
                    href={file.s3_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                  >
                    <FileText className="size-4" />
                    {file.title}
                    <ExternalLink className="size-3" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">No uploaded files.</p>
            )}
          </div>

          <div className="text-sm text-gray-600 border-t pt-3">
            <p>
              Status: <span className="font-medium">{submission.status}</span>
            </p>
            <p className="mt-1">
              Submitted at:{" "}
              {new Date(submission.submittedAt).toLocaleString([], {
                timeZone: "UTC",
                dateStyle: "medium",
                timeStyle: "medium",
              })}
            </p>
            {submission.isLate && (
              <p className="text-red-600">
                Late by {submission.lateDuration} minutes
              </p>
            )}
            {submission.blockchainTxHash ? (
              <p className="mt-1">
                Blockchain Tx:{" "}
                <a
                  href={`https://sepolia.etherscan.io/tx/${submission.blockchainTxHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {submission.blockchainTxHash}
                </a>
              </p>
            ) : (
              <span className="text-gray-400 italic">No on-chain yet</span>
            )}
          </div>

          {report && (
            <div className="border-t pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold mb-2">
                  Plagiarism Report
                </h3>
                <Button onClick={() => handleVerifyBlockchain(submission._id)}>
                  {" "}
                  Verify Blockchain Integrity
                </Button>
              </div>
              <p className="text-sm text-gray-700 mb-2">
                Similarity Score:{" "}
                <span
                  className={`font-semibold ${
                    report.similarityScore >= 0.8
                      ? "text-red-700"
                      : "text-green-600"
                  }`}
                >
                  {(report.similarityScore * 100).toFixed(2)}% -{" "}
                  {report.similarityScore >= 0.8
                    ? "High similarity detected"
                    : "No significant similarity detected"}
                </span>
              </p>

              {report.files?.map((file) => (
                <div
                  key={file._id}
                  className="mb-4 border rounded-lg p-3 bg-gray-50"
                >
                  <h4 className="font-medium text-gray-800 mb-2">
                    <a
                      href={
                        file.fileType === "application/pdf"
                          ? file.s3_url
                          : `https://docs.google.com/gview?url=${encodeURIComponent(
                              file.s3_url
                            )}&embedded=true`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {file.fileName}
                    </a>
                  </h4>

                  {file.matchedSources?.length > 0 ? (
                    <ul className="space-y-2">
                      {file.matchedSources.map((match, idx) => (
                        <li
                          key={idx}
                          className="text-sm border-l-2 border-blue-400 pl-2"
                        >
                          <p className="text-gray-700">
                            <span className="font-medium">Matched:</span>{" "}
                            {match.matchedText}
                          </p>
                          <p className="text-xs font-medium text-gray-500">
                            Similarity:{" "}
                            <span
                              className={`font-semibold ${
                                match.similarity * 100 >= 90
                                  ? "text-red-700"
                                  : match.similarity * 100 >= 80
                                  ? "text-orange-600"
                                  : match.similarity * 100 >= 50
                                  ? "text-yellow-600"
                                  : "text-green-600"
                              }`}
                            >
                              {(match.similarity * 100).toFixed(1)}% -{" "}
                              {match.similarity * 100 >= 90
                                ? "High"
                                : match.similarity * 100 >= 80
                                ? "Medium"
                                : match.similarity * 100 >= 50
                                ? "Low"
                                : "Safe"}
                            </span>{" "}
                            | Source:{" "}
                            <span className="italic">{match.sourceType}</span> |{" "}
                            {match.sourceType === "external" &&
                              match.sourceId && (
                                <a
                                  href={match.sourceId}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline break-all"
                                >
                                  {match.sourceId}
                                </a>
                              )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 text-sm italic">
                      No matches found.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
