import ChatFrame from "@/components/Chat/ChatFrame";
import ChatView from "@/components/Chat/ChatView";
import SearchBar from "@/components/Common/SearchBar";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserContext } from "@/context/UserContext";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { LoaderCircle } from "lucide-react";
import React, { useState, useEffect, useContext } from "react";

function TeachersPage() {
  const { user } = useContext(UserContext);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredTeachers, setFilteredTeachers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [conversationId, setConversationId] = useState(null);

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

  const handleContact = async (teacher) => {
    if (!user) return null;
    try {
      const { data } = await api.post(
        "/conversation/create-or-get",
        {
          participants: [teacher._id, user._id],
        },
        { withCredentials: true }
      );
      setSelectedTeacher(teacher);
      setConversationId(data.conversation._id);
    } catch (error) {
      console.error("Error creating or getting conversation:", error);
    }
  };

  return (
    <DashboardLayout>
      {loading ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="min-h-screen p-4">
          {/* search */}
          <SearchBar
            placeholder="Search teachers by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

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
                          src={
                            teacher?.avatar?.url ||
                            "https://res.cloudinary.com/dsfdghxx4/image/upload/v1730813754/nrxsg8sd9iy10bbsoenn_bzlq2c.png"
                          }
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
                  <Button
                    className="w-full"
                    onClick={() => handleContact(teacher)}
                  >
                    Contact
                  </Button>

                  {selectedTeacher && (
                    <ChatView
                      conversationId={conversationId}
                      isOpen={true}
                      teacher={selectedTeacher}
                      onClose={() => {
                        setSelectedTeacher(null);
                        setConversationId(null);
                      }}
                      isOpenChatView={false}
                    />
                  )}
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
