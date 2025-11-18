import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import api from "@/utils/axiosInstance";
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export default function VerifyCode() {
  const [code, setCode] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputsRef = useRef([]);

  const location = useLocation();
  const navigate = useNavigate();
  const { email } = location.state || {};
  let token = location.state?.token;

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleChange = (value, index) => {
    if (!/^[0-9]?$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value !== "" && index < 3) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && code[index] === "" && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!paste) return;

    const arr = paste.slice(0, 4).split("");
    const newCode = ["", "", "", ""];
    arr.forEach((char, i) => (newCode[i] = char));
    setCode(newCode);

    inputsRef.current[arr.length - 1]?.focus();
  };

  const handleVerify = async () => {
    const otp = code.join("");
    if (otp.length < 4) {
      setError("Please enter the 4-digit code.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      await api.post("/user/verify-otp", { token, otp });
      navigate("/reset-password", { state: { token } });
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || countdown > 0) return;

    setResending(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.post("/user/request-password-reset", {
        email,
      });
      token = data.token;
      location.state.token = data.token;
      setSuccess("Code resent! Please check your email.");
      setCode(["", "", "", ""]);
      inputsRef.current[0]?.focus();

      setCountdown(60);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-3/4 h-3/4 mg:h-full flex flex-col justify-center space-y-6">
        <div>
          <h2 className="text-xl font-medium text-gray-900">Verify Code</h2>
          <p className="text-xs text-gray-600 mt-1">
            Enter the 4-digit code we sent to <strong>{email}</strong>
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          {code.map((v, i) => (
            <Input
              key={i}
              ref={(el) => (inputsRef.current[i] = el)}
              maxLength={1}
              className="w-12 h-12 text-center text-xl font-semibold"
              value={v}
              onChange={(e) => handleChange(e.target.value, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onPaste={i === 0 ? handlePaste : undefined}
            />
          ))}
        </div>

        {error && <p className="text-red-500 text-xs text-center">{error}</p>}
        {success && (
          <p className="text-green-500 text-xs text-center">{success}</p>
        )}

        <Button className="w-full" onClick={handleVerify} disabled={loading}>
          {loading ? "Verifying..." : "Verify"}
        </Button>

        <div className="text-xs text-center text-gray-600">
          Didn't receive the code?{" "}
          <button
            onClick={handleResend}
            disabled={resending || countdown > 0}
            className="text-blue-600 underline cursor-pointer"
          >
            {resending
              ? "Resending..."
              : countdown > 0
              ? `Resend (${countdown}s)`
              : "Resend"}
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
