import {
  deleteAllCourseMaterials,
  deleteCourse,
  deleteMaterialCourse,
  getOneCourse,
} from "@/api/courseApi";
import AssignmentList from "@/components/Assignment/AssigmentList";
import DeleteDialog from "@/components/Common/DeleteDialog";
import LoadingSpinner from "@/components/Common/LoadingSpinner";
import CourseDialog from "@/components/Courses/CourseDialog";
import DashboardLayout from "@/layout/Dashboard";
import { Settings, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

export default function TeacherAssignmentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openMenu, setOpenMenu] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const menuRef = useRef(null);
  const [openDelete, setOpenDelete] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [deleteType, setDeleteType] = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);

  const fetchCourseDetail = async () => {
    setLoading(true);
    try {
      const data = await getOneCourse(id);
      if (data.success) setCourse(data.result);
    } catch (error) {
      setCourse(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = async () => {
    try {
      setLoadingDelete(true);
      const res = await deleteCourse(id);
      toast.success(res?.message || "Course deleted successfully!");
      navigate("/teacher-courses");
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete course");
    } finally {
      setLoadingDelete(false);
      setOpenDelete(false);
    }
  };

  const handleDeleteCourseAllMaterials = async () => {
    try {
      setLoadingDelete(true);
      const res = await deleteAllCourseMaterials(id);
      toast.success(res?.message || "All materials deleted successfully!");
      fetchCourseDetail();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete materials");
    } finally {
      setLoadingDelete(false);
      setOpenDelete(false);
    }
  };

  const handleDeleteOneMaterial = async () => {
    if (!selectedMaterial) return;
    try {
      setLoadingDelete(true);
      const res = await deleteMaterialCourse(
        id,
        selectedMaterial.s3_key,
        selectedMaterial._id
      );
      toast.success(res?.message || "Material deleted successfully!");
      fetchCourseDetail();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete material");
    } finally {
      setLoadingDelete(false);
      setSelectedMaterial(null);
      setOpenDelete(false);
    }
  };

  useEffect(() => {
    fetchCourseDetail();
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <DashboardLayout>
      {loading ? (
        <LoadingSpinner text="Loading..." className="py-20" />
      ) : !course ? (
        <div className="text-center text-gray-500 mt-10">Course not found.</div>
      ) : (
        <>
          <CourseDialog
            course={course}
            onUpdated={fetchCourseDetail}
            open={openDialog}
            onOpenChange={setOpenDialog}
          />

          <div className="bg-blue-50 p-5 rounded-2xl max-w-6xl mx-auto mt-10 flex flex-col md:flex-row items-center justify-between shadow-sm">
            <div className="flex-1 space-y-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {course.name}
              </h1>
              <p className="text-gray-700 text-xs leading-relaxed">
                {course.description}
              </p>
              <p
                onClick={() =>
                  navigate(`/teacher-enrolled-student/${course._id}`)
                }
                className="text-sm text-gray-500 flex items-center mb-3 cursor-pointer"
              >
                <Users size={16} className="mr-1" />{" "}
                {course.studentIds?.length || 0} Students
              </p>

              <div className="flex items-center gap-3 mt-6">
                <img
                  src={
                    course.teacherId?.avatar?.url ||
                    "https://placehold.co/60x60"
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

            <div className="flex-shrink-0">
              <img
                src={course.thumbnail?.url || "https://placehold.co/400x250"}
                alt={course.name}
                className="w-full md:w-[420px] h-56 object-cover rounded-xl shadow-md"
              />
            </div>
          </div>

          <div className="max-w-6xl mx-auto mt-12">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Course Resources
              </h2>

              <div ref={menuRef} className="relative">
                <button
                  onClick={() => setOpenMenu((prev) => !prev)}
                  className="p-2 rounded-full hover:bg-gray-100 transition"
                >
                  <Settings className="size-6 text-gray-700" />
                </button>

                {openMenu && (
                  <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    <button
                      onClick={() =>
                        navigate(`/teacher-enrolled-student/${course._id}`)
                      }
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Manage students
                    </button>

                    <button
                      onClick={() => {
                        setOpenMenu(false);
                        setOpenDialog(true);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Update
                    </button>

                    <button
                      onClick={() => {
                        setOpenMenu(false);
                        setDeleteType("course");
                        setOpenDelete(true);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      Delete course
                    </button>

                    {course.materials?.length > 0 && (
                      <button
                        onClick={() => {
                          setOpenMenu(false);
                          setDeleteType("materials");
                          setOpenDelete(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Delete all resources
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {course.materials?.length ? (
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
                    <button
                      className="text-xs text-red-500 hover:underline cursor-pointer"
                      onClick={() => {
                        setSelectedMaterial(file);
                        setDeleteType("one");
                        setOpenDelete(true);
                      }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 italic">No resources uploaded yet.</p>
            )}
          </div>

          <AssignmentList
            courseId={course._id}
            studentInCourse={course.studentIds?.length}
          />

          <DeleteDialog
            open={openDelete}
            setOpen={setOpenDelete}
            title={
              deleteType === "materials"
                ? `Delete all materials of "${course?.name}"?`
                : deleteType === "one"
                ? `Delete material "${selectedMaterial?.title}"?`
                : `Delete course "${course?.name}"?`
            }
            loading={loadingDelete}
            onConfirm={
              deleteType === "materials"
                ? handleDeleteCourseAllMaterials
                : deleteType === "one"
                ? handleDeleteOneMaterial
                : handleDeleteCourse
            }
          />
        </>
      )}
    </DashboardLayout>
  );
}
