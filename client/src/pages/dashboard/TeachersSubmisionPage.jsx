import { getSubmisionApibyAssignmentId } from "@/api/submissionApi";
import LoadingSpinner from "@/components/Common/LoadingSpinner";
import DashboardLayout from "@/layout/Dashboard";
import { Eye, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

export default function TeachersSubmissionPage() {
  const { id } = useParams();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        setLoading(true);
        const res = await getSubmisionApibyAssignmentId(id);
        if (res.success) {
          setSubmissions(res.submissions);
        } else {
          toast.error(res.message || "Failed to load submissions list");
        }
      } catch (error) {
        toast.error("Error while fetching submissions");
        console.error("Fetch submissions error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [id]);

  return (
    <DashboardLayout>
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="size-5" /> Submissions List
        </h2>

        {loading ? (
          <LoadingSpinner text="Loading submissions..." className="py-20" />
        ) : submissions.length === 0 ? (
          <p className="text-gray-500">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl shadow-md">
            <table className="min-w-full border-collapse bg-white text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-3 border-b">#</th>
                  <th className="p-3 border-b">Student</th>
                  <th className="p-3 border-b">Email</th>
                  <th className="p-3 border-b">Assignment</th>
                  <th className="p-3 border-b">Status</th>
                  <th className="p-3 border-b">Late Submission</th>
                  <th className="p-3 border-b">Submitted At</th>
                  <th className="p-3 border-b text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub, index) => (
                  <tr
                    key={sub._id}
                    className="hover:bg-gray-50 transition-colors border-b"
                  >
                    <td className="p-3">{index + 1}</td>
                    <td className="p-3 flex items-center gap-2">
                      <img
                        src={sub.student?.avatar?.url}
                        alt="avatar"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <span>{sub.student?.name}</span>
                    </td>
                    <td className="p-3">{sub.student?.email}</td>
                    <td className="p-3">{sub.assignment?.title}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          sub.status === "Submitted"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </td>
                    <td className="p-3">
                      {sub.isLate ? (
                        <span className="text-red-600 font-semibold">Yes</span>
                      ) : (
                        <span className="text-green-600">No</span>
                      )}
                    </td>
                    <td className="p-3">
                      {new Date(sub.submittedAt).toLocaleString("en-US")}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() =>
                          navigate(`/teacher-submissions-student/${sub._id}`)
                        }
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="inline w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
