import React, { useEffect, useState } from "react";
import { UserContext } from "./UserContext.js";
import api from "@/utils/axiosInstance.js";
import { LoaderCircle } from "lucide-react";

const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // update user data
  const updateUser = (userData) => {
    setUser(userData);
  };

  // clear user data
  const clearData = () => {
    setUser(null);
  };

  // get user from cookie
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await api.get("/user/me");
        setUser(data.user);
      } catch (error) {
        console.log("No user logged in", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  if (loading)
    return <LoaderCircle className="size-8 animate-spin text-primary" />;

  return (
    <UserContext.Provider
      value={{
        user,
        updateUser,
        clearData,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider;
