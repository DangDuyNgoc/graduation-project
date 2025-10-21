import React from "react";

const Footer = () => {
  return (
    <footer className="w-full bg-white border-t py-3 text-center text-xs text-gray-500 mt-auto">
      © {new Date().getFullYear()} Online Learning Platform — All Rights
      Reserved
    </footer>
  );
};

export default Footer;
