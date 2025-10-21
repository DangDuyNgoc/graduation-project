import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { ClockFading, LoaderCircle, Paperclip } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate, useParams } from "react-router-dom";

const CourseDetail = () => {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignment, setLoadingAssignment] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchCourse = async () => {
    setLoading(true);

    try {
      const { data } = await api.get(`/course/get-course/${id}`, {
        withCredentials: true,
      });

      if (data) {
        setCourse(data.course);
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error(
          error?.response?.data?.message ||
            "You have not enrolled in this course yet.",
          { id: "enroll_error" }
        );
        navigate("/dashboard");
      } else {
        console.error("Failed to fetch course details.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignments = async () => {
    setLoadingAssignment(true);
    try {
      const { data } = await api.get(
        `/assignment/get-assignment-by-course/${id}`,
        { withCredentials: true }
      );
      setAssignments(data.assignment);
    } catch (error) {
      console.log(error);
      toast.error("Failed to load assignments");
    } finally {
      setLoadingAssignment(false);
    }
  };

  useEffect(() => {
    fetchCourse();
    fetchAssignments();
  }, [id]);

  return (
    <DashboardLayout>
      {loading ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="size-8 animate-spin text-primary" />
        </div>
      ) : course ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <img
              src={course.thumbnail}
              alt={course.name}
              className="w-full h-64 object-cover"
            />
            <div className="p-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {course.name}
              </h1>
              <div className="flex flex-wrap items-center justify-between text-sm text-gray-600 mb-6">
                <span>Instructor: {course.teacherId?.name}</span>
                <span>Duration: {course.duration}</span>
                <span>Enrolled: {course.studentIds?.length}</span>
              </div>
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-300">
                Enroll Now
              </button>
            </div>
          </div>

          {/* Description Section */}
          <div className="mt-8 bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Course Description
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {course.description}
            </p>
          </div>

          {/* Details Grid */}
          <div className="mt-8 bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Course Materials
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {course.materials?.length > 0 ? (
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  {" "}
                  {course.materials.map((m) => (
                    <li
                      key={m._id}
                      onClick={() => window.open(m.s3_url, "_blank")}
                      className="cursor-pointer hover:bg-gray-100 px-3 py-2 rounded-md flex justify-between items-center"
                    >
                      <span>{m.title || "Unnamed material"}</span>
                    </li>
                  ))}{" "}
                </ul>
              ) : (
                <p>No materials yet.</p>
              )}
            </div>
          </div>

          {/* Assignment Section */}
          <div className="mt-8 bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Course Assignments
            </h2>
            {loadingAssignment ? (
              <div className="flex justify-center py-4">
                <LoaderCircle className="size-6 animate-spin text-primary" />
              </div>
            ) : assignments?.length > 0 ? (
              <ul className="space-y-4">
                {assignments.map((a) => (
                  <Link
                    to={`/assignment/${a._id}`}
                    key={a._id}
                    className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
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
                          Due: {new Date(a.dueDate).toLocaleDateString()}
                        </p>
                      </div>

                      <div>
                        {a?.materials?.length > 0 ? (
                          <ul className="text-sm text-blue-600">
                            {a.materials.map((m, i) => (
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
                      </div>
                    </div>
                  </Link>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500">No assignments yet.</p>
            )}
          </div>
        </div>
      ) : (
        <p>No data available.</p>
      )}
    </DashboardLayout>
  );
};

export default CourseDetail;
