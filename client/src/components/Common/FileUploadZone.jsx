import { FileText, FileUp, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function FileUploadZone({ onFilesChange, initialFiles = [] }) {
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (initialFiles?.length) {
      setFiles(initialFiles);
    }
  }, [initialFiles]);

  const handleFiles = (newFiles) => {
    const fileList = Array.from(newFiles);
    const updated = [...files, ...fileList];
    setFiles(updated);
    onFilesChange && onFilesChange(updated);
  };

  const handleRemove = (index) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onFilesChange && onFilesChange(updated);
  };

  const getFileIcon = (file) => {
    const name = file.name?.toLowerCase() || file.title?.toLowerCase() || "";
    const isExisting = !!file.url;

    if (isExisting) {
      if (name.endsWith(".pdf"))
        return <FileText className="size-6 text-red-500" />;
      if (name.endsWith(".doc") || name.endsWith(".docx"))
        return <FileText className="size-6 text-blue-500" />;
      if (name.endsWith(".ppt") || name.endsWith(".pptx"))
        return <FileText className="size-6 text-orange-500" />;
      if (name.match(/\.(jpg|jpeg|png|gif)$/))
        return (
          <img
            src={file.url}
            alt={file.title}
            className="w-8 h-8 object-cover rounded"
          />
        );
      return <FileText className="size-6 text-gray-400" />;
    }

    if (file.type?.startsWith("image/")) {
      return (
        <img
          src={URL.createObjectURL(file)}
          alt={file.name}
          className="w-8 h-8 object-cover rounded"
        />
      );
    }
    if (file.type?.includes("pdf"))
      return <FileText className="size-6 text-red-500" />;
    if (file.type?.includes("word") || file.type?.includes("doc"))
      return <FileText className="size-6 text-blue-500" />;
    if (file.type?.includes("ppt"))
      return <FileText className="size-6 text-orange-500" />;
    return <FileText className="size-6 text-gray-400" />;
  };

  return (
    <div className="w-full">
      <label className="text-sm font-medium text-gray-700 mb-1 block">
        Materials
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`relative max-w-[460px] border-2 border-dashed rounded-xl p-3 transition duration-200 select-none
          ${
            dragActive
              ? "border-blue-400 bg-blue-50"
              : "border-blue-300 hover:border-blue-400"
          }`}
      >
        {files.length === 0 && (
          <input
            type="file"
            multiple
            className="absolute inset-0 opacity-0 cursor-pointer"
            onChange={(e) => handleFiles(e.target.files)}
          />
        )}

        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center space-y-2 py-6">
            <FileUp className="size-8 text-gray-400" />
            <p className="text-gray-700 font-medium text-sm text-center">
              Drag and drop your files here, or click to browse
            </p>
            <p className="text-xs text-gray-500">(Max: 10 files, 20MB each)</p>
          </div>
        ) : (
          <>
            <div className="flex gap-3 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent w-full max-w-[460px] h-[112px] py-2 pb-[6px]">
              {files.map((file, index) => {
                const isExisting = !!file.url;
                return (
                  <div
                    key={index}
                    className="relative flex-shrink-0 w-20 h-20 border border-gray-200 rounded-lg bg-white shadow-sm flex flex-col items-center justify-center hover:border-blue-400 group"
                  >
                    {getFileIcon(file)}

                    <p className="text-[10px] text-gray-600 mt-1 text-center px-1 truncate w-full">
                      {file.name || file.title}
                    </p>

                    {isExisting && (
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute inset-0"
                      ></a>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(index);
                      }}
                      className="absolute top-1 right-1 text-gray-400 cursor-pointer hover:text-red-600 transition opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="w-full">
              <label className="block w-full text-center text-blue-500 text-sm cursor-pointer hover:underline">
                + Add more files
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.ppt,.pptx"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
