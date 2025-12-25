import SearchBar from "@/components/Common/SearchBar";
import { useAuth } from "@/hook/useAuth";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { LoaderCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const [courses, setCourse] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();

  useAuth();

  const fetchCourse = async () => {
    setLoading(true);

    try {
      const { data } = await api.get("/course/get-all-courses", {
        withCredentials: true,
      });
      setCourse(data.course || []);
    } catch (error) {
      console.error("Failed to fetch course: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourse();
  }, []);

  useEffect(() => {
    const lower = search.toLowerCase();
    const filtered = courses.filter(
      (c) =>
        c.name?.toLowerCase().includes(lower) ||
        c.teacherId?.name.toLowerCase().includes(lower)
    );
    setFilteredCourses(filtered);
  }, [search, courses]);

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-semibold mb-2">Student Dashboard</h1>
      <p className="text-gray-600 text-sm">
        Welcome to your learning dashboard.
      </p>

      {/* Search Bar */}
      <SearchBar
        placeholder="Search courses by name or instructor..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {filteredCourses?.length > 0 ? (
            filteredCourses.map((course) => (
              <div
                key={course._id}
                onClick={() => {
                  if (!course.isEnrolled) {
                    toast.error("You have not enrolled in this course yet.");
                    return;
                  }
                  navigate(`/course/${course._id}`);
                }}
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-300 flex-col cursor-pointer"
              >
                {/* thumbnail */}
                <img
                  src={course.thumbnail?.url || "https://placehold.co/600x400"}
                  alt={course.title}
                  className="rounded-t-xl w-full h-40 object-cover"
                />

                {/* content */}
                <div className="p-4 flex flex-col flex-1">
                  <h2 className="text-lg font-semibold text-gray-800 mb-1 line-clamp-1">
                    {course.name}
                  </h2>
                  <p className="text-sm text-gray-500 mb-2">
                    Instructor:{" "}
                    <span className="font-medium text-gray-700">
                      {course.teacherId?.name || "Unknown"}
                    </span>
                  </p>

                  {/* student enrolled */}
                  <div className="flex items-center mb-1 gap-2">
                    <Users size={16} className="text-gray-500" />
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">
                      {course.studentIds?.length || 0} students enrolled
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 italic text-center col-span-full">
              No courses available.
            </p>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

export default HomePage;
