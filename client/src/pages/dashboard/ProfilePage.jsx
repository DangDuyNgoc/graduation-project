import AvatarPhoto from "@/components/AvatarPhoto";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { UserContext } from "@/context/UserContext";
import { useAuth } from "@/hook/useAuth";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";

import React, { useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";

const ProfilePage = () => {
  const { user, updateUser } = useContext(UserContext);
  useAuth();

  const [image, setImage] = useState(null);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  // handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // upload avatar
  const handleUploadAvatar = async () => {
    if (!image) {
      toast.error("Please select an image first!");
      return;
    }

    const form = new FormData();
    form.append("avatar", image);

    try {
      setLoading(true);
      const { data } = await api.post("/user/upload-avatar", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (data.success) {
        toast.success("Avatar updated successfully!", { id: "enroll_error" });
        updateUser(data.user);
        setImage(null);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (image) {
      handleUploadAvatar();
    }
  }, [image]);

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      setLoading(false);
      const { data } = await api.post("/user/update-user", formData);
      if (data.success) {
        toast.success("Updated User Successfully!");
        updateUser(data.user);
        setFormData((prev) => ({ ...prev, password: "" }));
        setOpenModal(false);
      } else {
        toast.error("Failed to update user");
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-gray-600">No user data available</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          {!user?.avatar?.url ? (
            <div className="flex justify-center mb-6">
              <AvatarPhoto
                image={image}
                setImage={setImage}
                onUpload={handleUploadAvatar}
              />
            </div>
          ) : (
            <div className="flex justify-center mb-4">
              <AvatarPhoto
                image={image}
                setImage={setImage}
                currentAvatar={user?.avatar?.url}
                loading={loading}
              />
            </div>
          )}

          <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">
            {user.name || "Unnamed User"}
          </h1>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Contact
            </h2>
            <p className="text-gray-500">Email: {user.email}</p>
            <p className="text-gray-500 mt-2">
              Phone: {user.phone || "No phone provided."}
            </p>
          </div>
          <div className="flex justify-center">
            <Button onClick={() => setOpenModal(true)}>Update Profile</Button>
          </div>

          {/* Modal */}
          <Dialog open={openModal} onOpenChange={setOpenModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Title</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label
                    className="text-sm font-medium text-gray-700 mb-2"
                    htmlFor="name"
                  >
                    Name
                  </label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div>
                  <label
                    className="text-sm font-medium text-gray-700 mb-2"
                    htmlFor="email"
                  >
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Your email"
                    required
                  />
                </div>

                <div>
                  <label
                    className="text-sm font-medium text-gray-700 mb-2"
                    htmlFor="phone"
                  >
                    Phone
                  </label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Your phone number"
                  />
                </div>

                <div>
                  <label
                    className="text-sm font-medium text-gray-700 mb-2"
                    htmlFor="password"
                  >
                    New Password (optional)
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Leave blank to keep current password"
                  />
                </div>

                <DialogFooter className="mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpenModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Updating..." : "Save changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
