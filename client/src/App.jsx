import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { Navigate, Outlet } from "react-router-dom";
import api from "./utils/axiosInstance";

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const res = await api.get("/user/me", { withCredentials: true });
        if (res.data.success) setIsAuthenticated(true);
      } catch (error) {
        console.log(error);
        setIsAuthenticated(false);
      } finally {
        setAuthChecked(true);
      }
    };
    verifyAuth();
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