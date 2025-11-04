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

export const getOneCourse = async (courseId) => {
  const { data } = await api.get(`/course/get-course/${courseId}`, {
    withCredentials: true,
  });
  return data;
};

export const createCourse = async (formData) => {
  const { data } = await api.post("/course/create-course", formData, {
    withCredentials: true,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const updateCourse = async (courseId, formData) => {
  const { data } = await api.put(
    `/course/update-course/${courseId}`,
    formData,
    {
      withCredentials: true,
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return data;
};

export const getStudentTeacherCourses = async (id) => {
  const { data } = await api.get(`/course/get-students-teacher-courses/${id}`, {
    withCredentials: true,
  });
  return data;
};

export const addStudentTeacherCourses = async (id, emails) => {
  const { data } = await api.put(
    `/course/add-students/${id}`,
    { emails },
    { withCredentials: true }
  );
  return data;
};

export const deleteStudentTeacherCourses = async (id, stuId) => {
  const { data } = await api.put(
    `/course/remove-students/${id}`,
    { studentIds: [stuId] },
    { withCredentials: true }
  );
  return data;
};

export const getAllStudent = async ({
  courseId,
  search = "",
  page = 1,
  limit = 15,
} = {}) => {
  const params = new URLSearchParams();

  if (courseId) params.append("courseId", courseId);
  if (search) params.append("search", search);
  params.append("page", page);
  params.append("limit", limit);

  const { data } = await api.get(
    `/course/get-all-students/teacher-course?${params.toString()}`,
    {
      withCredentials: true,
    }
  );

  return data;
};
