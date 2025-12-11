import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Image as ImageIcon, LoaderCircle } from "lucide-react";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import FileUploadZone from "../Common/FileUploadZone";
import { createCourse, updateCourse } from "@/api/courseApi";

export default function CourseDialog({
  onCreated,
  onUpdated,
  course = null,
  open,
  onOpenChange,
}) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [materials, setMaterials] = useState([]);
  const [thumbnail, setThumbnail] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (course) {
      setForm({
        name: course.name || "",
        description: course.description || "",
      });
      setPreview(course.thumbnail?.url || null);
      setMaterials(
        course.materials?.map((m) => ({
          name: m.title,
          url: m.url,
          existing: true,
        })) || []
      );
    } else {
      setForm({ name: "", description: "" });
      setPreview(null);
      setMaterials([]);
    }
  }, [course, open]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    setThumbnail(file);
    if (file) setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Course name is required!");

    const formData = new FormData();
    formData.append("name", form.name);
    formData.append("description", form.description);
    materials.forEach((file) => formData.append("materials", file));
    if (thumbnail) formData.append("thumbnail", thumbnail);

    try {
      setLoading(true);
      const data = course
        ? await updateCourse(course._id, formData)
        : await createCourse(formData);

      if (data.success) {
        toast.success(
          course
            ? "Course updated successfully!"
            : "Course created successfully!"
        );
        if (course) onUpdated && onUpdated();
        else onCreated && onCreated();
        onOpenChange?.(false);
      } else {
        toast.error(data.message || "Operation failed!");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error processing request!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-full max-w-[500px] max-h-[100vh] overflow-y-auto overflow-x-hidden rounded-xl">
        <DialogHeader>
          <DialogTitle>
            {course ? "Update Course" : "Create New Course"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Course Name
            </label>
            <Input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter course name"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Description
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Enter course description"
              rows={4}
              className="border border-gray-300 rounded-md p-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Thumbnail
            </label>
            <div className="flex items-center gap-4">
              <label
                htmlFor="thumbnail"
                className="flex items-center gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm"
              >
                <ImageIcon className="size-4" /> Choose Image
              </label>
              <input
                id="thumbnail"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleThumbnailChange}
              />
              {preview && (
                <img
                  src={preview}
                  alt="Thumbnail Preview"
                  className="w-10 h-10 rounded object-cover border"
                />
              )}
            </div>
          </div>

          <FileUploadZone
            onFilesChange={setMaterials}
            initialFiles={materials}
          />

          <div className="pt-2 text-right">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle className="animate-spin size-4 mr-2" />
                  {course ? "Updating..." : "Creating..."}
                </>
              ) : course ? (
                "Update Course"
              ) : (
                "Create Course"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
