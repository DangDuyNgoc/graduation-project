import React, { useState, useRef, useEffect } from "react";
import { Input } from "../ui/input";
import Picker from "emoji-picker-react";
import { Smile, Paperclip, X } from "lucide-react";
import socket from "@/utils/socket";
import api from "@/utils/axiosInstance";
import { Avatar, AvatarImage } from "@radix-ui/react-avatar";

const ChatFrame = ({ conversationId, isOpen, teacher, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const typingTimeout = useRef(null);

  const fetchMessage = async () => {
    try {
      const { data } = await api.get(`/message/get-message/${conversationId}`);
      if (data.success) {
        setMessages(data.messages.reverse());
      }
    } catch (error) {
      console.log("Error fetching messages: ", error);
    }
  };

  // join conversation room
  useEffect(() => {
    if (!conversationId) return null;

    socket.emit("joinConversation", conversationId);

    fetchMessage();

    socket.on("receiveMessage", (newMessage) => {
      console.log("Received:", newMessage);
      console.log(123);
      setMessages((prev) => [...prev, newMessage]);
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

    // cleanup
    return () => {
      socket.emit("leaveConversation", conversationId);
      socket.off("receiveMessage");
      socket.off("userTyping");
      socket.off("userStopTyping");
    };
  }, [conversationId]);

  const messagesEndRef = useRef(null);
  const pickerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatBoxRef = useRef(null);

  const handleSendMessage = async () => {
    console.log("handleSendMessage called");
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
        formData.append("senderId", socket.userId);
        currentFiles.forEach((file) => {
          formData.append("materials", file);
        });

        const { data } = await api.post("/message/send", formData, {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (data.success) {
          socket.emit("receiveMessage", data.newMessage);
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
      handleSendMessage();
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

  // Hide emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedOutsidePicker =
        pickerRef.current && !pickerRef.current.contains(e.target);
      const clickedInput =
        inputRef.current && inputRef.current.contains(e.target);
      if (clickedOutsidePicker || clickedInput) setShowPicker(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      className="fixed bottom-16 right-4 w-80 h-96 bg-white border border-gray-300 rounded-lg shadow-xl flex flex-col z-50"
    >
      {/* Header */}
      <div className="flex items-center p-0.5 bg-primary text-white rounded-t-lg">
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 mr-2">
          <Avatar className="w-20 h-20">
            <AvatarImage src={teacher?.avatar?.url} alt="avatar image" />
          </Avatar>
        </div>
        <h3 className="font-semibold flex-1">{teacher.name}</h3>
        <button onClick={onClose} className="text-white hover:text-gray-200 mr-4">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto relative">
        {messages.map((msg, index) => {
          const isMine =
            msg.sender?._id?.toString?.() === socket.userId?.toString?.();

          return (
            <div
              key={index}
              className={`mb-2 flex ${
                isMine ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`inline-block text-sm p-2 rounded-lg max-w-[70%] break-words ${
                  isMine ? "text-white" : "bg-gray-200 text-black"
                }`}
              >
                {/* text message */}
                {msg.text && (
                  <p
                    className={`${
                      isMine
                        ? "bg-blue-500 p-1 rounded"
                        : "bg-gray-200 p-1 rounded"
                    } mb-1`}
                  >
                    {msg.text}
                  </p>
                )}

                {/* file */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="space-y-1">
                    {msg.attachments.map((file, i) => {
                      console.log(msg.attachments);
                      const isImage = file.fileType?.startsWith("image/");
                      return isImage ? (
                        <>
                          <img
                            key={i}
                            src={file.s3_url}
                            alt={file.title || "image"}
                            className="w-24 h-24 object-cover rounded bg-white border border-gray-300 cursor-pointer"
                            onClick={() => setLightboxImage(file.s3_url)}
                          />
                          <span
                            className="text-black text-xs truncate block max-w-[80px]"
                            title={file.title}
                          >
                            {file.title}
                          </span>
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
                        </>
                      ) : (
                        <a
                          key={i}
                          href={file.s3_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`block underline ${
                            isMine ? "text-black" : "text-blue-600"
                          } hover:opacity-80`}
                        >
                          📎 {file.title || `attached file`}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {typingUsers.length > 0 && (
          <div className=""> Someone is typing...</div>
        )}
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
        {/* Selected File Preview */}
        {selectedFile.length > 0 && (
          <div className="flex overflow-x-auto space-x-2 mb-1 px-2">
            {selectedFile.map((file, index) => (
              <div
                key={index}
                className="flex items-center bg-white border rounded px-2 py-1 text-xs flex-shrink-0"
              >
                {file.type.startsWith("image/") && (
                  <img
                    src={URL.createObjectURL(file)}
                    alt="preview"
                    className="w-6 h-6 object-cover rounded mr-1"
                  />
                )}
                <span className="truncate max-w-[60px]">{file.name}</span>
                <button
                  onClick={() =>
                    setSelectedFile((prev) =>
                      prev.filter((_, i) => i !== index)
                    )
                  }
                  className="ml-1 text-gray-500 hover:text-red-500"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative flex items-center">
          {/* File Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            className="absolute left-3 top-1/2 transform -translate-y-1/2"
          >
            <Paperclip
              size={16}
              className=" text-blue-600 cursor-pointer hover:bg-gray-200 rounded-full"
            />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) =>
              setSelectedFile((prev) => [
                ...prev,
                ...Array.from(e.target.files),
              ])
            }
          />
          {/* Input */}
          <Input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type message......"
            className="pl-9 pr-6 flex-1 rounded-full"
          />

          {/* Emoji Button */}
          <button
            type="button"
            onClick={() => setShowPicker((s) => !s)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
          >
            <Smile className="w-5 h-5 text-gray-600 cursor-pointer" />
          </button>

          {/* Emoji Picker */}
          {showPicker && (
            <div
              ref={pickerRef}
              className="absolute bottom-full mb-2 left-0 z-50"
              style={{ width: 320 }}
            >
              <Picker onEmojiClick={onEmojiClick} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatFrame;
