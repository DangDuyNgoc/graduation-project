import { getPlagiarismReportApiById } from "@/api/plagiarismReportApi";
import { getOneSubmisionApiById } from "@/api/submissionApi";
import LoadingSpinner from "@/components/Common/LoadingSpinner";
import DashboardLayout from "@/layout/Dashboard";
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
          getOneSubmisionApiById(id),
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
              src={submission.student?.avatar?.url}
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
                dateStyle: "medium",
                timeStyle: "short",
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
            <p>
              Submitted at:{" "}
              {new Date(submission.submittedAt).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            {submission.isLate && (
              <p className="text-red-600">
                Late by {submission.lateDuration} minutes
              </p>
            )}
            {submission.blockchainTxHash && (
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
            )}
          </div>

          {report && (
            <div className="border-t pt-5">
              <h3 className="text-lg font-semibold mb-2">Plagiarism Report</h3>
              <p className="text-sm text-gray-700 mb-3">
                Similarity Score:{" "}
                <span
                  className={`font-semibold ${
                    report.similarityScore > 0.6
                      ? "text-red-600"
                      : report.similarityScore > 0.3
                      ? "text-yellow-600"
                      : "text-green-600"
                  }`}
                >
                  {(report.similarityScore * 100).toFixed(2)}%
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
                            {match.matchedText.slice(0, 200)}...
                          </p>
                          <p className="text-xs text-gray-500">
                            Similarity: {(match.similarity * 100).toFixed(1)}% |
                            Source:{" "}
                            <span className="italic">{match.sourceType}</span>
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
