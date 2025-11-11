import ChatDetail from "@/components/Chat/ChatDetail";
import { Card, CardContent } from "@/components/ui/card";
import { UserContext } from "@/context/UserContext";
import DashboardLayout from "@/layout/Dashboard";
import api from "@/utils/axiosInstance";
import { formatTimeMessage } from "@/utils/timeFormatter";
import { Avatar, AvatarImage } from "@radix-ui/react-avatar";
import { LoaderCircle, MessageSquare } from "lucide-react";
import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";

const ConversationsPage = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openConversation, setOpenConversation] = useState(null);
  const { user } = useContext(UserContext);

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
        console.log(data.conversations);
        setConversations(data.conversations);
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

  return (
    <DashboardLayout>
      <div className="flex overflow-hidden">
        <div className="w-1/4 bg-white border-r border-gray-300 p-4 overflow-y-auto h-[calc(100vh-64px)]">
          <h2 className="text-lg font-semibold mb-4">Your Conversations</h2>
          {loading ? (
            <div className="flex justify-center py-10">
              <LoaderCircle className="size-8 animate-spin text-primary" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-gray-500 italic">No conversations found.</p>
          ) : (
            <ul>
              {conversations.map((conv) => {
                const otherUser = conv.participants.find(
                  (p) => p._id !== user._id
                );

                const unreadObj = conv.unreadMessages?.find(
                  (um) => um.user === user._id
                );
                const unreadCount = unreadObj?.count || 0;

                return (
                  <Card
                    key={conv._id}
                    // className="hover:shadow-md transition-all cursor-pointer mb-2"
                    className={`hover:shadow-md transition-all cursor-pointer mb-2 ${
                      unreadCount ? "bg-blue-50" : "bg-white"
                    }`}
                    onClick={() => setOpenConversation(conv._id)}
                  >
                    <CardContent className="flex items-center gap-3 p-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage
                          src={
                            otherUser?.avatar?.url ||
                            "https://res.cloudinary.com/dsfdghxx4/image/upload/v1730813754/nrxsg8sd9iy10bbsoenn_bzlq2c.png"
                          }
                          alt="avatar image"
                        />
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">
                          {otherUser?.name || conv.name}
                        </p>
                        <div className="flex items-center">
                          <p className="text-sm text-gray-600 truncate mr-1 w-[140px]">
                            {conv.lastMessageSender === user._id
                              ? `You: ${conv.lastMessage}`
                              : conv.lastMessage || "No messages yet"}
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

                          {/* <p className="text-gray-600 text-xs">
                            {formatTimeMessage(conv.lastMessageAt)}
                          </p> */}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
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
