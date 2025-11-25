import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/utils/axiosInstance";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  const location = useLocation();
  const navigate = useNavigate();
  const { token } = location.state || {};

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");

    // if (password.length < 6) {
    //   setError("Password must be at least 6 characters.");
    //   return;
    // }

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await api.post("/user/forgot-password", {
        newPassword: password,
        token,
      });
      toast.success("Password reset successful. Login now.");
      navigate("/login");
    } catch (err) {
      setError(err?.response?.data?.message || "Reset failed. Try again.");
    }
  };

  return (
    <AuthLayout>
      <div className="w-3/4 h-3/4 mg:h-full flex flex-col justify-center space-y-6">
        <div>
          <h2 className="text-xl font-medium text-gray-900">
            Reset Your Password
          </h2>
          <p className="text-xs text-gray-600 mt-1">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleReset} className="space-y-6">
          <div className="relative">
            <label className="text-sm font-medium text-gray-700 mb-2">
              New Password
            </label>
            <Input
              type={showPass ? "text" : "password"}
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div
              onClick={() => setShowPass(!showPass)}
              className="absolute top-[32px] right-3 cursor-pointer text-gray-500"
            >
              {showPass ? <Eye /> : <EyeOff />}
            </div>
          </div>

          <div className="relative">
            <label className="text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <Input
              type={showConfirm ? "text" : "password"}
              placeholder="Re-enter password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <div
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute top-[32px] right-3 cursor-pointer text-gray-500"
            >
              {showConfirm ? <Eye /> : <EyeOff />}
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button className="w-full text-base" type="submit">
            Reset Password
          </Button>

          <p className="text-xs text-center text-gray-600">
            Remember your password?{" "}
            <span
              className="text-blue-600 underline cursor-pointer"
              onClick={() => navigate("/login")}
            >
              Login
            </span>
          </p>
        </form>
      </div>
    </AuthLayout>
  );
}
