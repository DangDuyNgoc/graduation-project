import React from "react";
import MessageItem from "./MessageItem";
import { Avatar, AvatarImage } from "../ui/avatar";

const MessageList = ({
  messages,
  user,
  menuOpen,
  setMenuOpen,
  handleEditMessage,
  handleDeleteMessage,
  setLightboxImage,
  typingUsers,
}) => {
  return (
    <>
      {messages.map((msg, index) => {
        const isMine = msg.sender?._id?.toString?.() === user._id?.toString();
        const isLastMessage = index === messages.length - 1;
        return (
          <MessageItem
            key={index}
            msg={msg}
            isMine={isMine}
            isLastMessage={isLastMessage}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            handleDeleteMessage={handleDeleteMessage}
            handleEditMessage={handleEditMessage}
            setLightboxImage={setLightboxImage}
          />
        );
      })}

      {/* Animation typing */}
      {typingUsers.length > 0 && (
        <div className="flex items-center space-x-2 mt-1">
          <div className="flex -space-x-1">
            <div className="w-6 h-6 rounded-full overflow-hidden border border-white">
              <Avatar className="w-full h-full">
                <AvatarImage
                  src={
                    messages?.avatar?.url ||
                    "https://res.cloudinary.com/dsfdghxx4/image/upload/v1730813754/nrxsg8sd9iy10bbsoenn_bzlq2c.png"
                  }
                  alt={messages?.name || "avatar"}
                />
              </Avatar>
            </div>
            {/* typing dot */}
            <div className="flex space-x-1 items-center ml-2">
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot" />
              <span className="w-1.5 h-1.5 bg-gray-400 rounded-full typing-dot" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageList;
