import { Search } from "lucide-react";
import React from "react";
import { Input } from "../ui/input";

const SearchBar = ({ placeholder, value, onChange }) => {
  return (
    <div className="relative max-w-md mx-auto mb-8">
      <Search className="absolute left-3 top-2.5 text-gray-400 w-5 h-5" />
      <Input
        type="text"
        placeholder={placeholder || "Search here....."}
        className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg"
        value={value}
        onChange={onChange}
      />
    </div>
  );
};

export default SearchBar;
