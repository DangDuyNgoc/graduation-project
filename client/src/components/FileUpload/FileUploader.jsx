import React from "react";
import { FileText, X } from "lucide-react";

const FileUploader = ({ files = [], onRemove, onClearAll }) => {
  if (!files.length) return null;

  return (
    <div className="mt-4 space-y-2">
      {files.map((file, index) => (
        <div
          key={index}
          className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 shadow-sm hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <FileText className="text-blue-500 w-4 h-4" />
            <span className="text-gray-700 text-sm truncate max-w-[250px]">
              {file.name}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onRemove(index)}
            className="flex items-center space-x-1 text-red-500 hover:text-red-700 text-sm font-medium"
          >
            <X className="w-4 h-4" />
            <span>Remove</span>
          </button>
        </div>
      ))}

      {files.length > 1 && (
        <div className="text-right mt-3">
          <button
            type="button"
            onClick={onClearAll}
            className="text-sm text-gray-500 hover:text-red-600"
          >
            Clear all files
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
