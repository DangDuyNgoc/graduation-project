import SearchBar from "@/components/Common/SearchBar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hook/useAuth";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { LoaderCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const [courses, setCourse] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filteredCourses, setFilteredCourses] = useState([]);
  const [search, setSearch] = useState("");

  useAuth();

  const navigate = useNavigate();

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

  const handleViewDetailCourse = (id) => {
    navigate(`/course/${id}`);
  };

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
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all"
              >
                <img
                  src={course.thumbnail?.url || "https://placehold.co/600x400"}
                  alt={course.title}
                  className="rounded-t-xl w-full h-40 object-cover"
                />
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {course.name}
                  </h2>
                  <p className="text-sm text-gray-500 mb-2">
                    Instructor: {course.teacherId?.name || "Unknown"}
                  </p>
                  <div className="flex items-center mb-4">
                    <p className="text-sm text-gray-600 flex item-center">
                      <Users size={16} className="mr-1" />{" "}
                      {course.studentIds?.length || 0} students enrolled
                    </p>
                    <span className="mx-3 w-1 h-1 bg-gray-400 rounded-full"></span>

                    <p className="text-sm text-gray-600 line-clamp-2">
                      {course.description}
                    </p>
                  </div>
                  <Button onClick={() => handleViewDetailCourse(course._id)}>
                    View Details
                  </Button>
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
