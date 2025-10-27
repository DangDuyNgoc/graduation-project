import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import api from "@/utils/axiosInstance";
import { FileUp, Image as ImageIcon, LoaderCircle, Plus } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

export default function CourseDialog({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
  });
  const [materials, setMaterials] = useState([]);
  const [thumbnail, setThumbnail] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setMaterials(Array.from(e.target.files));
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
      const { data } = await api.post("/course/create-course", formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data.success) {
        toast.success("Course created successfully!");
        onCreated && onCreated();
        setOpen(false);
        setForm({ name: "", description: "" });
        setMaterials([]);
        setThumbnail(null);
        setPreview(null);
      } else {
        toast.error(data.message || "Failed to create course.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Error creating course!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="size-4" /> Add Course
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Course</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Course Name */}
          <div className="space-y-1">
            <label
              htmlFor="name"
              className="text-sm font-medium text-gray-700 mb-1 block"
            >
              Course Name
            </label>
            <Input
              id="name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter course name"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label
              htmlFor="description"
              className="text-sm font-medium text-gray-700 mb-1 block"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Enter course description"
              rows={4}
              className="border border-gray-300 rounded-md p-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Thumbnail Upload */}
          <div className="space-y-1">
            <label
              htmlFor="thumbnail"
              className="text-sm font-medium text-gray-700 mb-1 block"
            >
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
                  className="w-16 h-16 rounded object-cover border"
                />
              )}
            </div>
          </div>

          {/* Materials Upload */}
          <div className="space-y-1">
            <label
              htmlFor="materials"
              className="text-sm font-medium text-gray-700 mb-1 block"
            >
              Materials
            </label>
            <div className="flex items-center gap-4">
              <label
                htmlFor="materials"
                className="flex items-center gap-2 cursor-pointer bg-gray-100 hover:bg-gray-200 border px-3 py-2 rounded-md text-sm"
              >
                <FileUp className="size-4" /> Upload Files
              </label>
              <input
                id="materials"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <span className="text-sm text-gray-500">
                {materials.length > 0
                  ? `${materials.length} file(s) selected`
                  : "No files chosen"}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2 text-right">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle className="animate-spin size-4 mr-2" />
                  Creating...
                </>
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
