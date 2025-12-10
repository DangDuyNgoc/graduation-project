import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { formatLateDuration } from "@/utils/timeFormatter";
import { LoaderCircle, Paperclip } from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";

const SubmissionsPage = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("dueDate");

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/submission/get-submission-by-student", {
        withCredentials: true,
      });
      if (data.success) {
        const submissionsArray = data.submissions || [];

        const filtered = submissionsArray.filter((s) =>
          ["Submitted", "Late Submitted"].includes(s.status)
        );
        setSubmissions(filtered);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const getStatusBadge = (status) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case "Submitted":
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case "Late Submitted":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const sortedSubmissions = useMemo(() => {
    return [...submissions].sort((a, b) => {
      if (sortBy === "dueDate") {
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      if (sortBy === "status") {
        const order = { "Late Submitted": 2, Submitted: 1 };
        return order[a.status] - order[b.status];
      }

      return 0;
    });
  }, [submissions, sortBy]);


  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">
          My Submissions
        </h1>
        <div className="mb-4 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            {sortedSubmissions.length} submission total
          </p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-500 cursor-pointer"
          >
            <option value="dueDate">Sort by Due Date</option>
            <option value="status">Sort by Status</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <LoaderCircle className="size-8 animate-spin text-primary" />
          </div>
        ) : sortedSubmissions.length > 0 ? (
          <div className="overflow-x-auto shadow-lg rounded-lg cursor-pointer">
            <table className="min-w-full bg-white border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted Files
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plagiarism Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Late Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedSubmissions.map((submission) => (
                  <tr
                    key={submission._id}
                    className="hover:bg-gray-50"
                    onClick={() => {
                      window.location.href = `/plagiarism-report/${submission._id}`;
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {submission.assignment.title || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(
                        submission.assignment?.dueDate
                      ).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(submission.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {submission?.materials?.length > 0 ? (
                        <ul className="text-sm text-blue-600">
                          {submission.materials.map((m, i) => (
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
                        <span className="text-gray-400 italic text-sm">
                          No materials
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {submission.plagiarismScore != null
                        ? `${submission.plagiarismScore * 100}%`
                        : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {submission.status === "Late Submitted"
                        ? formatLateDuration(submission.lateDuration)
                        : "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={getStatusBadge(submission.status)}>
                        {submission.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No Submissions found.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubmissionsPage;
