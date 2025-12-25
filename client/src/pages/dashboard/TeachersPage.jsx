import ChatView from "@/components/Chat/ChatView";
import SearchBar from "@/components/Common/SearchBar";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserContext } from "@/context/UserContext";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { LoaderCircle, Mail, MessageCircle, Phone } from "lucide-react";
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
    if (!user) return;
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
      setConversationId(null);
      const { data } = await api.post(
        "/conversation/create-or-get",
        {
          participants: [teacher._id, user._id],
          createConversation: true,
        },
        { withCredentials: true }
      );
      if (!data.conversation) {
        setConversationId(null);
        return;
      }

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
                  className="
                    bg-white rounded-2xl border shadow-sm
                    hover:shadow-lg transition-all duration-300
                    flex flex-col
                  "
                >
                  {/* Header */}
                  <div className="flex items-center justify-between m-4">
                    <div>
                      <h2 className="text-2xl font-semibold text-gray-800">
                        {teacher.name}
                      </h2>
                    </div>
                    <div className="cursor-pointer rounded-full border-2 border-dashed border-gray-300 transition">
                      <Avatar className="w-20 h-20 border">
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

                  <div className="px-5 pb-4 space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Mail size={16} className="text-gray-400" />
                      <span className="truncate">{teacher.email}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-gray-400" />
                      <span>{teacher.phone || "No phone number"}</span>
                    </div>
                  </div>

                  <div className="px-5 pb-5 mt-auto">
                    <Button
                      onClick={() => handleContact(teacher)}
                      className="
                          w-full rounded-xl
                          bg-gradient-to-r from-purple-500 to-indigo-500
                          hover:from-purple-600 hover:to-indigo-600
                          text-white
                          flex items-center justify-center gap-2
                          transition-all duration-300
                        "
                    >
                      <MessageCircle size={18} />
                      Chat with Teacher
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 col-span-full">
                No teachers found.
              </p>
            )}
          </div>
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
      )}
    </DashboardLayout>
  );
}

export default TeachersPage;
