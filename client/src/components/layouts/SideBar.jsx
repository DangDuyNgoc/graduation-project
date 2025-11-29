import React, { useContext, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Home,
  FileText,
  Upload,
  User,
  Users,
  GraduationCap,
  MessageCircleMore,
  Bot,
} from "lucide-react";
import api from "@/utils/axiosInstance";
import { UserContext } from "@/context/UserContext";

const Sidebar = () => {
  const [assignment, setAssignment] = useState(0);
  const { user } = useContext(UserContext);

  const fetchAssignments = async () => {
    try {
      const res = await api.get("/assignment/get-assignments-for-student");
      if (res.data?.success) {
        setAssignment(res.data.total);
      }
    } catch (error) {
      console.error("Error fetching assignment count: ", error);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const teacherMenu = [
    {
      name: "My Courses",
      path: "/teacher-courses",
      icon: <GraduationCap className="size-4" />,
    },
    {
      name: "ChatBot AI",
      path: "/chatbot-ai",
      icon: <Bot className="size-4" />,
    },
    { name: "Profile", path: "/profile", icon: <User className="size-4" /> },
    {
      name: "Conversations",
      path: "/conversations",
      icon: <MessageCircleMore className="size-4" />,
    },
  ];

  const studentMenu = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <Home className="size-4" />,
    },
    {
      name: "Assignments",
      path: "/assignments",
      icon: <FileText className="size-4" />,
      showCount: true,
    },
    {
      name: "My Submissions",
      path: "/my-submissions",
      icon: <Upload className="size-4" />,
    },
    {
      name: "ChatBot AI",
      path: "/chatbot-ai",
      icon: <Bot className="size-4" />,
    },
    {
      name: "Contact Teachers",
      path: "/teachers",
      icon: <Users className="size-4" />,
    },
    {
      name: "Conversations",
      path: "/conversations",
      icon: <MessageCircleMore className="size-4" />,
    },
    { name: "Profile", path: "/profile", icon: <User className="size-4" /> },
  ];

  const menuItems = user?.role === "TEACHER" ? teacherMenu : studentMenu;

  return (
    <aside className="fixed top-16 left-0 w-56 h-[calc(100vh-4rem)] bg-white border-r shadow-sm flex flex-col py-6 px-4">
      <nav className="space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary text-white shadow"
                  : "text-gray-700 hover:bg-gray-100"
              }`
            }
          >
            {item.icon}
            <span className="relative">
              {item.name}
              {item.showCount && assignment > 0 && (
                <span className="absolute -top-2 -right-4.5 bg-red-500 text-white text-xs font-semibold rounded-full px-2 py-0.5">
                  {assignment}
                </span>
              )}
            </span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
