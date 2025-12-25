import {
  deleteAllAssignmentByCourseId,
  deleteAllMaterialsAssignment,
  deleteAssignment,
  deleteOneAssignmentMaterial,
  getAssignmentByCourseId,
} from "@/api/assignmentApi";

import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  LoaderCircle,
  Pencil,
  Settings,
  Trash2,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import DeleteDialog from "../Common/DeleteDialog";
import AssignmentDialog from "./AssignmentDialog";

export default function AssignmentList({ courseId, studentInCourse }) {
  const [assignments, setAssignments] = useState([]);
  const [expanded, setExpanded] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const [openMenu, setOpenMenu] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState(null);
  const [openDelete, setOpenDelete] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);

  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  const navigate = useNavigate();

  const fetchAssignments = async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const data = await getAssignmentByCourseId(courseId);
      if (data.success) setAssignments(data.assignment);
    } catch {
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [courseId]);

  const toggleExpand = (id) => {
    setExpanded((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleDelete = async () => {
    setLoadingDelete(true);

    try {
      if (deleteType === "deleteAllAssignments") {
        const res = await deleteAllAssignmentByCourseId(courseId);
        if (res.success) {
          toast.success("Deleted all assignments!");
          setAssignments([]);
        } else toast.error(res.message || "Failed to delete all assignments");

        setLoadingDelete(false);
        setOpenDelete(false);
        return;
      }

      if (deleteType === "assignment") {
        const res = await deleteAssignment(deleteTarget._id);
        if (res.success) {
          toast.success("Assignment deleted!");
          setAssignments((prev) =>
            prev.filter((a) => a._id !== deleteTarget._id)
          );
        }
      } else if (deleteType === "oneMaterial") {
        const res = await deleteOneAssignmentMaterial(
          deleteTarget.assignmentId,
          deleteTarget.key
        );
        if (res.success) {
          toast.success("Material deleted!");
          setAssignments((prev) =>
            prev.map((a) =>
              a._id === deleteTarget.assignmentId
                ? {
                    ...a,
                    materials: a.materials.filter(
                      (m) => m.key !== deleteTarget.key
                    ),
                  }
                : a
            )
          );
        }
      } else if (deleteType === "allMaterials") {
        const res = await deleteAllMaterialsAssignment(deleteTarget._id);
        if (res.success) {
          toast.success("All materials deleted!");
          setAssignments((prev) =>
            prev.map((a) =>
              a._id === deleteTarget._id ? { ...a, materials: [] } : a
            )
          );
        }
      }
    } catch {
      toast.error("Error deleting");
    }

    setLoadingDelete(false);
    setOpenDelete(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpenMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
        <div className="relative">
          <button
            ref={buttonRef}
            onClick={() => setOpenMenu((p) => !p)}
            className="p-2 rounded-full hover:bg-gray-100 cursor-pointer"
          >
            <Settings className="size-6 text-gray-700" />
          </button>

          {openMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 mt-2 min-w-52 bg-white shadow-lg 
                            border border-gray-200 rounded-md z-20"
            >
              <button
                onClick={() => {
                  setSelectedAssignment(null);
                  setOpenDialog(true);
                  setOpenMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
              >
                Create assignment
              </button>

              {assignments.length > 0 && (
                <button
                  onClick={() => {
                    setDeleteType("deleteAllAssignments");
                    setOpenDelete(true);
                    setOpenMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-red-100 text-sm text-red-500"
                >
                  Delete all assignments
                </button>
              )}
            </div>
          )}
        </div>
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
              <div key={item._id}>
                <div className="flex justify-between items-center py-4 px-2 hover:bg-gray-50">
                  <h3
                    onClick={() => navigate(`/teacher-submissions/${item._id}`)}
                    className="flex items-center gap-2 font-medium text-gray-700 cursor-pointer hover:text-blue-400"
                  >
                    <ClipboardList className="size-6" />
                    {item.title}
                  </h3>

                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-600">
                      Submitted: {item.submittedCount}/{studentInCourse}
                    </div>
                    <button
                      onClick={() => {
                        setSelectedAssignment(item);
                        setOpenDialog(true);
                      }}
                      className="p-1 hover:bg-gray-100 rounded-md cursor-pointer"
                    >
                      <Pencil className="size-4 text-gray-600" />
                    </button>

                    <button
                      onClick={() => {
                        setDeleteTarget(item);
                        setDeleteType("assignment");
                        setOpenDelete(true);
                      }}
                      className="p-1 hover:bg-red-100 rounded-md cursor-pointer"
                    >
                      <Trash2 className="size-4 text-red-500" />
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
                        <div className="flex justify-between items-center text-sm font-medium text-gray-800">
                          <span>Attachments:</span>

                          <button
                            onClick={() => {
                              setDeleteTarget(item);
                              setDeleteType("allMaterials");
                              setOpenDelete(true);
                            }}
                            className="text-xs text-red-500 hover:underline cursor-pointer"
                          >
                            Delete all
                          </button>
                        </div>

                        {item.materials.map((file) => (
                          <div
                            key={file._id}
                            className="flex justify-between items-center"
                          >
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
                              className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                            >
                              <FileText className="size-4" />
                              {file.title}
                            </a>

                            <button
                              onClick={() => {
                                setDeleteTarget({
                                  ...file,
                                  assignmentId: item._id,
                                });
                                setDeleteType("oneMaterial");
                                setOpenDelete(true);
                              }}
                              className="text-xs text-red-500 hover:underline cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-sm">
                      Duration:{" "}
                      {new Date(item.dueDate).toLocaleString([], {
                        timeZone: "UTC",
                        dateStyle: "medium",
                        timeStyle: "medium",
                      })}
                    </div>
                    <div className="text-sm italic">
                      Allow late submission:{" "}
                      <span className="text-yellow-600">
                        {item.allowLateSubmission ? "True" : "False"} (
                        {item.lateSubmissionDuration}m)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AssignmentDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        courseId={courseId}
        initialData={selectedAssignment}
        onSuccess={fetchAssignments}
      />

      <DeleteDialog
        open={openDelete}
        setOpen={setOpenDelete}
        title={
          deleteType === "deleteAllAssignments"
            ? "Delete all assignments in this course?"
            : deleteType === "allMaterials"
            ? `Delete all materials of "${deleteTarget?.title}"?`
            : deleteType === "oneMaterial"
            ? `Delete material "${deleteTarget?.title}"?`
            : `Delete assignment "${deleteTarget?.title}"?`
        }
        loading={loadingDelete}
        onConfirm={handleDelete}
      />
    </div>
  );
}
