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

  const socket = getSocket();

  // Join chatbot + listen for messages
  useEffect(() => {
    if (!user?._id) return;

    socket.emit("joinChatbot");

    const handleReceive = (msgs) => {
      setBotTyping(false);

      setMessages((prev) => {
        const existingKeys = new Set(
          prev.map((m) => m.createdAt + m.senderType)
        );
        const newMsgs = msgs.filter(
          (m) => !existingKeys.has(m.createdAt + m.senderType)
        );
        return [...prev, ...newMsgs];
      });
    };

    socket.on("receiveMessage", handleReceive);

    return () => {
      socket.off("receiveMessage", handleReceive);
    };
  }, [user?._id, socket]);

  // Fetch chat history
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
            const existingKeys = new Set(
              prev.map((m) => m.createdAt + m.senderType)
            );
            const filtered = data.messages.filter(
              (m) => !existingKeys.has(m.createdAt + m.senderType)
            );
            return [...prev, ...filtered];
          });
        }
      } catch (err) {
        console.error("Error fetching chat history:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user?._id]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send message
  const handleSend = () => {
    if (!input.trim()) return;

    const newMessage = {
      senderType: "user",
      text: input,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMessage]);
    socket.emit("chatbotMessage", input);
    setInput("");
    setBotTyping(true);
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
        {/* Header */}
        <div className="flex items-center p-3 bg-purple-600 text-white rounded-t">
          <h2 className="font-semibold flex-1">ChatBot AI</h2>
        </div>

        {/* Chat body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
          {messages.map((msg, idx) => {
            const isUser = msg.senderType === "user";
            return (
              <div
                key={idx}
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

          {/* Bot typing indicator */}
          {botTyping && (
            <div className="flex items-center space-x-1 text-sm text-gray-500 pl-2">
              <div className="animate-pulse">Chat bot is typing...</div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
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
