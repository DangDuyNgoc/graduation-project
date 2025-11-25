import { addStudentTeacherCourses, getAllStudent } from "@/api/courseApi";
import LoadingSpinner from "@/components/Common/LoadingSpinner";
import SearchBar from "@/components/common/SearchBar";
import DashboardLayout from "@/layout/Dashboard";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";

export default function TeacherEnrolStudent() {
  const { id } = useParams();
  const [students, setStudents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [visibleCount, setVisibleCount] = useState(15);
  const [emailsInput, setEmailsInput] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const res = await getAllStudent({ courseId: id });
      const data = res.students || [];
      setStudents(data);
      setFiltered(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      if (search.trim() === "") {
        setFiltered(students);
      } else {
        const value = search.toLowerCase();
        setFiltered(
          students.filter(
            (s) =>
              s.name.toLowerCase().includes(value) ||
              s.email.toLowerCase().includes(value)
          )
        );
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [search, students]);

  const handleSearch = (e) => setSearch(e.target.value);

  const handleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleLoadMore = () => setVisibleCount((prev) => prev + 15);

  const handleBulkAdd = async () => {
    const emailsFromInput = emailsInput
      .split(/\s|,|;/)
      .map((e) => e.trim())
      .filter(Boolean);

    const selectedEmails = students
      .filter((s) => selected.includes(s._id))
      .map((s) => s.email);

    const allEmails = [...new Set([...emailsFromInput, ...selectedEmails])];

    if (allEmails.length === 0) {
      toast.error("Please select or enter at least one student.");
      return;
    }

    try {
      setLoading(true);
      const res = await addStudentTeacherCourses(id, allEmails);

      if (res.success) {
        toast.success(res.message || "Students added successfully!");

        setStudents((prev) => prev.filter((s) => !allEmails.includes(s.email)));
        setFiltered((prev) => prev.filter((s) => !allEmails.includes(s.email)));

        setEmailsInput("");
        setSelected([]);
      } else {
        toast.error(res.message || "Failed to add students.");
      }
    } catch (err) {
      toast.error("An error occurred while adding students.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Enroll Students</h2>
        </div>

        <SearchBar
          placeholder="Search students by name or email..."
          value={search}
          onChange={handleSearch}
        />

        {loading ? (
          <LoadingSpinner text="Loading..." className="py-20" />
        ) : (
          <>
            {filtered.length === 0 ? (
              <p className="text-center text-gray-500 mt-4">
                No students found.
              </p>
            ) : (
              <table className="w-full border border-gray-300 border-collapse text-sm">
                <thead className="bg-gray-100 text-left">
                  <tr>
                    <th className="p-2 border border-gray-300 w-12">#</th>
                    <th className="p-2 border border-gray-300">Name</th>
                    <th className="p-2 border border-gray-300">Email</th>
                    <th className="p-2 border border-gray-300">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visibleCount).map((s) => (
                    <tr key={s._id} className="hover:bg-gray-50">
                      <td className="p-2 border border-gray-300 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-blue-600 cursor-pointer"
                          checked={selected.includes(s._id)}
                          onChange={() => handleSelect(s._id)}
                        />
                      </td>
                      <td className="p-2 border border-gray-300">{s.name}</td>
                      <td className="p-2 border border-gray-300">{s.email}</td>
                      <td className="p-2 border border-gray-300">
                        {s.phone || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {visibleCount < filtered.length && (
              <div className="text-center mt-4">
                <button
                  className="px-4 py-2 border border-gray-400 hover:bg-gray-100 text-sm font-medium transition rounded-md"
                  onClick={handleLoadMore}
                >
                  Load more
                </button>
              </div>
            )}

            <div className="mt-8 border-t pt-4">
              <h3 className="font-semibold mb-2">Add students by email</h3>

              <textarea
                placeholder="Paste multiple emails here (space, comma, or newline)..."
                value={emailsInput}
                onChange={(e) => setEmailsInput(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm resize-none rounded-md"
              ></textarea>

              <div className="flex justify-between mt-3">
                <button
                  onClick={() => navigate(`/teacher-enrolled-student/${id}`)}
                  className="px-5 py-2 bg-black text-white hover:opacity-65 transition text-sm rounded-lg shadow-sm"
                >
                  Back
                </button>
                <button
                  className="px-5 py-2 bg-blue-600 text-white hover:bg-blue-700 transition text-sm rounded-lg shadow-sm disabled:opacity-50"
                  onClick={handleBulkAdd}
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Add Students"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
