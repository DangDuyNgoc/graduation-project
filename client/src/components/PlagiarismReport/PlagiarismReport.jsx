import React, { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { useParams } from "react-router-dom";
import api from "@/utils/axiosInstance";
import toast from "react-hot-toast";
import { LoaderCircle } from "lucide-react";
import DashboardLayout from "@/layout/Dashboard";

function PlagiarismReport() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [threshold] = useState(0.6);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/plagiarism/get-plagiarism-report/${id}`,
        {
          headers: {
            "Cache-Control": "no-cache",
          },
          withCredentials: true,
        }
      );
      if (data.success) {
        setReport(data.report);
      } else {
        toast.error(data.message || "Failed to fetch report", {
          id: "enroll_error",
        });
      }
    } catch (error) {
      console.log("Error response:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [id]);

  const handleCheckPlagiarism = async () => {
    setLoading(true);
    try {
      toast.loading("Checking plagiarism...", { id: "plagiarism_check" });
      const { data } = await api.get(`/plagiarism/check-plagiarism/${id}`, {
        withCredentials: true,
      });
      toast.dismiss("plagiarism_check");
      if (data.success) {
        setReport(data.report);
        toast.success("Plagiarism check completed", { id: "plagiarism_check" });
      } else {
        toast.error(data.message || "Plagiarism check failed", {
          id: "plagiarism_check",
        });
      }
    } catch (error) {
      console.log(error);
      toast.error("Failed to check plagiarism", { id: "plagiarism_check" });
    } finally {
      setLoading(false);
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

  if (!report) {
    return (
      <div className="text-center text-gray-600 mt-10">
        No plagiarism report found.
      </div>
    );
  }

  const similarityPercent = (report.similarityScore * 100).toFixed(2);
  const isOverThreshold = report?.similarityScore > threshold;
  const scoreColor = isOverThreshold ? "text-red-600" : "text-green-600";

  return (
    <DashboardLayout>
      <div className="bg-white shadow-md rounded-lg p-6 mt-6">
        <h2>Plagiarism Report</h2>
        <p className="text-gray-700 mb-4">
          Similarity Score:{" "}
          <span className={`font-bold ${scoreColor}`}>
            {similarityPercent}%
          </span>
        </p>

        {isOverThreshold && (
          <Button onClick={handleCheckPlagiarism}>Check Again</Button>
        )}

        <div className="border-t pt-4 space-y-6">
          {report.files.map((file, index) => {
            const highMatches = file.matchedSources.filter(
              (s) => s.similarity > threshold
            );

            return (
              <div key={index} className="border rounded-md p-4 bg-gray-50">
                <h3 className="text-lg font-semibold mb-2">
                  File: {file.fileName}
                </h3>

                {highMatches.length > 0 ? (
                  <ul className="space-y-3">
                    {highMatches.map((source, idx) => (
                      <li
                        key={idx}
                        className="border rounded-md p-3 bg-gray-50 text-sm"
                      >
                        <p>
                          <span className="text-gray-600">Source Type: </span>
                          <span>{source.sourceType}</span>
                        </p>

                        {source.sourceType === "external" &&
                          source.sourceId && (
                            <p className="text-gray-600 mb-2">
                              <span className="font-semibold text-gray-600">
                                Source URL:
                              </span>{" "}
                              <a
                                href={source.sourceId}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                              >
                                {source.sourceId}
                              </a>
                            </p>
                          )}

                        <p>
                          <span className="font-semibold text-gray-600">
                            Matched Text:
                          </span>{" "}
                          <span className="bg-yellow-200 text-gray-900 ml-2 px-1 rounded">
                            {source.matchedText}
                          </span>
                        </p>

                        <p className="mt-1 text-gray-700">
                          <span className="font-semibold">Similarity:</span>{" "}
                          {(source.similarity * 100).toFixed(2)}%
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-600 mt-2">
                    No matched sources found.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default PlagiarismReport;
