import React, { useContext } from "react";
import { GraduationCap } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { UserContext } from "@/context/UserContext";
import { Button } from "@/components/ui/button";
import api from "@/utils/axiosInstance";

const Header = () => {
  const { user, clearData } = useContext(UserContext);
  const navigate = useNavigate();

  const handleLogout = async () => {
    clearData();
    await api.get("/user/logout");
    navigate("/login");
  };

  return (
    <header className="w-full h-16 bg-white shadow-sm border-b flex items-center justify-between px-6 fixed top-0 left-0 z-50">
      <div className="text-lg font-semibold text-primary flex">
        <GraduationCap className="mr-3"/> Online Learning
      </div>

      <div className="flex items-center gap-4">
        <div className="text-sm text-gray-700">
          Hi, <span className="font-medium">{user?.name || "Guest"}</span>
        </div>
        <Button
          onClick={handleLogout}
          className="text-xs bg-red-500 hover:bg-red-600"
        >
          Logout
        </Button>
      </div>
    </header>
  );
};

export default Header;
