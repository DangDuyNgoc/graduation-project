import api from "@/utils/axiosInstance";

export const getTeacherCourses = async () => {
  const { data } = await api.get("/course/get-teacher-courses", {
    withCredentials: true,
  });
  return data;
};

export const deleteCourse = async (courseId) => {
  const { data } = await api.delete(`/course/delete-course/${courseId}`, {
    withCredentials: true,
  });
  return data;
};
