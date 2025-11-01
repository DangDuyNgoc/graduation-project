import api from "@/utils/axiosInstance";

export const getSubmisionApibyAssignmentId = async (id) => {
  const { data } = await api.get(`/submission/get-all-submissions/${id}`, {
    withCredentials: true,
  });
  return data;
};

export const getOneSubmisionApiById = async (id) => {
  const { data } = await api.get(`/submission/get-submission/${id}`, {
    withCredentials: true,
  });
  return data;
};
