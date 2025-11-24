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
import React, { useContext, useEffect, useState } from "react";
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

  useEffect(() => {
    socket.on("receiveMessage", (message) => {
      setConversationToDelete((prev) => {
        const convExists = prev.some(
          (conv) => conv._id.toString() === message.conversation.toString()
        );

        if (!convExists) {
          return [
            {
              _id: message.conversation.toString(),
              lastMessage: message.text,
              lastMessageAt: message.createdAt,
              lastMessageSender: message.sender._id,
              participants: [user._id, message.sender._id],
            },
            ...prev,
          ];
        }
      });
    });

    // update conversation
    socket.on(
      "conversationUpdated",
      ({ conversationId, lastMessage, lastMessageAt, lastMessageSender }) => {
        setConversations((prev) =>
          prev.map((conv) =>
            conv._id === conversationId
              ? { ...conv, lastMessage, lastMessageAt, lastMessageSender }
              : conv
          )
        );
      }
    );

    // socket.on("receiveMessage", (message) => {
    //   setConversations((prev) => {
    //     const convExists = prev.some(
    //       (conv) => conv._id.toString() === message.conversation.toString()
    //     );
    //     if (!convExists) {
    //       return [
    //         {
    //           _id: message.conversation.toString(),
    //           lastMessage: message.text,
    //           lastMessageAt: message.createdAt,
    //           lastMessageSender: message.sender._id,
    //           participants: [user._id, message.sender._id],
    //         },
    //         ...prev,
    //       ];
    //     }
    //     return prev.map((conv) =>
    //       conv._id.toString() === message.conversation.toString()
    //         ? {
    //             ...conv,
    //             lastMessage: message.text,
    //             lastMessageAt: message.createdAt,
    //             lastMessageSender: message.sender._id,
    //           }
    //         : conv
    //     );
    //   });
    // });

    socket.on("messageDeleted", (updated) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv._id === updated.conversation.toString()
            ? { ...conv, lastMessage: updated.text }
            : conv
        )
      );
    });
    return () => {
      socket.off("conversationUpdated");
      socket.off("receiveMessage");
      socket.off("messageDeleted");
    };
  }, []);

  const filteredConversation = conversations.filter((conv) => {
    const otherUser = conv.participants.find((p) => p._id !== user._id);
    const searchName = otherUser?.name || conv.name || "";
    return searchName.toLowerCase().includes(searchKey.toLowerCase());
  });

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
        setConversations(data.conversations.filter((conv) => conv.lastMessage));
      }
    } catch (error) {
      console.log("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user._id]);

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
                const displayName = conv.participants.find(
                  (p) => p._id !== user._id
                )?.name;

                const avatar = conv.participants.find((p) => p._id !== user._id)
                  ?.avatar?.url;

                const unreadObj = conv.unreadMessages?.find(
                  (um) => um.user === user._id
                );
                const unreadCount = unreadObj?.count || 0;

                return (
                  <div className="relative" key={conv._id}>
                    <Card
                      className={`hover:shadow-md transition-all cursor-pointer mb-2 ${
                        unreadCount ? "bg-blue-50" : "bg-white"
                      }`}
                      onClick={() => setOpenConversation(conv._id)}
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

                      <CardContent className="flex items-center gap-3 p-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage
                            src={
                              avatar ||
                              "https://res.cloudinary.com/dsfdghxx4/image/upload/v1730813754/nrxsg8sd9iy10bbsoenn_bzlq2c.png"
                            }
                            alt="avatar image"
                          />
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold">{displayName}</p>
                          <div className="flex items-center">
                            <p className="text-sm text-gray-600 truncate mr-1 w-[140px]">
                              {conv.lastMessageSender === user._id
                                ? `You: ${conv.lastMessage}`
                                : conv.lastMessage}
                            </p>

                            <div className="flex items-center gap-2">
                              {unreadCount > 0 && (
                                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                  {unreadCount}
                                </span>
                              )}
                              <p className="text-gray-600 text-xs">
                                {formatTimeMessage(conv.lastMessageAt)}
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
