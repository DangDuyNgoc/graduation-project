import { useEffect, useState } from "react";
import { getSocket } from "@/utils/socket";
import { X } from "lucide-react";
import SearchBar from "../Common/SearchBar";
import { Button } from "../ui/button";
import toast from "react-hot-toast";
import { Input } from "../ui/input";
import { useNavigate } from "react-router-dom";

export default function AddToChatModal({
  isOpen,
  courseId,
  onClose,
  students,
  participants = [],
}) {
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [groupName, setGroupName] = useState("New Group");

  useEffect(() => {
    if (students) setFiltered(students);
    console.log(students);
  }, [students]);

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

  const toggleSelect = (id) => {
    if (participants.includes(id)) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const addSelectedToChat = () => {
    if (selected.length === 0) return;
    setLoading(true);

    socket.emit("createGroup", {
      name: groupName,
      participants: [...selected, socket.userId],
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

  const addAllToChat = () => {
    const allIds = students
      .map((s) => s._id)
      .filter((id) => !participants.includes(id));

    if (allIds.length === 0) return;

    setLoading(true);

    socket.emit("createGroup", {
      name: groupName,
      participants: [...allIds, socket.userId],
      adminId: socket.userId,
      courseId,
    });

    socket.once("groupCreatedSuccess", () => {
      setLoading(false);
      setSelected([]);
      onClose();
      toast.success("Group Created!");
    });

    navigate("/conversations");
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

        <h2 className="text-xl font-semibold mb-4">Add Students to Chat</h2>

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
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Enter group name..."
          />
        </div>

        {/* Student List */}
        <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
          {filtered.map((s) => {
            const disabled = participants.includes(s._id.toString());
            console.log(disabled);
            return (
              <div
                key={s._id}
                className="flex items-center gap-3 p-3 hover:bg-gray-50"
              >
                {!disabled && (
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={selected.includes(s._id)}
                    onChange={() => toggleSelect(s._id)}
                    className={`h-4 w-4 cursor-pointer ${
                      disabled ? "opacity-50" : ""
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

                  {disabled && (
                    <span className="text-xs text-primary font-medium">
                      Already in chat
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div className="flex justify-between mt-5">
          <Button
            onClick={addAllToChat}
            disabled={
              loading || students.every((s) => participants.includes(s._id))
            }
          >
            {loading ? "Adding..." : "Add All"}
          </Button>

          <Button
            onClick={addSelectedToChat}
            disabled={selected.length === 0 || loading}
          >
            {loading ? "Adding..." : "Add Selected"}
          </Button>
        </div>
      </div>
    </div>
  );
}
