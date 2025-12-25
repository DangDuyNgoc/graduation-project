import { useContext, useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import api from "./utils/axiosInstance";
import { Toaster } from "react-hot-toast";
import { UserContext } from "./context/UserContext";

function App() {
  const { updateUser, isAuthenticated, authChecked, setAuthChecked } =
    useContext(UserContext);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await api.get("/user/refresh-token", { withCredentials: true });
        const res = await api.get("/user/me");
        updateUser(res.data.user);
      } catch {
        // User is not authenticated
      } finally {
        setAuthChecked(true);
      }
    };

    initAuth();
  }, []);

  if (!authChecked) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}

export default App;
