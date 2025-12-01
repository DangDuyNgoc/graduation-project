import LoadingSpinner from "@/components/Common/LoadingSpinner";
import { UserContext } from "@/context/UserContext";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { getSocket } from "@/utils/socket";
import { useContext, useEffect, useRef, useState } from "react";

export default function ChatBotPage() {
  const { user } = useContext(UserContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [botTyping, setBotTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = getSocket();
  }, []);

  useEffect(() => {
    if (!user?._id || !socketRef.current) return;
    const socket = socketRef.current;

    socket.emit("joinChatbot");

    const handleReceive = (msgs) => {
      setMessages((prev) => {
        const exist = new Set(prev.map((m) => m._id));
        const filtered = msgs.filter((m) => !exist.has(m._id));
        return [...prev, ...filtered];
      });

      if (msgs.some((m) => m.senderType === "bot")) {
        setBotTyping(false);
      }
    };

    socket.off("receiveMessage");
    socket.on("receiveMessage", handleReceive);
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id) return;
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/chatbot/chat-history", {
          withCredentials: true,
        });
        if (data.success && data.messages) {
          setMessages((prev) => {
            const exist = new Set(prev.map((m) => m._id));
            const filtered = data.messages.filter((m) => !exist.has(m._id));
            return [...prev, ...filtered];
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim()) return;
    socketRef.current.emit("chatbotMessage", input);
    setBotTyping(true);
    setInput("");

    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingSpinner text="Loading ChatBot..." className="py-20" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-129.5px)] w-full border rounded shadow">
        <div className="flex items-center p-3 bg-purple-500 text-white rounded-t">
          <h2 className="font-semibold flex-1">ChatBot AI</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
          {messages.map((msg, idx) => {
            const isUser = msg.senderType === "user";
            return (
              <div
                key={msg._id || idx}
                className={`flex flex-col ${
                  isUser ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`p-2 rounded max-w-[70%] break-words ${
                    isUser
                      ? "bg-blue-500 text-white rounded-br-none"
                      : "bg-gray-300 text-black rounded-bl-none"
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-gray-400 mt-1">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            );
          })}

          {botTyping && (
            <div className="h-6 flex items-center pl-2 transition-opacity duration-200">
              <div
                className={`text-sm text-gray-500 animate-pulse ${
                  botTyping ? "opacity-100" : "opacity-0"
                }`}
              >
                Chat bot is typing...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 border-t flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 pl-3 pr-3 py-2 border rounded-full focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`ml-2 px-4 py-2 rounded-full text-white ${
              input.trim()
                ? "bg-purple-600 hover:bg-purple-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
