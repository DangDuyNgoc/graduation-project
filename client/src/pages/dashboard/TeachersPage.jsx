import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { LoaderCircle, Search } from "lucide-react";
import React, { useState, useEffect } from "react";

function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredTeachers, setFilteredTeachers] = useState([]);
  const [search, setSearch] = useState("");

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/user/get-all-teachers", {
        withCredentials: true,
      });
      if (data.success) {
        setTeachers(data.teacher);
        setFilteredTeachers(data.teacher);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    const lower = search.toLowerCase();
    const filtered = teachers.filter(
      (t) =>
        t.name?.toLowerCase().includes(lower) ||
        t.email?.toLowerCase().includes(lower)
    );

    setFilteredTeachers(filtered);
  }, [search, teachers]);

  return (
    <DashboardLayout>
      {loading ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="min-h-screen p-4">
          {/* search */}
          <div className="relative max-w-md mx-auto mb-8">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search teachers by name or email..."
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Teachers Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeachers.length > 0 ? (
              filteredTeachers.map((teacher) => (
                <div
                  key={teacher._id}
                  className="bg-white rounded-lg shadow-md overflow-hidden"
                >
                  <div className="flex items-center justify-between m-4">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-800">
                        {teacher.name}
                      </h2>
                    </div>
                    <div className="cursor-pointer rounded-full border-2 border-dashed border-gray-300 transition">
                      <Avatar className="w-20 h-20">
                        <AvatarImage
                          src={teacher?.avatar?.url}
                          alt="avatar image"
                        />
                      </Avatar>
                    </div>
                  </div>

                  {/* Teacher Details */}
                  <div className="p-4 bg-gray-100">
                    <p className="text-gray-500 mt-1">Email: {teacher.email}</p>
                    <p className="text-gray-500 mt-2">
                      Phone: {teacher.phone || "No phone number"}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 col-span-full">
                No teachers found.
              </p>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default TeachersPage;
