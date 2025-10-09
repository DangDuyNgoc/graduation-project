import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { ClockFading, LoaderCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

const CourseDetail = () => {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchCourse = async () => {
    setLoading(true);

    try {
      const { data } = await api.get(`/course/get-course/${id}`, {
        withCredentials: true,
      });

      console.log("data", data.enrolled);

      if (data.enrolled) {
        setCourse(data.course);
      }
    } catch (error) {
      if (error.response?.status === 403) {
        toast.error(
          error?.response?.message ||
            "You have not enrolled in this course yet.",
          { id: "enroll_error" }
        );
        navigate("/dashboard");
      } else {
        toast.error("Failed to fetch course details.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourse();
  }, [id]);

  return (
    <DashboardLayout>
      {loading ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="size-8 animate-spin text-primary" />
        </div>
      ) : course ? (
        <div className="p-4">
          <h1 className="text-2xl font-semibold mb-2">{course.name}</h1>
          <p className="text-gray-600 mb-4">{course.description}</p>
          <p className="text-sm text-gray-500">
            Instructor: {course.teacherId?.name}
          </p>

          <h2 className="text-xl font-semibold mt-6 mb-2">Materials:</h2>
          {course.materials?.length > 0 ? (
            <ul className="list-disc pl-6">
              {course.materials.map((m) => (
                <li key={m._id}>{m.title || "Unnamed material"}</li>
              ))}
            </ul>
          ) : (
            <p>No materials yet.</p>
          )}
        </div>
      ) : (
        <p>No data available.</p>
      )}
    </DashboardLayout>
  );
};

export default CourseDetail;
