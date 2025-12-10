import { deleteAllCourse, getTeacherCourses } from "@/api/courseApi";
import DeleteDialog from "@/components/Common/DeleteDialog";
import LoadingSpinner from "@/components/Common/LoadingSpinner";
import CourseDialog from "@/components/Courses/CourseDialog";
import DashboardLayout from "@/layout/Dashboard";
import { Settings, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function TeacherCoursePage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const navigate = useNavigate();

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTeacherCourses();
      setCourses(data.course || []);
    } catch (error) {
      console.error("Failed to fetch courses:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await deleteAllCourse();
      toast.success("All courses deleted successfully!");
      setDeleteOpen(false);
      await fetchCourses();
    } catch {
      toast.error("Failed to delete all courses!");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  return (
    <DashboardLayout>
      <CourseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={fetchCourses}
      />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Courses</h1>
          <p className="text-gray-600 text-sm">
            Manage and track your course progress.
          </p>
        </div>

        <div className="relative">
          <button
            onClick={() =>
              setOpenMenuId((prev) => (prev === "global" ? null : "global"))
            }
            className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer"
          >
            <Settings className="size-5" />
          </button>

          {openMenuId === "global" && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30 overflow-hidden">
              <button
                onClick={() => {
                  setOpenMenuId(null);
                  setDialogOpen(true);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Add course
              </button>

              <button
                onClick={() => {
                  setOpenMenuId(null);
                  setDeleteOpen(true);
                }}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                Delete all courses
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading..." className="py-20" />
      ) : courses.length === 0 ? (
        <p className="text-center text-gray-500 mt-10">No courses available.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const totalStudents = course.studentIds?.length || 0;
            return (
              <div
                key={course._id}
                onClick={() => navigate(`/teacher-assignment/${course._id}`)}
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all flex flex-col cursor-pointer"
              >
                <img
                  src={course.thumbnail?.url || "https://placehold.co/600x400"}
                  alt={course.name}
                  className="rounded-t-xl w-full h-40 object-cover"
                />
                <div className="p-4 flex-1 flex flex-col">
                  <h2 className="text-lg font-semibold text-gray-800 mb-1">
                    {course.name}
                  </h2>
                  <p className="text-sm text-gray-500 flex items-center">
                    <Users size={16} className="mr-1" /> {totalStudents}{" "}
                    Students
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DeleteDialog
        open={deleteOpen}
        setOpen={setDeleteOpen}
        onConfirm={handleDeleteAll}
        title="Delete all courses?"
        loading={deleting}
      />
    </DashboardLayout>
  );
}

export default TeacherCoursePage;
