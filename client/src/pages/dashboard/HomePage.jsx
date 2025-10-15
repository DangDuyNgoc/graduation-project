import { Button } from "@/components/ui/button";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function HomePage() {
  const [courses, setCourse] = useState([]);
  const [loading, setLoading] = useState(false);

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

  const handleViewDetailCourse = (id) => {
    
    navigate(`/course/${id}`)
  }

  return (
    <DashboardLayout>
      <h1 className="text-2xl font-semibold mb-4">Student Dashboard</h1>
      <p className="text-gray-600">
        Welcome to your learning dashboard. Choose a section from the sidebar to
        begin.
      </p>
      {loading ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <div>
          {courses?.length > 0 ? (
            courses.map((course) => (
              <div
                key={course._id}
                className="bg-white rounded-xl shadow-sm border hover:shadow-md transition-all"
              >
                <img
                  src={course.thumbnail || "https://placehold.co/600x400"}
                  alt={course.title}
                  className="rounded-t-xl w-full h-40 object-cover"
                />
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    {course.title}
                  </h2>
                  <p className="text-sm text-gray-500 mb-2">
                    Instructor: {course.teacherId?.name || "Unknown"}
                  </p>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {course.description}
                  </p>
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
