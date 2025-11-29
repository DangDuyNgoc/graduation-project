import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/utils/axiosInstance";
import { validateEmail } from "@/utils/helper";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleSendCode = async (e) => {
    e.preventDefault();
    setError("");

    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post("/user/request-password-reset", {
        email,
      });
      navigate("/verify-code", {
        state: {
          email,
          token: data.token,
          mode: "forgot",
        },
      });
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Failed to send reset code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-3/4 h-3/4 mg:h-full flex flex-col justify-center">
        <h2 className="text-xl font-medium mb-3">Forgot Your Password?</h2>
        <p className="text-xs text-slate-700 mb-6">
          Enter your email address to receive a code.
        </p>

        <form className="space-y-6" onSubmit={handleSendCode}>
          <div className="w-full">
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Email Address
            </label>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <Button type="submit" className="w-full">
            {loading ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              "Send Reset Code"
            )}
          </Button>
        </form>

        <div className="flex flex-col mt-4 space-y-2 text-xs text-center text-slate-700">
          <p>
            Didn't receive the email? Please check your spam or junk folder.
          </p>
          <Link
            to="/login"
            className="text-primary font-medium underline hover:opacity-80 transition-opacity duration-200"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
