import { UserContext } from "@/context/UserContext";
import api from "@/utils/axiosInstance";
import React, { useContext, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import ChatView from "./ChatView";
import { getSocket } from "@/utils/socket";

function ChatDetail({ conversationId, onClose }) {
  const { user } = useContext(UserContext);
  const [conversationInfo, setConversationInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const socket = getSocket();

  useEffect(() => {
    const handleReceiveMessage = (message) => {
      if (message.conversation.toString() === conversationId) {
        setConversationInfo((prev) => ({
          ...prev,
          lastMessage: message.text,
          lastMessageAt: message.createdAt,
          lastMessageSender: message.sender._id,
        }));
      }
    };

    const handleMessageRead = ({ conversationId: convId, userId }) => {
      if (convId !== conversationId) return;
      setConversationInfo((prev) => {
        if (!prev || !prev.messages) return prev;

        return {
          ...prev,
          messages: prev.messages.map((msg) =>
            msg.readBy.includes(userId)
              ? msg
              : { ...msg, readBy: [...msg.readBy, userId] }
          ),
        };
      });
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("messageRead", handleMessageRead);

    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("messageRead", handleMessageRead);
    };
  }, [conversationId]);

  const fetchConversation = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/conversation/get/${conversationId}`, {
        withCredentials: true,
      });

      if (data.success) {
        setConversationInfo(data.conversation);
      }
    } catch (error) {
      console.log("Error in fetched conversation: ", error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchConversation();
  }, [conversationId]);

  useEffect(() => {
    if (conversationInfo && conversationId && user?._id) {
      socket.emit("markAsRead", { conversationId });
    }
  }, [conversationId]);

  if (!conversationId) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <LoaderCircle className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!conversationInfo) {
    return (
      <div className="flex justify-center py-10 text-gray-500">
        Conversation not found
      </div>
    );
  }

  const otherUser = !conversationInfo.isGroup
    ? conversationInfo.participants.find((p) => p._id !== user._id)
    : conversationInfo.groupAdmin;

  return (
    <ChatView
      conversationId={conversationId}
      isOpen={true}
      teacher={otherUser}
      onClose={onClose}
      openChatView={true}
    />
  );
}

export default ChatDetail;
