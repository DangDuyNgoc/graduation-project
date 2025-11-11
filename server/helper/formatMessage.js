export const formatMessage = (text) => {
  if (!text) return "";
  return text.trim().replace(/\n+/g, "\n");
};
