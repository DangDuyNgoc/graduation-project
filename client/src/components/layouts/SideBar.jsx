// src/components/layout/Sidebar.jsx
import React from "react";
import { NavLink } from "react-router-dom";
import { Home, FileText, Upload, User } from "lucide-react";

const Sidebar = () => {
  const menuItems = [
    {
      name: "Dashboard",
      path: "/dashboard",
      icon: <Home className="size-4" />,
    },
    {
      name: "Assignments",
      path: "/assignments",
      icon: <FileText className="size-4" />,
    },
    {
      name: "Submit Work",
      path: "/submit",
      icon: <Upload className="size-4" />,
    },
    { name: "Profile", path: "/profile", icon: <User className="size-4" /> },
  ];

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
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;
