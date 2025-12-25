import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import FileUploadZone from "../Common/FileUploadZone";
import { createAssignment, updateAssignment } from "@/api/assignmentApi";

export default function AssignmentDialog({
  open,
  onClose,
  courseId,
  initialData = null,
  onSuccess,
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [allowLateSubmission, setAllowLateSubmission] = useState(false);
  const [lateSubmissionDuration, setLateSubmissionDuration] = useState("");
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setDescription(initialData.description || "");
      setDueDate(initialData.dueDate ? initialData.dueDate.slice(0, 16) : "");
      setAllowLateSubmission(!!initialData.allowLateSubmission);
      setLateSubmissionDuration(
        initialData.lateSubmissionDuration?.toString() || ""
      );
      setMaterials(initialData.materials || []);
    } else {
      setTitle("");
      setDescription("");
      setDueDate("");
      setAllowLateSubmission(false);
      setLateSubmissionDuration("");
      setMaterials([]);
    }
  }, [initialData, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !dueDate) {
      toast.error("Please provide both title and due date");
      return;
    }

    if (allowLateSubmission && !lateSubmissionDuration) {
      toast.error("Please enter late submission duration");
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append("courseId", courseId);
      formData.append("title", title);
      formData.append("description", description);
      const local = new Date(dueDate);
      const utc = new Date(local.getTime() - local.getTimezoneOffset() * 60000);
      formData.append("dueDate", utc.toISOString());
      formData.append(
        "allowLateSubmission",
        allowLateSubmission ? "true" : "false"
      );
      
      if (allowLateSubmission && lateSubmissionDuration) {
        formData.append("lateSubmissionDuration", lateSubmissionDuration);
      }

      const newFiles = materials.filter((f) => !f.url);
      newFiles.forEach((file) => {
        formData.append("materials", file);
      });

      let res;
      if (initialData?._id) {
        res = await updateAssignment(initialData._id, formData);
      } else {
        res = await createAssignment(formData);
      }

      if (res.success) {
        toast.success(
          initialData
            ? "Assignment updated successfully"
            : "Assignment created successfully"
        );
        onSuccess && onSuccess();
        onClose();
      } else {
        toast.error(res.message || "Something went wrong");
      }
    } catch (err) {
      toast.error("Error while saving assignment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Update Assignment" : "Create New Assignment"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter assignment title"
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter short description"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Due Date
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allowLate"
                checked={allowLateSubmission}
                onChange={(e) => {
                  setAllowLateSubmission(e.target.checked);
                  if (!e.target.checked) {
                    setLateSubmissionDuration("");
                  }
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label
                htmlFor="allowLate"
                className="cursor-pointer text-sm text-gray-700"
              >
                Allow late submission
              </label>
            </div>

            {allowLateSubmission && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  value={lateSubmissionDuration}
                  onChange={(e) => setLateSubmissionDuration(e.target.value)}
                  placeholder="Minutes"
                  className="w-20 h-5 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <span className="text-sm text-gray-600">minutes</span>
              </div>
            )}
          </div>

          <FileUploadZone
            onFilesChange={setMaterials}
            initialFiles={materials}
          />

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? initialData
                  ? "Updating..."
                  : "Creating..."
                : initialData
                ? "Update"
                : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
