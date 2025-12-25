import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { formatLateDuration } from "@/utils/timeFormatter";
import { LoaderCircle, Paperclip } from "lucide-react";
import React, { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";

const CourseDetail = () => {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingAssignment, setLoadingAssignment] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadingAssignment(true);

    try {
      const [courseRes, assignmentRes] = await Promise.all([
        api.get(`/course/get-course/${id}`, { withCredentials: true }),
        api.get(`/assignment/get-assignment-by-course/${id}`, {
          withCredentials: true,
        }),
      ]);

      if (courseRes.data.success) {
        setCourse(courseRes.data.result);
      }

      setAssignments(assignmentRes.data.assignment || []);
    } catch (error) {
      console.error("Failed to fetch data.", error);
    } finally {
      setLoading(false);
      setLoadingAssignment(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DashboardLayout>
      {loading ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="size-8 animate-spin text-primary" />
        </div>
      ) : !course ? (
        <p>No data available.</p>
      ) : (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Thumbnail */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <img
              src={course.thumbnail?.url}
              alt={course.name}
              loading="lazy"
              className="w-full h-64 object-cover"
            />

            <div className="p-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {course.name}
              </h1>

              <div className="flex flex-wrap items-center justify-between text-sm text-gray-600 mb-6">
                <span>Instructor: {course.teacherId?.name}</span>
                {/* <span>Duration: {course.duration}</span> */}
                <span>Enrolled: {course.studentIds?.length}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mt-8 bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Course Description
            </h2>
            <p className="text-gray-700 leading-relaxed">{course.description}</p>
          </div>

          {/* Materials */}
          <div className="mt-8 bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Course Materials
            </h2>

            {course.materials?.length ? (
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                {course.materials.map((m) => (
                  <li
                    key={m._id}
                    onClick={() => window.open(m.s3_url, "_blank")}
                    className="cursor-pointer hover:bg-gray-100 px-3 py-2 rounded-md flex justify-between items-center"
                  >
                    <span>{m.title || "Unnamed material"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No materials yet.</p>
            )}
          </div>

          {/* Assignments */}
          <div className="mt-8 bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Course Assignments
            </h2>

            {loadingAssignment ? (
              <div className="flex justify-center py-4">
                <LoaderCircle className="size-6 animate-spin text-primary" />
              </div>
            ) : assignments.length ? (
              <ul className="space-y-4">
                {assignments.map((a) => {
                  const dueDate = new Date(a.dueDate);

                  const deadline = a.allowLateSubmission
                    ? new Date(dueDate.getTime() + a.lateSubmissionDuration * 60000)
                    : dueDate;

                  const now = Date.now();
                  const isExpired = now > deadline.getTime();

                  const expiredCss = isExpired
                    ? "pointer-events-none opacity-70 bg-gray-100 cursor-not-allowed"
                    : "hover:bg-gray-50";

                  return (
                    <Link
                      to={isExpired ? "#" : `/assignment/${a._id}`}
                      key={a._id}
                      className={`block border border-gray-200 rounded-lg p-4 transition ${expiredCss}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">
                            {a.title}
                          </h3>

                          <p className="text-sm text-gray-600 mt-1">
                            {a.description || "No description provided."}
                          </p>

                          <p className="text-sm text-gray-500 mt-2">
                            Due: {dueDate.toLocaleDateString()}
                          </p>

                          {a.allowLateSubmission && (
                            <p className="text-gray-500 italic">
                              Allow late submission:
                              {" " + formatLateDuration(a.lateSubmissionDuration)}
                              {" — until "}
                              {deadline.toLocaleString()}
                            </p>
                          )}

                          {isExpired ? (
                            <span className="ml-1 px-2 py-1 rounded bg-red-100 text-red-600 text-xs font-medium">
                              Closed
                            </span>
                          ) : (
                            <span className="ml-1 px-2 py-1 rounded bg-green-100 text-green-600 text-xs font-medium">
                              Open
                            </span>
                          )}
                        </div>

                        <div>
                          {a.materials?.length ? (
                            <ul className="text-sm text-blue-600">
                              {a.materials.map((m, i) => (
                                <li key={i}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(m.s3_url, "_blank");
                                    }}
                                    className="hover:underline flex items-center"
                                  >
                                    <Paperclip size={16} className="mr-1" />
                                    {m.title || "Download file"}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-gray-400 italic text-sm">
                              No materials
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </ul>
            ) : (
              <p>No assignments yet.</p>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default CourseDetail;
