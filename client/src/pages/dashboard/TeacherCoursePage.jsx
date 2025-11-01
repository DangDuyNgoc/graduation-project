import { deleteCourse, getTeacherCourses } from "@/api/courseApi";
import DeleteDialog from "@/components/Common/DeleteDialog";
import LoadingSpinner from "@/components/Common/LoadingSpinner";
import CourseDialog from "@/components/Courses/CourseDialog";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/layout/Dashboard";
import { Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function TeacherCoursePage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const navigate = useNavigate();

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTeacherCourses();
      setCourses(data.course || []);
    } catch (error) {
      console.error("Failed to fetch courses:", error);
      toast.error("Failed to load courses!");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDelete = async () => {
    if (!selectedCourse) return;
    setDeleting(true);
    try {
      await deleteCourse(selectedCourse._id);
      toast.success("Course deleted successfully!");
      setDeleteOpen(false);
      await fetchCourses();
    } catch {
      toast.error("Failed to delete course!");
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
        onUpdated={fetchCourses}
        course={selectedCourse}
      />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Courses</h1>
          <p className="text-gray-600 text-sm">
            Manage and track your course progress.
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedCourse(null);
            setDialogOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Add Course
        </Button>
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
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all flex flex-col"
              >
                <img
                  src={course.thumbnail?.url || "https://placehold.co/600x400"}
                  alt={course.name}
                  className="rounded-t-xl w-full h-40 object-cover cursor-pointer"
                  onClick={() => navigate(`/teacher-assignment/${course._id}`)}
                />
                <div className="p-4 flex-1 flex flex-col">
                  <h2
                    className="text-lg font-semibold text-gray-800 mb-1 cursor-pointer"
                    onClick={() =>
                      navigate(`/teacher-assignment/${course._id}`)
                    }
                  >
                    {course.name}
                  </h2>

                  <p className="text-sm text-gray-500 flex items-center mb-3">
                    <Users size={16} className="mr-1" /> {totalStudents}{" "}
                    Students
                  </p>

                  <div className="mt-auto flex justify-between">
                    <Button
                      variant="link"
                      className="p-0 text-blue-600 hover:text-blue-800"
                      onClick={() => {
                        setSelectedCourse(course);
                        setDialogOpen(true);
                      }}
                    >
                      Update course
                    </Button>

                    <Button
                      variant="link"
                      className="p-0 text-red-600 hover:text-red-800"
                      onClick={() => {
                        setSelectedCourse(course);
                        setDeleteOpen(true);
                      }}
                    >
                      Delete course
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DeleteDialog
        open={deleteOpen}
        setOpen={setDeleteOpen}
        onConfirm={handleDelete}
        title={`Delete course "${selectedCourse?.name}"?`}
        loading={deleting}
      />
    </DashboardLayout>
  );
}

export default TeacherCoursePage;
