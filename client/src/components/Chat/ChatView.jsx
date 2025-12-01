import React, { useState, useRef, useEffect, useContext } from "react";
import { X } from "lucide-react";
import { getSocket } from "@/utils/socket";
import api from "@/utils/axiosInstance";
import { Avatar, AvatarImage } from "@radix-ui/react-avatar";
import { UserContext } from "@/context/UserContext";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

const ChatView = ({
  conversationId,
  isOpen,
  onClose,
  teacher,
  isOpenChatView = true,
}) => {
  const { user } = useContext(UserContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const [editMessageId, setEditMessageId] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState("");

  const typingTimeout = useRef(null);

  const socket = getSocket();

  const fetchMessage = async () => {
    try {
      const { data } = await api.get(`/message/get-message/${conversationId}`);
      if (data.success) {
        setMessages(data.messages.reverse());
      }
      console.log(messages);
    } catch (error) {
      console.log("Error fetching messages: ", error);
    }
  };

  // join conversation room
  useEffect(() => {
    if (!conversationId) return;

    setMessages([]);
    socket.emit("joinConversation", conversationId);
    fetchMessage();

    socket.emit("markAsRead", { conversationId });

    console.log("Socket connected?", socket.connected);
    console.log("Joining conversationId:", conversationId);

    socket.on("receiveMessage", (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });

    socket.on("messageRead", ({ conversationId: cid, userId }) => {
      if (cid === conversationId) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.readBy?.includes(userId)) return msg;
            return { ...msg, readBy: [...(msg.readBy || []), userId] };
          })
        );
      }
    });

    // when somebody typing
    socket.on("userTyping", ({ userId }) => {
      setTypingUsers((prev) =>
        prev.includes(userId) ? prev : [...prev, userId]
      );
    });

    // when somebody stops typing
    socket.on("userStopTyping", ({ userId }) => {
      setTypingUsers((prev) => prev.filter((id) => id !== userId));
    });

    // edit message
    socket.on("messageEdited", (updatedMessage) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === updatedMessage._id ? { ...msg, ...updatedMessage } : msg
        )
      );
    });

    // delete message
    socket.on("messageDeleted", (updated) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id.toString() === updated._id.toString()
            ? {
                ...msg,
                text: updated.text,
                isDeleted: true,
                attachments: [],
              }
            : msg
        )
      );
    });

    // cleanup
    return () => {
      socket.emit("leaveConversation", conversationId);
      socket.off("receiveMessage");
      socket.off("userTyping");
      socket.off("userStopTyping");
      socket.off("messageRead");
      socket.off("messageEdited");
      socket.off("messageDeleted");
    };
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId || !socket) return;
    socket.emit("markAsRead", { conversationId });
  }, [conversationId, messages.length]);

  const messagesEndRef = useRef(null);
  const pickerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatBoxRef = useRef(null);

  const handleSendMessage = async () => {
    if (!conversationId) return;
    const currentFiles = Array.isArray(selectedFile)
      ? selectedFile
      : Array.from(selectedFile || []);
    if (!input.trim() && selectedFile.length === 0) return;

    try {
      // if it has files, then upload
      if (currentFiles.length > 0) {
        const formData = new FormData();
        formData.append("conversationId", conversationId);
        formData.append("text", input);
        formData.append("senderId", user._id);
        currentFiles.forEach((file) => {
          formData.append("materials", file);
        });

        const { data } = await api.post("/message/send", formData, {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (data.success) {
          setMessages((prev) => [...prev, data.newMessage]);
        }
      } else {
        socket.emit("sendMessage", {
          conversationId,
          text: input,
          attachments: [],
        });
      }

      setSelectedFile([]);
      setInput("");
    } catch (error) {
      console.error("error sending message: ", error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (editingMessage) {
        handleSaveEdit();
      } else handleSendMessage();
    } else {
      handleTyping();
    }
  };

  const onEmojiClick = (emojiData) => {
    setInput((prev) => prev + emojiData.emoji);
  };

  // auto scroll
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Hide emoji picker or menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedOutsidePicker =
        pickerRef.current && !pickerRef.current.contains(e.target);
      const clickedInput =
        inputRef.current && inputRef.current.contains(e.target);
      if (clickedOutsidePicker || clickedInput) setShowPicker(false);
      if (menuOpen && !e.target.closest(".message-menu")) {
        setMenuOpen(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleEditMessage = (msg) => {
    setMenuOpen(null);
    setEditMessageId(msg._id);
    setEditingMessage(msg);
    setInput(msg.text);
    setEditText(msg.text || "");
    inputRef.current.focus();
  };

  const handleSaveEdit = () => {
    const textToSave = editText || input;
    if (!textToSave.trim()) return;

    socket.emit("editMessage", {
      messageId: editMessageId,
      newText: input,
      conversationId,
    });

    setEditMessageId(null);
    setEditingMessage(null);
    setEditText("");
    setInput("");
  };

  const handleCancelEdit = () => {
    setEditMessageId(null);
    setEditingMessage(null);
    setEditText("");
    setInput("");
  };

  const handleDeleteMessage = (msg) => {
    setMenuOpen(null);
    try {
      socket.emit("deleteMessage", { messageId: msg._id });
    } catch (error) {
      console.error("Error deleting message: ", error);
    }
  };

  const handleTyping = () => {
    if (!isTyping) {
      socket.emit("typing", conversationId);
      setIsTyping(true);
    }

    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("stopTyping", conversationId);
      setIsTyping(false);
    }, 2000);
  };

  // Drag & Drop logic
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!chatBoxRef.current.contains(e.relatedTarget)) {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFile((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={chatBoxRef}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col bg-white border rounded-lg shadow-md ${
        isOpenChatView ? "w-full h-full" : "fixed bottom-16 right-4 w-80 h-96"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-0.5 bg-primary text-white rounded-t-lg sticky top-0 w-full z-10">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 mr-2">
            <Avatar className="w-20 h-20">
              <AvatarImage
                src={
                  teacher?.avatar?.url ||
                  "https://res.cloudinary.com/dsfdghxx4/image/upload/v1730813754/nrxsg8sd9iy10bbsoenn_bzlq2c.png"
                }
                alt="avatar image"
              />
            </Avatar>
          </div>
          <h3 className="font-semibold text-sm">{teacher.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-200 ml-4 flex-shrink-0"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div
        className={`flex-1 p-4 overflow-y-auto relative ${
          editingMessage ? "filter pointer-events-none" : ""
        }mt-6`}
      >
        <MessageList
          messages={messages}
          user={user}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          handleEditMessage={handleEditMessage}
          handleDeleteMessage={handleDeleteMessage}
          setLightboxImage={setLightboxImage}
          typingUsers={typingUsers}
        />
        <div ref={messagesEndRef} />

        {/* Drag overlay */}
        {dragActive && (
          <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-50 ">
            <div className="text-black font-medium text-center">
              Drop your file here
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-gray-300 relative flex flex-col">
        {/* Message Input */}
        <MessageInput
          input={input}
          setInput={setInput}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          fileInputRef={fileInputRef}
          inputRef={inputRef}
          handleKeyDown={handleKeyDown}
          editingMessage={editingMessage}
          handleCancelEdit={handleCancelEdit}
          showPicker={showPicker}
          setShowPicker={setShowPicker}
          pickerRef={pickerRef}
          onEmojiClick={onEmojiClick}
        />
      </div>
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setLightboxImage(null)}
        >
          <img
            src={lightboxImage}
            alt="full"
            className="max-h-[90%] max-w-[90%] rounded shadow-lg"
          />
        </div>
      )}
    </div>
  );
};

export default ChatView;
