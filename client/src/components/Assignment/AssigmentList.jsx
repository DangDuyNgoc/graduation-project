import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, FileText, LoaderCircle } from "lucide-react";
import api from "@/utils/axiosInstance";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

export default function AssignmentList({ courseId }) {
  const [assignments, setAssignments] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchAssignments = async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const { data } = await api.get(
        `/assignment/get-assignment-by-course/${courseId}`,
        {
          withCredentials: true,
        }
      );
      if (data.success) {
        setAssignments(data.assignment || []);
      } else {
        toast.error(data.message || "Failed to fetch assignments");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error fetching assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [courseId]);

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <LoaderCircle className="size-6 animate-spin text-primary" />
      </div>
    );

  if (!assignments.length)
    return (
      <p className="text-gray-500 text-sm mt-4">No assignments available.</p>
    );

  return (
    <div className="space-y-4 mt-6">
      <h2 className="text-xl font-semibold text-gray-800">Assignments</h2>
      {assignments.map((item) => {
        const isOpen = expanded === item._id;
        return (
          <div
            key={item._id}
            className="border rounded-lg bg-white shadow-sm transition-all"
          >
            <div
              onClick={() => setExpanded(isOpen ? null : item._id)}
              className="flex justify-between items-center p-4 cursor-pointer hover:bg-gray-50"
            >
              <h3 className="font-medium text-gray-900">{item.title}</h3>
              {isOpen ? (
                <ChevronUp className="size-4 text-gray-600" />
              ) : (
                <ChevronDown className="size-4 text-gray-600" />
              )}
            </div>

            {isOpen && (
              <div className="p-4 border-t space-y-3">
                {item.description && (
                  <p className="text-gray-700 text-sm">{item.description}</p>
                )}

                {/* Materials */}
                {item.materials?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-800">
                      Attachments:
                    </p>
                    {item.materials.map((file) => (
                      <a
                        key={file._id}
                        href={
                          file.fileType === "application/pdf"
                            ? file.s3_url
                            : `https://docs.google.com/gview?url=${encodeURIComponent(
                                file.s3_url
                              )}&embedded=true`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                      >
                        <FileText className="size-4" />
                        {file.title}
                      </a>
                    ))}
                  </div>
                )}

                {/* Due date */}
                {item.dueDate && (
                  <p className="text-xs text-gray-500">
                    Due: {new Date(item.dueDate).toLocaleDateString()}{" "}
                    {item.allowLateSubmission && (
                      <span className="text-yellow-600 ml-2">
                        (Late allowed: {item.lateSubmissionDuration} days)
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
