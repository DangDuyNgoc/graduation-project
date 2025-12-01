import api from "@/utils/axiosInstance";

export const getAssignmentByCourseId = async (courseId) => {
  const { data } = await api.get(
    `/assignment/get-assignment-by-course/${courseId}`,
    { withCredentials: true }
  );
  return data;
};

export const getAssignmentById = async (assignmentId) => {
  const { data } = await api.get(`/assignment/get-assignment/${assignmentId}`, {
    withCredentials: true,
  });
  return data;
};

export const createAssignment = async (formData) => {
  const { data } = await api.post("/assignment/create-assignment", formData, {
    withCredentials: true,
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const updateAssignment = async (assignmentId, formData) => {
  const { data } = await api.put(
    `/assignment/update-assignment/${assignmentId}`,
    formData,
    {
      withCredentials: true,
      headers: { "Content-Type": "multipart/form-data" },
    }
  );
  return data;
};

export const deleteAssignment = async (assignmentId) => {
  const { data } = await api.delete(
    `/assignment/delete-assignment/${assignmentId}`,
    {
      withCredentials: true,
    }
  );
  return data;
};

export const deleteAllAssignmentByCourseId = async (courseId) => {
  const { data } = await api.delete(
    `/assignment/delete-all-assignment-materials-by-courseId/${courseId}`,
    {
      withCredentials: true,
    }
  );
  return data;
};

export const deleteOneAssignmentMaterial = async (
  assignmentId,
  materialKey
) => {
  const { data } = await api.delete(
    `/assignment/delete-one-assignment-material`,
    {
      withCredentials: true,
      data: { assignmentId, materialKey },
    }
  );
  return data;
};

export const deleteAllMaterialsAssignment = async (assignmentId) => {
  const { data } = await api.delete(
    `/assignment/delete-all-assignment-materials/${assignmentId}`,
    {
      withCredentials: true,
    }
  );
  return data;
};
