import React, { useEffect, useState } from "react";
import { UserContext } from "./UserContext.js";
import { setUpInterceptors } from "@/utils/axiosInstance.js";

const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  // update user data
  const updateUser = (userData) => {
    setUser(userData);
  };

  // clear user data
  const clearData = () => {
    setUser(null);
  };

  useEffect(() => {
    setUpInterceptors({ clearData });
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        authChecked,
        setAuthChecked,
        updateUser,
        clearData,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export default UserProvider;
