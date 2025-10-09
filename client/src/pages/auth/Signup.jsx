import React, { useState } from "react";
import { Eye, LoaderCircle } from "lucide-react";
import { EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../../components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { validateEmail } from "@/utils/helper";
import api from "@/utils/axiosInstance";

const Signup = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!fullName) {
      setError("Full name cannot be empty.");
      setLoading(false);
      return;
    }

    if (!phone) {
      setError("Phone cannot be empty.");
      setLoading(false);
      return;
    }

    if (!role) {
      setError("Please choose your role.");
      setLoading(false);
      return;
    }

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

    if (password !== confirmPassword) {
      setError("Password does not match.");
      setLoading(false);
      return;
    }
    setError("");

    try {
      const { data } = await api.post(
        "user/registration",
        {
          name: fullName,
          email,
          phone,
          password,
          role
        },
        { withCredentials: true }
      );

      const token = data.accessToken;
      // const userInfo = data.user;

      if (token) {
        navigate("/dashboard");
      }
    } catch (error) {
      console.log("Signup failed", error);
      setError(
        error?.response?.data?.message || "Signup failed. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-[100%] h-auto mt-10 flex flex-col justify-center">
        <h2 className="text-xl font-medium mb-6">Create an account</h2>
        <p className="text-xs text-slate-700 mt-3 mb-6">
          Join us today by creating an account. Fill in your details below to
          get started.
        </p>

        <form className="space-y-6" onSubmit={handleSignup}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <Input
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <Input
                type="text"
                placeholder="Enter your phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="flex flex-col">
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

            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <Select value={role} onValueChange={(value) => setRole(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Role</SelectLabel>
                    <SelectItem value="TEACHER">Teacher</SelectItem>
                    <SelectItem value="STUDENT">Student</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="relative col-span-2 md:col-span-2">
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

            <div className="relative col-span-2 md:col-span-2">
              <label className="text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <Input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <div
                className="absolute top-[32px] right-3 cursor-pointer text-gray-500"
                onClick={toggleConfirmPassword}
              >
                {showConfirmPassword ? <Eye /> : <EyeOff />}
              </div>
            </div>
          </div>

          {/* error message */}
          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button className={"w-full"} type="submit">
            {loading ? <LoaderCircle className="animate-spin" /> : "Sign Up"}
          </Button>
          <p className="text-xs text-slate-700 mt-2">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-primary font-medium cursor-pointer underline hover:opacity-80 transition-opacity duration-200"
            >
              Login
            </Link>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
};

export default Signup;
