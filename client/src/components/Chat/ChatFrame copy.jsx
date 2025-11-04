import React, { useState, useRef, useEffect } from "react";
import { Input } from "../ui/input";
import Picker from "emoji-picker-react";
import { Smile, Paperclip, X } from "lucide-react";

const ChatFrame = ({ isOpen, teacher, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const messagesEndRef = useRef(null);
  const pickerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatBoxRef = useRef(null);

  const sendMessage = () => {
    if (!input.trim() && !selectedFile) return;

    let message = input.trim();
    if (selectedFile) {
      message += `\n📎 File: ${selectedFile.name}`;
    }

    setMessages((prev) => [...prev, { text: message, sender: "user" }]);
    setInput("");
    setSelectedFile(null);

    // fake response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { text: "Got your message!", sender: "bot" },
      ]);
    }, 1000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const onEmojiClick = (emojiData) => {
    setInput((prev) => prev + emojiData.emoji);
  };

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Ẩn emoji picker khi click ra ngoài hoặc vào input
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

  // Drag & Drop logic
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={chatBoxRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="fixed bottom-16 right-4 w-80 h-96 bg-white border border-gray-300 rounded-lg shadow-xl flex flex-col z-50"
    >
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-primary text-white rounded-t-lg">
        <h3 className="font-semibold">Chat with {teacher.name}</h3>
        <button onClick={onClose} className="text-white hover:text-gray-200">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto relative">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-2 ${
              msg.sender === "user" ? "text-right" : "text-left"
            }`}
          >
            <span
              className={`inline-block text-sm p-2 rounded-lg whitespace-pre-line ${
                msg.sender === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              {msg.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />

        {/* Drag overlay */}
        {dragActive && (
          <div className="absolute inset-0 bg-opacity-40 flex items-center justify-center rounded-lg">
            <div className="text-white font-medium text-center">
              Drop your file here
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-gray-300 relative">
        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowPicker((s) => !s)}
          className="absolute right-6 top-1/2 transform -translate-y-1/2"
        >
          <Smile className="w-5 h-5 text-gray-600 cursor-pointer" />
        </button>

        {/* File Upload Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current.click()}
          className="absolute left-6 top-1/2 transform -translate-y-1/2"
        >
          <Paperclip size={16} className=" text-blue-600 cursor-pointer hover:bg-gray-200 rounded-full" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => setSelectedFile(e.target.files[0])}
        />

        {/* Input */}
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type message......"
          className="pl-9 pr-6 rounded-full"
        />

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

        {/* Selected File Preview */}
        {selectedFile && (
          <div className="absolute -top-10 left-0 right-0 bg-gray-100 border border-gray-300 rounded-t-lg px-3 py-1 text-sm flex justify-between items-center">
            <span className="truncate">{selectedFile.name}</span>
            <button
              onClick={() => setSelectedFile(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatFrame;