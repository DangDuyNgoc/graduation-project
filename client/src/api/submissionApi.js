import api from "@/utils/axiosInstance";

export const getSubmisionApibyAssignmentId = async (id) => {
  const { data } = await api.get(`/submission/get-all-submissions/${id}`, {
    withCredentials: true,
  });
  return data;
};

export const getOneSubmissionApiById = async (id) => {
  const { data } = await api.get(`/submission/get-submission/${id}`, {
    withCredentials: true,
  });
  return data;
};
