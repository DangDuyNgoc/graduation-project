import React, { useContext, useState } from "react";
import { Eye, LoaderCircle } from "lucide-react";
import { EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../../components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { validateEmail } from "@/utils/helper";
import api from "@/utils/axiosInstance";
import { UserContext } from "@/context/UserContext";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();
  const { updateUser } = useContext(UserContext);

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      setLoading(false);
      return;
    }

    if (!password) {
      setError("Password cannot be empty.");
      setLoading(false);
      return;
    }
    setError(null);

    try {
      const { data } = await api.post(
        "user/login",
        {
          email,
          password,
        },
        { withCredentials: true }
      );

      const token = data.accessToken;
      const userInfo = data.user;

      if (token) {
        updateUser(userInfo);
        navigate("/dashboard");
      }
    } catch (error) {
      console.log("Login failed", error);
      setError(
        error?.response?.data?.message || "Login failed. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-3/4 h-3/4 mg:h-full flex flex-col justify-center">
        <h2 className="text-xl font-medium mb-6">Welcome back</h2>
        <p className="text-xs text-slate-700 mt-3 mb-6">
          Please enter your details to login
        </p>

        <form className="space-y-6" onSubmit={handleSignup}>
          <div className="w-full">
            <label className="text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="Enter your email name"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative w-full">
            <label className="text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div
              className="absolute top-[32px] right-3 cursor-pointer text-gray-500"
              onClick={togglePassword}
            >
              {showPassword ? <Eye /> : <EyeOff />}
            </div>
          </div>

          {/* error message */}
          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button className={"w-full"} type="submit">
            {loading ? <LoaderCircle className="animate-spin" /> : "Login"}
          </Button>
          <p className="text-xs text-slate-700 mt-2">
            Don&apos;t have an account?{" "}
            <Link
              to="/signup"
              className="text-primary font-medium cursor-pointer underline hover:opacity-80 transition-opacity duration-200"
            >
              Sign Up
            </Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
};

export default Login;
