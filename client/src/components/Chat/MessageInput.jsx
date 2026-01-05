import React from "react";
import { Input } from "../ui/input";
import Picker from "emoji-picker-react";
import { Paperclip, Send, Smile, X } from "lucide-react";
import { Button } from "../ui/button";

const MessageInput = ({
  input,
  setInput,
  selectedFile,
  setSelectedFile,
  fileInputRef,
  inputRef,
  handleKeyDown,
  editingMessage,
  handleCancelEdit,
  showPicker,
  setShowPicker,
  pickerRef,
  onEmojiClick,
  handleSendMessage,
}) => {
  const canSend = input.trim() !== "" || selectedFile.length > 0;
  return (
    <>
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
                  setSelectedFile((prev) => prev.filter((_, i) => i !== index))
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
            setSelectedFile((prev) => [...prev, ...Array.from(e.target.files)])
          }
        />
        {/* Input */}
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            editingMessage ? "Editing message..." : "Type message......"
          }
          className={`pl-9 ${
            canSend ? "pr-12" : "pr-2"
          } flex-1 rounded-full break-all`}
        />
        {/* cancel edit button */}
        {editingMessage && (
          <div className="absolute left-0 -top-10 transform w-full px-6 flex items-center">
            <div>
              <span className="text-sm">Edit message</span>
            </div>
            <button
              onClick={handleCancelEdit}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 "
            >
              <X size={16} className=" hover:bg-black/20 rounded-full" />
            </button>
          </div>
        )}

        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowPicker((s) => !s)}
          className="absolute right-8 top-1/2 transform -translate-y-1/2"
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

        {/* Send Button */}
        {canSend && (
          <button type="button" onClick={handleSendMessage} className="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-pointer">
            <Send size={18} />
          </button>
        )}
      </div>
    </>
  );
};

export default MessageInput;
