import { Button } from "@/components/ui/button";
import { useAuth } from "@/hook/useAuth";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { LoaderCircle } from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import toast from "react-hot-toast";
import { FileLock2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatLateDuration } from "@/utils/timeFormatter";

const AssignmentPage = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState("dueDate");

  useAuth();

  const navigate = useNavigate();

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        "/assignment/get-assignments-for-student",
        {
          withCredentials: true,
        }
      );
      setAssignments(data.assignments);
    } catch (error) {
      console.log(error);
      toast.error(
        error?.response?.data?.message || "Failed to fetch assignments",
        { id: "enroll_error" }
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const getStatusBadge = (status) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case "Not Submit":
        return `${baseClasses} bg-red-100 text-red-800`;
      case "Submitted":
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case "Late Submitted":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const sortedAssignments = useMemo(() => {
    return [...assignments].sort((a, b) => {
      if (sortBy === "dueDate") {
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      if (sortBy === "status") {
        const order = { "Not Submit": 1, "Late Submitted": 2, Submitted: 3 };
        return order[a.status] - order[b.status];
      }

      return 0;
    });
  }, [assignments, sortBy]);

  return (
    <DashboardLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          Course Assignments
        </h1>

        <div className="mb-4 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            {sortedAssignments.length} assignments total
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
        ) : sortedAssignments.length > 0 ? (
          <div className="overflow-x-auto shadow-lg rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Course
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Teacher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Late Submission
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {sortedAssignments.map((a) => {
                  const finalDeadline = new Date(
                    new Date(a.dueDate).getTime() +
                      (a.allowLateSubmission && a.lateSubmissionDuration
                        ? a.lateSubmissionDuration * 60000
                        : 0)
                  );

                  const formattedDue = new Date(a.dueDate).toLocaleDateString();
                  const formattedFinalDeadline =
                    finalDeadline.toLocaleDateString();

                  return (
                    <tr key={a.assignmentId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {a.title}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {a.courseName || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {a.teacherName || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formattedDue}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {a.allowLateSubmission ? (
                          a.isOverdue ? (
                            <span className="text-gray-400 italic">
                              Closed (
                              {formatLateDuration(a.lateSubmissionDuration)}{" "}
                              allowed)
                            </span>
                          ) : (
                            <span className="text-green-600 font-medium">
                              Allowed (
                              {formatLateDuration(a.lateSubmissionDuration)})
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400 italic">
                            Not allowed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={getStatusBadge(a.status)}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {a.isOverdue ? (
                          <div
                            className="text-gray-400 italic text-sm cursor-not-allowed flex items-center gap-1"
                            title={`Deadline passed on ${formattedFinalDeadline}`}
                          >
                            <FileLock2 size="16" /> Locked
                          </div>
                        ) : (
                          <Button
                            onClick={() =>
                              navigate(`/assignment/${a.assignmentId}`)
                            }
                            size="sm"
                          >
                            {a.status === "Not Submit"
                              ? "Go to assignment"
                              : "Update Submission"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No assignments found.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AssignmentPage;
