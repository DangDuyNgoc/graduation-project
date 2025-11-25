import React from "react";
import { BookA } from 'lucide-react';
import { Toaster } from "react-hot-toast";

const AuthLayout = ({ children }) => {
  return (
    <div className="flex">
      <Toaster position="top-center" />
      <div className="w-screen h-screen md:w-[60vw] px-12 pt-8 pb-12">
        <h2 className="text-lg font-medium text-black"></h2>
        {children}
      </div>
      <div className="hidden md:block w-[40vw] h-screen bg-violet-50 bg-cover bg-no-repeat bg-center overflow-hidden p-8 relative">
        <div className="w-48 h-48 rounded-[40px] bg-purple-600 absolute -top-7 -left-5"></div>
        <div className="w-48 h-56 rounded-[40px] bg-purple-600 absolute top-[30%] -right-10 border-[20px] border-fuchsia-600"></div>
        <div className="w-48 h-48 rounded-[40px] bg-violet-500 absolute -bottom-7 -left-5"></div>

        <div className="grid grid-cols-1 z-20">
          <StatsInfoCard
            icon={<BookA />}
            label="Improve your knowledge"
            color="bg-primary"
          />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
const StatsInfoCard = ({ icon, label, color }) => {
  return (
    <div className="flex gap-6 bg-white p-4 rounded-lg items-center shadow-md shadow-purple-400/10 mb-4 border border-gray-200/50 z-10">
      <div
        className={`w-12 h-12 flex items-center justify-center text-[26px] text-white ${color} rounded-full drop-shadow-xl`}
      >
        {icon}
      </div>
      <div>
        <h6 className="text-xs text-gray-500 mb-1">{label}</h6>
      </div>
    </div>
  );
};
