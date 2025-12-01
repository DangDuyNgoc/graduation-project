import ChatDetail from "@/components/Chat/ChatDetail";
import DeleteDialog from "@/components/Common/DeleteDialog";
import SearchBar from "@/components/Common/SearchBar";
import { Card, CardContent } from "@/components/ui/card";
import { UserContext } from "@/context/UserContext";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { getSocket } from "@/utils/socket";
import { formatTimeMessage } from "@/utils/timeFormatter";
import { Avatar, AvatarImage } from "@radix-ui/react-avatar";
import { LoaderCircle, Trash2 } from "lucide-react";
import React, { useContext, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

const ConversationsPage = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openConversation, setOpenConversation] = useState(null);
  const [searchKey, setSearchKey] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { user } = useContext(UserContext);

  const socket = getSocket();

  const openConversationRef = useRef(openConversation);

  useEffect(() => {
    openConversationRef.current = openConversation;
  }, [openConversation]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/conversation/get-all-conversations/${user._id}`,
        {
          withCredentials: true,
        }
      );
      if (data.success) {
        setConversations(data.conversations);
        data.conversations.forEach((conv) => {
          socket.emit("joinConversation", conv._id);
        });
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message) => {
      setConversations((prev) => {
        const exists = prev.some(
          (c) => c._id.toString() === message.conversation.toString()
        );

        if (!exists) {
          return [
            {
              _id: message.conversation.toString(),
              lastMessageObj: { ...message },
              lastMessageAt: message.createdAt,
              participants: [user, message.sender],
              unreadCount: 1,
            },
            ...prev,
          ];
        }

        return prev.map((conv) => {
          if (conv._id.toString() === message.conversation.toString()) {
            const isOpen = openConversationRef.current === conv._id.toString();

            return {
              ...conv,
              lastMessageObj: { ...message },
              lastMessageAt: message.createdAt,
              unreadCount: isOpen ? 0 : (conv.unreadCount || 0) + 1,
            };
          }
          return conv;
        });
      });
    };

    const handleUnreadUpdated = ({ conversationId }) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv._id.toString() === conversationId
            ? { ...conv, unreadCount: 0 }
            : conv
        )
      );
    };

    socket.on("receiveMessage", handleReceiveMessage);

    socket.on("unreadUpdated", handleUnreadUpdated);

    // update conversation
    socket.on("conversationUpdated", (data) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv._id.toString() === data.conversationId
            ? {
                ...conv,
                lastMessageObj: {
                  ...conv.lastMessageObj,
                  text: data.lastMessage,
                  createdAt: data.lastMessageAt,
                  sender: { _id: data.lastMessageSender },
                },
                lastMessageAt: data.lastMessageAt,
                unreadCount: data.unreadCount,
              }
            : conv
        )
      );
    });

    socket.on("messageDeleted", (message) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv._id.toString() === message.conversation.toString()
            ? { ...conv, lastMessageObj: message }
            : conv
        )
      );
    });
    return () => {
      socket.off("conversationUpdated");
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("messageDeleted");
      socket.off("unreadUpdated", handleUnreadUpdated);
    };
  }, [socket, openConversation, user]);

  const filteredConversation = conversations.filter((conv) => {
    if (!conv.lastMessageObj) return false;

    const otherUser = conv.participants.find((p) => p._id !== user._id);
    const searchName = otherUser?.name || conv.name || "";
    return searchName.toLowerCase().includes(searchKey.toLowerCase());
  });

  const openDeleteDialog = (conversationId) => {
    setConversationToDelete(conversationId);
    setDeleteDialog(true);
  };

  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return;
    setDeleteLoading(true);
    try {
      const { data } = await api.delete(
        `/conversation/delete/${conversationToDelete}`,
        {
          withCredentials: true,
        }
      );

      if (data.success) {
        setConversations((prev) =>
          prev.filter((conv) => conv._id !== conversationToDelete)
        );
      }

      if (openConversation === conversationToDelete) {
        setOpenConversation(null);
      }

      toast.success("Conversation deleted successfully.", {
        id: "enroll_error",
      });
    } catch (error) {
      console.log("Error deleting conversation:", error);
      toast.error("Error deleting conversation", {
        id: "enroll_error",
      });
    } finally {
      setDeleteLoading(false);
      setDeleteDialog(false);
      setConversationToDelete(null);
    }
  };

  // render last message
  const getLastMessageText = (conversation) => {
    const msg = conversation.lastMessageObj;
    if (!msg) return "No messages yet.";
    if (msg.attachements?.length > 0) {
      return "Attachment";
    }
    if (msg.text) return msg.text;
    return "No messages yet.";
  };

  return (
    <DashboardLayout>
      <div className="flex overflow-hidden">
        <div className="w-1/4 bg-white border-r border-gray-300 p-4 overflow-y-auto h-[calc(100vh-64px)]">
          <h2 className="text-lg font-semibold mb-4">Your Conversations</h2>

          {/* search */}
          <SearchBar
            placeholder="Search by name..."
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            className="mb-4"
          />

          {loading ? (
            <div className="flex justify-center py-10">
              <LoaderCircle className="size-8 animate-spin text-primary" />
            </div>
          ) : filteredConversation.length === 0 ? (
            <p className="text-gray-500 italic">No conversations found.</p>
          ) : (
            <ul>
              {filteredConversation.map((conv) => {
                const other = conv.participants.find((p) => p._id !== user._id);

                const preview = getLastMessageText(conv);

                const isSender = conv.lastMessageObj?.sender?._id === user._id;

                const avatar = conv.participants.find((p) => p._id !== user._id)
                  ?.avatar?.url;

                const unreadCount = conv.unreadCount || 0;
                console.log("unread: ", conv.unreadCount);

                return (
                  <div key={conv._id}>
                    <Card
                      className={`hover:shadow-md transition-all cursor-pointer mb-2 ${
                        unreadCount ? "bg-blue-50" : "bg-white"
                      }`}
                      onClick={() => {
                        setOpenConversation(conv._id.toString());
                        openConversationRef.current = conv._id.toString();
                        setConversations((prev) =>
                          prev.map((c) =>
                            c._id.toString() === conv._id.toString()
                              ? { ...c, unreadCount: 0 }
                              : c
                          )
                        );
                        socket.emit("markAsRead", {
                          conversationId: conv._id.toString(),
                        });
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteDialog(conv._id);
                        }}
                        className="absolute top-2 right-4 cursor-pointer"
                      >
                        <Trash2
                          size={16}
                          className="stroke-gray-500 hover:stroke-red-600"
                        />
                      </button>

                      <CardContent className="flex items-center gap-3 p-3 relative">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 mr-2">
                          <Avatar>
                            <AvatarImage
                              src={
                                avatar ||
                                "https://res.cloudinary.com/dsfdghxx4/image/upload/v1730813754/nrxsg8sd9iy10bbsoenn_bzlq2c.png"
                              }
                              alt="avatar image"
                            />
                          </Avatar>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{other?.name}</p>
                          <div className="absolute top-1 left-1">
                            {unreadCount > 0 && (
                              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                {unreadCount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center">
                            <p className="text-sm text-gray-600 truncate mr-1 w-[130px]">
                              {isSender ? `You: ${preview}` : preview}
                            </p>

                            <div className="flex items-center gap-2">
                              <p className="text-gray-600 text-xs">
                                {formatTimeMessage(
                                  conv.lastMessageObj?.createdAt
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <DeleteDialog
                      title="Delete Conversation"
                      description="Are you sure you want to delete this conversation? This action cannot be undone!"
                      open={deleteDialog}
                      setOpen={setDeleteDialog}
                      loading={deleteLoading}
                      onConfirm={handleDeleteConversation}
                    />
                  </div>
                );
              })}
            </ul>
          )}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col relative bg-gray-50">
          {openConversation ? (
            <ChatDetail
              conversationId={openConversation}
              onClose={() => setOpenConversation(null)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Select a conversation to start chatting
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ConversationsPage;
