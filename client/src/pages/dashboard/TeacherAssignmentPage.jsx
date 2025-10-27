import AssignmentList from "@/components/Assignment/AssigmentList";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function TeacherAssignmentPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCourseDetail = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/course/get-course/${id}`, {
        withCredentials: true,
      });
      setCourse(data.result);
    } catch (error) {
      console.error("Failed to fetch course detail:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoaderCircle className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="text-center text-gray-500 mt-10">Course not found.</div>
    );
  }

  return (
    <DashboardLayout>
      <div className="bg-blue-50 p-8 rounded-2xl max-w-6xl mx-auto mt-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
        {/* Left side */}
        <div className="flex-1 space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">{course.name}</h1>
          <p className="text-gray-700 leading-relaxed">{course.description}</p>

          {/* Lecturer Info */}
          <div className="flex items-center gap-3 mt-6">
            <img
              src={
                course.teacherId?.avatar?.url || "https://placehold.co/60x60"
              }
              alt={course.teacherId?.name}
              className="w-12 h-12 rounded-full object-cover border"
            />
            <div>
              <p className="text-sm text-gray-500">Lecturer</p>
              <p className="font-semibold text-gray-800">
                {course.teacherId?.name || "Unknown"}
              </p>
            </div>
          </div>
        </div>

        {/* Right side (thumbnail) */}
        <div className="flex-shrink-0">
          <img
            src={course.thumbnail?.url || "https://placehold.co/400x250"}
            alt={course.name}
            className="w-full md:w-[420px] h-56 object-cover rounded-xl shadow-md"
          />
        </div>
      </div>

      {/* Resource Section */}
      <div className="max-w-6xl mx-auto mt-12 p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Course Resources
        </h2>

        {course.materials && course.materials.length > 0 ? (
          <ul className="divide-y divide-gray-200">
            {course.materials.map((file) => (
              <li
                key={file._id}
                className="py-3 flex items-center justify-between hover:bg-gray-50 px-3 rounded-lg transition-colors"
              >
                <div>
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
                    {file.title}
                  </a>
                  <p className="text-sm text-gray-500">{file.fileType}</p>
                </div>

                <span className="text-xs text-gray-400">
                  {file.processingStatus === "done" ? "Ready" : "Processing"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 italic">No resources uploaded yet.</p>
        )}
      </div>
      <AssignmentList courseId={course._id} />
    </DashboardLayout>
  );
}
