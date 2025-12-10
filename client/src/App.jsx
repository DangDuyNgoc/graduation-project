import { useContext, useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { Navigate, Outlet } from "react-router-dom";
import api from "./utils/axiosInstance";
import { UserContext } from "./context/UserContext";

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const { user, updateUser, clearData } = useContext(UserContext);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const res = await api.get("/user/me", { withCredentials: true });
        if (res.data.success) {
          updateUser(res.data.user);
        } else {
          clearData();
        }
      } catch (error) {
        console.log(error);
        clearData();
      } finally {
        setAuthChecked(true);
      }
    };
    verifyAuth();
  }, []);

  if (!authChecked) return null;
  if (!user) {
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
