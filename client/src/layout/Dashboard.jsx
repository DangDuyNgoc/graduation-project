import React from "react";
import Header from "@/components/layouts/Header";
import Sidebar from "@/components/layouts/Sidebar";
import Footer from "@/components/layouts/Footer";

const DashboardLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 ml-56">
        <Header />
        <main className="flex-1 mt-14 p-4">{children}</main>
        <Footer />
      </div>
    </div>
  );
};

export default DashboardLayout;
