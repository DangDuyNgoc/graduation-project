import { useContext, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { Navigate, Outlet } from "react-router-dom";
import api from "./utils/axiosInstance";
import { UserContext } from "./context/UserContext";

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { updateUser } = useContext(UserContext);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const res = await api.get("/user/me", { withCredentials: true });
        if (res.data.success) {
          setIsAuthenticated(true);
          updateUser(res.data.user);
        }
      } catch (error) {
        console.log(error);
        try {
          const refreshRes = await api.get("/user/refresh-token");
          if (refreshRes.data.success) {
            const retryRes = await api.get("/user/me");
            if (retryRes.data.success) {
              setIsAuthenticated(true);
              updateUser(retryRes.data.user);
            }
          } else {
            setIsAuthenticated(false);
          }
        } catch {
          setIsAuthenticated(false);
        }
      } finally {
        setAuthChecked(true);
      }
    };
    verifyAuth();
  }, []);

  if (!authChecked) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}

export default App;
