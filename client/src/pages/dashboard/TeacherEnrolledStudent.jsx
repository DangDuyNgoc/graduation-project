import {
  deleteStudentTeacherCourses,
  getStudentTeacherCourses,
} from "@/api/courseApi";
import DeleteDialog from "@/components/Common/DeleteDialog";
import LoadingSpinner from "@/components/Common/LoadingSpinner";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/layout/Dashboard";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useParams, useNavigate } from "react-router-dom";
export default function TeacherEnrolledStudent() {
  const { id } = useParams();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const navigate = useNavigate();

  const handleDeleteStudent = async () => {
    if (!selectedStudent) return;
    try {
      setLoadingDelete(true);
      const res = await deleteStudentTeacherCourses(id, selectedStudent._id);
      toast.success(res?.message || "Student deleted successfully!");
      setStudents((prev) => prev.filter((s) => s._id !== selectedStudent._id));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete student");
    } finally {
      setLoadingDelete(false);
      setOpenDelete(false);
      setSelectedStudent(null);
    }
  };

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const res = await getStudentTeacherCourses(id);
        if (res.success) {
          setStudents(res.students || []);
        }
      } catch (err) {
        console.error("Error fetching students:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [id]);

  return (
    <DashboardLayout>
      <div className="p-4">
        <Button onClick={() => navigate(-1)}>Go Back</Button>
        <div className="flex justify-between items-center mt-4">
          <h2 className="text-lg font-semibold">Enrolled Students</h2>
          <Button onClick={() => navigate(`/teacher-enroll-student/${id}`)}>
            Enroll student
          </Button>
        </div>

        {loading && <LoadingSpinner text="Loading..." className="py-20" />}

        {!loading && students.length === 0 && (
          <p className="text-gray-500 mt-4">
            No students enrolled in this course.
          </p>
        )}

        {!loading && students.length > 0 && (
          <table className="w-full border border-gray-300 text-sm mt-3">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-3 py-2 text-left w-16">
                  No.
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left">
                  Avatar
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left">
                  Name
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left">
                  Email
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left">
                  Phone
                </th>
                <th className="border border-gray-300 px-3 py-2 text-left">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, index) => (
                <tr key={student._id} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-3 py-2">
                    {index + 1}
                  </td>
                  <td className="border border-gray-300 px-3 py-2">
                    <img
                      src={
                        student.avatar?.url ||
                        "https://res.cloudinary.com/dsfdghxx4/image/upload/v1730813754/nrxsg8sd9iy10bbsoenn_bzlq2c.png"
                      }
                      alt={student.name}
                      className="w-10 h-10 object-cover rounded-full border"
                    />
                  </td>
                  <td className="border border-gray-300 px-3 py-2">
                    {student.name}
                  </td>
                  <td className="border border-gray-300 px-3 py-2">
                    {student.email}
                  </td>
                  <td className="border border-gray-300 px-3 py-2">
                    {student.phone || "—"}
                  </td>
                  <td className="border border-gray-300 px-3 py-2">
                    <button
                      onClick={() => {
                        setSelectedStudent(student);
                        setOpenDelete(true);
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        
      </div>

      <DeleteDialog
        open={openDelete}
        setOpen={setOpenDelete}
        title={`Delete student "${selectedStudent?.name}"?`}
        loading={loadingDelete}
        onConfirm={handleDeleteStudent}
      />
    </DashboardLayout>
  );
}
