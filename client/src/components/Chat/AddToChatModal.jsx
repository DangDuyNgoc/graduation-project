import { useEffect, useState } from "react";
import { getSocket } from "@/utils/socket";
import { X } from "lucide-react";
import SearchBar from "../Common/SearchBar";
import { Button } from "../ui/button";
import toast from "react-hot-toast";
import { Input } from "../ui/input";
import { useNavigate } from "react-router-dom";
import api from "@/utils/axiosInstance";

export default function AddToChatModal({
  isOpen,
  courseId,
  onClose,
  students,
  participants = [],
  groupName,
  adminId,
  conversationId,
  onGroupUpdated,
}) {
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(groupName || "New Group");

  const [addMembers, setAddMembers] = useState([]);

  const isEdit = Boolean(conversationId);

  const nonMembers = students
    .map((s) => s._id.toString())
    .filter((id) => !participants.includes(id));

  useEffect(() => {
    if (students) setFiltered(students);
  }, [students]);

  useEffect(() => {
    if (groupName) setName(groupName);
  }, [groupName]);

  useEffect(() => {
    setAddMembers([]);
  }, [participants]);

  const navigate = useNavigate();

  useEffect(() => {
    const v = search.toLowerCase();
    if (!v) return setFiltered(students);

    setFiltered(
      students.filter(
        (s) =>
          s.name.toLowerCase().includes(v) || s.email.toLowerCase().includes(v)
      )
    );
  }, [search, students]);

  const socket = getSocket();

  const toggleSelectAdd = (id) => {
    const isMember = participants.includes(id);

    if (isMember) {
      setAddMembers((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    } else {
      setAddMembers((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    }
  };

  const addSelectedToChat = () => {
    if (addMembers.length === 0) {
      toast.error("Select at least 2 members");
      return;
    }
    setLoading(true);

    socket.emit("createGroup", {
      name: groupName,
      participants: [...addMembers, socket.userId],
      adminId: socket.userId,
      courseId,
    });

    socket.once("groupCreatedSuccess", () => {
      setLoading(false);
      onClose();
      toast.success("Group Created!");
    });

    navigate("/conversations");
  };

  const addAllToChat = async () => {
    if (!conversationId) return;
    setLoading(true);

    const allIds = students
      .map((s) => s._id.toString())
      .filter((id) => !participants.includes(id));

    if (allIds.length === 0) {
      toast.error("No members left to add");
      setLoading(false);
      return;
    }

    socket.emit("addMembers", {
      conversationId,
      newMembers: allIds,
    });

    socket.once("addMembersSuccess", (updated) => {
      toast.success(`Added ${allIds.length} members!`);
      onGroupUpdated(updated);
      setLoading(false);
      onClose();
    });

    socket.once("error", (err) => {
      toast.error(err.message || "Failed to add members");
      setLoading(false);
    });
  };

  const addMembersToGroup = () => {
    if (addMembers.length === 0) {
      toast.error("Select members first");
      return;
    }

    setLoading(true);

    socket.emit("addMembers", {
      conversationId,
      newMembers: addMembers,
    });

    socket.once("addMembersSuccess", (updated) => {
      toast.success("Members added!");
      onGroupUpdated(updated);
      setAddMembers([]);
      setLoading(false);
      onClose();
    });

    socket.once("addMembersFailed", (msg) => {
      toast.error(msg || "Failed");
      setLoading(false);
    });
  };

  const updateGroup = async () => {
    try {
      setLoading(true);
      const { data } = await api.put(`/conversation/update/${conversationId}`, {
        name,
        membersToAdd: addMembers,
      });

      if (data.success) {
        toast.success("Group updated");
        onGroupUpdated(data.conversation);
        onClose();
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (isEdit) updateGroup();
    else addSelectedToChat();
  };

  const handleRemoveMember = (memberId) => {
    if (!conversationId) {
      return;
    }
    setLoading(true);

    socket.emit("removeMembers", {
      conversationId,
      memberId,
    });

    socket.once("memberRemoved", ({ updatedConversation }) => {
      toast.success("Members removed!");
      onGroupUpdated(updatedConversation);
      setLoading(false);
    });

    socket.once("error", ({ message }) => {
      toast.error(message || "Remove failed");
      setLoading(false);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50 px-4">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-lg p-6 relative">
        <button
          className="cursor-pointer absolute top-3 right-3 text-gray-500 hover:text-black"
          onClick={onClose}
        >
          <X size={22} />
        </button>

        <h2 className="text-xl font-semibold mb-4">
          {isEdit ? "Update Group" : "Create Group"}
        </h2>

        {/* Search */}
        <SearchBar
          placeholder="Search name or email......"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="mb-2">
          <label className="block text-sm font-medium mb-1">Group Name</label>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter group name..."
          />
        </div>

        {/* Student List */}
        <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
          {filtered.map((s) => {
            const isMember = participants.includes(s._id.toString());
            const markedAdd = addMembers.includes(s._id);
            const isAdmin = s._id.toString() === adminId;
            return (
              <div
                key={s._id}
                className="flex items-center gap-3 p-3 hover:bg-gray-50 relative"
              >
                {/* add checkbox */}
                {!isMember && (
                  <input
                    type="checkbox"
                    disabled={isMember}
                    checked={markedAdd}
                    onChange={() => toggleSelectAdd(s._id)}
                    className={`h-4 w-4 cursor-pointer ${
                      isMember ? "tex-red-500" : "text-green-500"
                    }`}
                  />
                )}

                <img
                  src={
                    s.avatar?.url ||
                    "https://res.cloudinary.com/dsfdghxx4/image/upload/v1730813754/nrxsg8sd9iy10bbsoenn_bzlq2c.png"
                  }
                  className="w-10 h-10 rounded-full object-cover"
                />

                <div>
                  <div className="font-medium">{s.name}</div>

                  <div className="text-sm text-gray-500">{s.email}</div>

                  {isMember && !isAdmin && (
                    <span className="text-xs text-primary font-medium">
                      Already in Chat
                    </span>
                  )}
                </div>
                {isMember && (
                  <div className="absolute top-1 right-4">
                    {isAdmin ? (
                      <span className="text-xs text-blue-600 font-medium">
                        Admin
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRemoveMember(s._id)}
                        className="text-red-500 cursor-pointer text-xs font-semibold hover:text-red-600"
                        disabled={loading}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="flex justify-between mt-5">
          {isEdit && addMembers.length > 0 && (
            <Button onClick={addMembersToGroup} disabled={loading}>
              {loading ? "Adding..." : `Add ${addMembers.length} Members`}
            </Button>
          )}

          {isEdit && nonMembers.length > 0 && (
            <Button onClick={addAllToChat} disabled={loading} variant="outline">
              {loading ? "Adding..." : "Add All Members"}
            </Button>
          )}

          {isEdit && addMembers.length === 0 && (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          )}

          {!isEdit && (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Saving..." : "Create Group"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
