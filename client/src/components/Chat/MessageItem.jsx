import { formatExactTime, getTimeAgo } from "@/utils/timeFormatter";
import { Avatar, AvatarImage } from "@radix-ui/react-avatar";
import { MoreVertical, Paperclip } from "lucide-react";
import React from "react";

const MessageItem = ({
  msg,
  isMine,
  isLastMessage,
  menuOpen,
  setMenuOpen,
  handleEditMessage,
  handleDeleteMessage,
  setLightboxImage,
}) => {
  return (
    <div className={`flex mb-2 ${isMine ? "justify-end" : "justify-start"} `}>
      {!isMine && (
        <div className="w-6 h-6 rounded-full overflow-hidden mr-2">
          <Avatar className="w-full h-full">
            <AvatarImage
              src={
                msg.sender?.avatar?.url ||
                "https://res.cloudinary.com/dsfdghxx4/image/upload/v1730813754/nrxsg8sd9iy10bbsoenn_bzlq2c.png"
              }
              alt={msg.sender?.name || "avatar"}
            />
          </Avatar>
        </div>
      )}

      <div
        title={formatExactTime(msg.createdAt)}
        className={`relative group inline-block text-sm rounded-lg max-w-[70%] break-all transition-colors ${
          isMine ? "text-white" : "bg-gray-200 text-black"
        }`}
      >
        {/* Edited label */}
        {msg.isEdited && !msg.isDeleted && (
          <div className="text-[10px] text-gray-400 mb-0.5 ml-2">Edited</div>
        )}

        {/* text message */}
        {msg.isDeleted ? (
          isMine ? (
            <p
              className="italic text-gray-400 text-sm border border-gray-200 rounded-full p-2"
            >
              You deleted a message
            </p>
          ) : (
            msg.text?.trim() !== "" && (
              <p className="italic text-gray-400 text-sm border border-gray-200 rounded-full p-2">
                {msg.text}
              </p>
            )
          )
        ) : (
          msg.text?.trim() !== "" && (
            <p
              className={`${
                isMine ? "bg-blue-500 p-2" : "bg-gray-200 p-2"
              } mb-1 rounded-full`}
            >
              {msg.text}
            </p>
          )
        )}

        {/* file */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="space-y-1">
            {msg.attachments.map((file, i) => {
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
                </>
              ) : (
                <a
                  key={i}
                  href={file.s3_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block underline ${
                    isMine ? "text-black" : "text-blue-600"
                  } hover:opacity-80 flex items-center`}
                >
                  <Paperclip size={18} className="mr-1" />
                  {file.title || `attached file`}
                </a>
              );
            })}
          </div>
        )}

        {/* show option when hovering */}
        {isMine && !msg.isDeleted && (
          <div className="absolute top-2 -left-6 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="relative">
              <button
                onClick={() =>
                  setMenuOpen((prev) => (prev === msg._id ? null : msg._id))
                }
                className="p-1 rounded-full hover:opacity-100 opacity-70 bg-white/70 hover:bg-gray-200 shadow-sm"
              >
                <MoreVertical color="#766f6f" size={16} />
              </button>

              {/* dropdown menu */}
              {menuOpen === msg._id && (
                <div className="message-menu absolute top-full right-0 mt-1 bg-white shadow-md rounded-lg border w-28 text-black z-10">
                  <button
                    onClick={() => handleEditMessage(msg)}
                    className="block w-full text-left px-3 py-1 hover:bg-gray-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteMessage(msg)}
                    className="block w-full text-left px-3 py-1 hover:bg-gray-100 text-red-500"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {isMine && isLastMessage && (
          <div className="text-[10px] text-gray-500 text-right mt-0.5">
            {msg.readBy?.length === 1 ? (
              <span>Sent {getTimeAgo(msg.createdAt)}</span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageItem;
