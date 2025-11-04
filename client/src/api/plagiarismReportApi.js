import api from "@/utils/axiosInstance";

export const getPlagiarismReportApiById = async (id) => {
  const { data } = await api.get(`/plagiarism/get-plagiarism-report/${id}`, {
    withCredentials: true,
  });
  return data;
};
