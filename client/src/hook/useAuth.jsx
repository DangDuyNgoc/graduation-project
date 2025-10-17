import { UserContext } from "@/context/UserContext";
import api from "@/utils/axiosInstance";
import { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export const useAuth = () => {
  const { user, updateUser, clearUser } = useContext(UserContext);

  const navigate = useNavigate();

  useEffect(() => {
    if (user) return;

    let isMounted = true;

    const fetchUserInfo = async () => {
      try {
        const response = api.get("/user/me", { withCredentials: true });
        if (isMounted && response.data) {
          updateUser(response.data.user);
        }
      } catch (error) {
        console.log(error);
        if (isMounted) {
          clearUser();
          navigate("/login");
        }
      }
    };

    fetchUserInfo();

    return () => {
      isMounted = false;
    };
  }, [updateUser, clearUser, navigate, user]);
};
