import { deleteAssignment, getAssignmentByCourseId } from "@/api/assignmentApi";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  LoaderCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import DeleteDialog from "../Common/DeleteDialog";
import AssignmentDialog from "./AssignmentDialog";
import { useNavigate } from "react-router-dom";

export default function AssignmentList({ courseId }) {
  const [assignments, setAssignments] = useState([]);
  const [expanded, setExpanded] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [openDelete, setOpenDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const navigate = useNavigate();

  const fetchAssignments = async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const data = await getAssignmentByCourseId(courseId);
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

  const toggleExpand = (id) => {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id) return;
    try {
      setLoadingDelete(true);
      const res = await deleteAssignment(deleteTarget._id);
      if (res.success) {
        toast.success("Assignment deleted successfully!");
        fetchAssignments();
      } else {
        toast.error(res.message || "Failed to delete assignment");
      }
    } catch (err) {
      toast.error("Error deleting assignment");
    } finally {
      setLoadingDelete(false);
      setOpenDelete(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-10">
        <LoaderCircle className="size-6 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-4 mt-10">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-800">Assignments</h2>
        <button
          onClick={() => {
            setSelectedAssignment(null);
            setOpenDialog(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700 transition"
        >
          Create assignment
        </button>
      </div>

      {assignments.length === 0 ? (
        <p className="text-gray-500 text-sm mt-2 italic">
          No assignments available.
        </p>
      ) : (
        <div className="divide-y divide-gray-200 border-t border-gray-200">
          {assignments.map((item) => {
            const isOpen = expanded.includes(item._id);
            return (
              <div key={item._id} className="transition-all">
                <div className="flex justify-between items-center py-4 px-2 hover:bg-gray-50">
                  <h3
                    onClick={() => navigate(`/teacher-submissions/${item._id}`)}
                    className="font-medium text-gray-900 cursor-pointer hover:text-blue-400"
                  >
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAssignment(item);
                        setOpenDialog(true);
                      }}
                      className="p-1 hover:bg-gray-100 rounded-md"
                    >
                      <Pencil className="size-4 text-gray-600 cursor-pointer" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(item);
                        setOpenDelete(true);
                      }}
                      className="p-1 hover:bg-red-100 rounded-md"
                    >
                      <Trash2 className="size-4 text-red-500 cursor-pointer" />
                    </button>

                    <span onClick={() => toggleExpand(item._id)}>
                      {isOpen ? (
                        <ChevronUp className="size-4 text-gray-600 cursor-pointer" />
                      ) : (
                        <ChevronDown className="size-4 text-gray-600 cursor-pointer" />
                      )}
                    </span>
                  </div>
                </div>

                {isOpen && (
                  <div className="pb-4 ps-3 space-y-3">
                    {item.description && (
                      <p className="text-gray-700 text-sm">
                        {item.description}
                      </p>
                    )}

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

                    {item.dueDate && (
                      <p className="text-xs text-gray-500">
                        Due:{" "}
                        {new Date(item.dueDate).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                        {item.allowLateSubmission && (
                          <span className="text-yellow-600 ml-2">
                            (Late allowed)
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
      )}

      {openDialog && (
        <AssignmentDialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          courseId={courseId}
          initialData={selectedAssignment}
          onSuccess={fetchAssignments}
        />
      )}

      <DeleteDialog
        open={openDelete}
        setOpen={setOpenDelete}
        title={`Delete assignment "${deleteTarget?.title}"?`}
        loading={loadingDelete}
        onConfirm={handleDelete}
      />
    </div>
  );
}
