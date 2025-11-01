import { LoaderCircle } from "lucide-react";

export default function LoadingSpinner({
  text = "Loading...",
  size = 8,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-20 ${className}`}
    >
      <LoaderCircle
        className={`animate-spin text-primary mb-2`}
        size={size * 4}
      />
      <p className="text-gray-500 text-sm">{text}</p>
    </div>
  );
}
