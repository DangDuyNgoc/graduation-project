// import { Groq } from "groq-sdk";
// import CourseModel from "../models/courseModel.js";
// import AssignmentModel from "../models/assignmentModel.js";
// import SubmissionModel from "../models/submissionModel.js";
// import UserModel from "../models/userModel.js";
// import { logError } from "../utils/logger.js";

// const groq = new Groq();

// const normalize = (text = "") =>
//   text
//     .toString()
//     .normalize("NFD")
//     .replace(/[\u0300-\u036f]/g, "")
//     .replace(/[đĐ]/g, "d")
//     .toLowerCase()
//     .trim();

// const extractAfterKeyword = (raw, keywords) => {
//   const lower = normalize(raw);
//   for (const kw of keywords) {
//     const idx = lower.indexOf(normalize(kw));
//     if (idx !== -1) {
//       const sub = raw.slice(idx + kw.length).trim();
//       return sub.split(/[?.,!]/)[0].trim();
//     }
//   }
//   return null;
// };

// const fuzzyFindUser = async (name, role) => {
//   if (!name) return null;
//   const re = new RegExp(name.trim(), "i");
//   let q = { name: re };
//   if (role) q.role = role;
//   let u = await UserModel.findOne(q).select("name role");
//   if (u) return u;
//   const all = await UserModel.find(role ? { role } : {}).select("name role");
//   const target = normalize(name);
//   for (const cand of all) {
//     if (normalize(cand.name).includes(target)) return cand;
//   }
//   return null;
// };

// const fuzzyFindCourse = async (name) => {
//   if (!name) return null;
//   const re = new RegExp(name.trim(), "i");
//   let c = await CourseModel.findOne({ name: re })
//     .populate("teacherId", "name")
//     .populate("studentIds");
//   if (c) return c;
//   const all = await CourseModel.find()
//     .populate("teacherId", "name")
//     .populate("studentIds");
//   const target = normalize(name);
//   for (const cand of all) {
//     if (normalize(cand.name).includes(target)) return cand;
//   }
//   return null;
// };

// const fuzzyFindAssignment = async (title) => {
//   if (!title) return null;
//   const re = new RegExp(title.trim(), "i");
//   let a = await AssignmentModel.findOne({ title: re })
//     .populate("createdBy", "name")
//     .populate("courseId", "name teacherId studentIds materials");
//   if (a) return a;
//   const all = await AssignmentModel.find()
//     .populate("createdBy", "name")
//     .populate("courseId", "name teacherId studentIds materials");
//   const target = normalize(title);
//   for (const cand of all) {
//     if (normalize(cand.title).includes(target)) return cand;
//   }
//   return null;
// };

// export const getChatbotReply = async (messageText) => {
//   try {
//     const raw = (messageText || "").trim();
//     const lower = normalize(raw);
//     const isVietnamese =
//       /(bao nhieu|bao nhiêu|tổng|tong|giảng viên|giang vien|khóa học|khoa hoc|bài tập|baitap|sinh viên|sinhvien|nộp|nop|submission)/.test(
//         lower
//       );
//     const isCount =
//       /(how many|number of|bao nhieu|tong so|tổng số|có bao nhiêu|co bao nhieu|liệt kê|liet ke|danh sách|danhsach|list|show)/.test(
//         lower
//       );

//     const mentionsCourse = /(course|courses|khoa hoc|khoahoc)/i.test(lower);
//     const mentionsAssignment = /(assignment|assignments|bai tap|baitap)/i.test(
//       lower
//     );
//     const mentionsStudent = /(student|students|sinh vien|sinhvien)/i.test(
//       lower
//     );
//     const mentionsTeacher = /(teacher|lecturer|giang vien|giảng viên)/i.test(
//       lower
//     );
//     const mentionsSubmission = /(submission|submissions|nop bai|nộp bài)/i.test(
//       lower
//     );

//     if (isCount) {
//       if (mentionsCourse) {
//         const teacherName = extractAfterKeyword(raw, [
//           "giảng viên",
//           "teacher",
//           "lecturer",
//         ]);
//         if (teacherName) {
//           const teacher = await fuzzyFindUser(teacherName, "TEACHER");
//           if (!teacher)
//             return isVietnamese
//               ? `Không tìm thấy giảng viên ${teacherName}.`
//               : `Teacher ${teacherName} not found.`;
//           const count = await CourseModel.countDocuments({
//             teacherId: teacher._id,
//           });
//           return isVietnamese
//             ? `Giảng viên ${teacher.name} hiện có ${count} khóa học.`
//             : `Teacher ${teacher.name} currently has ${count} courses.`;
//         }
//         const total = await CourseModel.countDocuments();
//         return isVietnamese
//           ? `Tổng số khóa học trong hệ thống: ${total}.`
//           : `Total courses in the system: ${total}.`;
//       }

//       if (mentionsAssignment) {
//         const courseName = extractAfterKeyword(raw, [
//           "course",
//           "khoa hoc",
//           "trong khóa học",
//           "của khóa học",
//         ]);
//         if (courseName) {
//           const course = await fuzzyFindCourse(courseName);
//           if (!course)
//             return isVietnamese
//               ? `Không tìm thấy khóa học ${courseName}.`
//               : `Course ${courseName} not found.`;
//           const count = await AssignmentModel.countDocuments({
//             courseId: course._id,
//           });
//           return isVietnamese
//             ? `Khóa học ${course.name} có ${count} bài tập.`
//             : `Course ${course.name} has ${count} assignments.`;
//         }
//         const teacherName = extractAfterKeyword(raw, [
//           "giảng viên",
//           "teacher",
//           "lecturer",
//         ]);
//         if (teacherName) {
//           const teacher = await fuzzyFindUser(teacherName, "TEACHER");
//           if (!teacher)
//             return isVietnamese
//               ? `Không tìm thấy giảng viên ${teacherName}.`
//               : `Teacher ${teacherName} not found.`;
//           const courses = await CourseModel.find({ teacherId: teacher._id });
//           const ids = courses.map((c) => c._id);
//           const count = await AssignmentModel.countDocuments({
//             courseId: { $in: ids },
//           });
//           return isVietnamese
//             ? `Giảng viên ${teacher.name} có ${count} bài tập trong các khóa học họ dạy.`
//             : `Teacher ${teacher.name} has ${count} assignments across their courses.`;
//         }
//         const total = await AssignmentModel.countDocuments();
//         return isVietnamese
//           ? `Tổng số bài tập trong hệ thống: ${total}.`
//           : `Total assignments in the system: ${total}.`;
//       }

//       if (mentionsStudent) {
//         const courseName = extractAfterKeyword(raw, [
//           "course",
//           "khoa hoc",
//           "trong khóa học",
//           "của khóa học",
//         ]);
//         if (courseName) {
//           const course = await fuzzyFindCourse(courseName);
//           if (!course)
//             return isVietnamese
//               ? `Không tìm thấy khóa học ${courseName}.`
//               : `Course ${courseName} not found.`;
//           return isVietnamese
//             ? `Khóa học ${course.name} có ${
//                 course.studentIds?.length || 0
//               } sinh viên.`
//             : `Course ${course.name} has ${
//                 course.studentIds?.length || 0
//               } students.`;
//         }
//         const total = await UserModel.countDocuments({ role: "STUDENT" });
//         return isVietnamese
//           ? `Tổng số sinh viên trong hệ thống: ${total}.`
//           : `Total students in the system: ${total}.`;
//       }

//       if (mentionsSubmission) {
//         const assignmentName = extractAfterKeyword(raw, [
//           "assignment",
//           "bai tap",
//         ]);
//         if (assignmentName && mentionsStudent) {
//           const assignment = await fuzzyFindAssignment(assignmentName);
//           if (!assignment)
//             return isVietnamese
//               ? `Không tìm thấy bài tập ${assignmentName}.`
//               : `Assignment ${assignmentName} not found.`;
//           const students = await SubmissionModel.distinct("student", {
//             assignment: assignment._id,
//           });
//           return isVietnamese
//             ? `Có ${students.length} sinh viên đã nộp bài "${assignment.title}".`
//             : `${students.length} students have submitted "${assignment.title}".`;
//         }
//         if (assignmentName) {
//           const assignment = await fuzzyFindAssignment(assignmentName);
//           const count = await SubmissionModel.countDocuments({
//             assignment: assignment._id,
//           });
//           return isVietnamese
//             ? `Bài tập "${assignment.title}" có ${count} lượt nộp.`
//             : `Assignment "${assignment.title}" has ${count} submissions.`;
//         }
//         const total = await SubmissionModel.countDocuments();
//         return isVietnamese
//           ? `Tổng số bài nộp trong hệ thống: ${total}.`
//           : `Total submissions in the system: ${total}.`;
//       }
//     }

//     if (mentionsCourse && /(ai day|who teach|who teaches)/i.test(lower)) {
//       const courseName = extractAfterKeyword(raw, [
//         "course",
//         "khoa hoc",
//         "trong khóa học",
//         "của khóa học",
//       ]);
//       if (courseName) {
//         const course = await fuzzyFindCourse(courseName);
//         if (!course)
//           return isVietnamese
//             ? `Không tìm thấy khóa học ${courseName}.`
//             : `Course ${courseName} not found.`;
//         return isVietnamese
//           ? `Khóa học ${course.name} do giảng viên ${course.teacherId?.name} phụ trách.`
//           : `Course ${course.name} is taught by ${course.teacherId?.name}.`;
//       }
//     }

//     const teacherName = extractAfterKeyword(raw, [
//       "giảng viên",
//       "teacher",
//       "lecturer",
//     ]);
//     if (teacherName) {
//       const teacher = await fuzzyFindUser(teacherName, "TEACHER");
//       if (!teacher)
//         return isVietnamese
//           ? `Không tìm thấy giảng viên ${teacherName}.`
//           : `Teacher ${teacherName} not found.`;
//       const courses = await CourseModel.find({ teacherId: teacher._id });
//       if (!courses.length)
//         return isVietnamese
//           ? `Giảng viên ${teacher.name} chưa dạy khóa học nào.`
//           : `Teacher ${teacher.name} has no courses.`;
//       const list = courses.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
//       return isVietnamese
//         ? `Các khóa học của giảng viên ${teacher.name}:\n${list}`
//         : `Courses taught by ${teacher.name}:\n${list}`;
//     }

//     const courseName = extractAfterKeyword(raw, [
//       "course",
//       "khoa hoc",
//       "trong khóa học",
//       "của khóa học",
//     ]);
//     if (courseName) {
//       const course = await fuzzyFindCourse(courseName);
//       if (!course)
//         return isVietnamese
//           ? `Không tìm thấy khóa học ${courseName}.`
//           : `Course ${courseName} not found.`;
//       const assignments = await AssignmentModel.find({ courseId: course._id });
//       const assignText = assignments.length
//         ? assignments.map((a, i) => `${i + 1}. ${a.title}`).join("\n")
//         : isVietnamese
//         ? "Không có bài tập."
//         : "No assignments.";
//       return isVietnamese
//         ? `Khóa học: ${course.name}\nGiảng viên: ${
//             course.teacherId?.name
//           }\nSố sinh viên: ${
//             course.studentIds?.length || 0
//           }\nBài tập:\n${assignText}`
//         : `Course: ${course.name}\nTeacher: ${
//             course.teacherId?.name
//           }\nStudents: ${
//             course.studentIds?.length || 0
//           }\nAssignments:\n${assignText}`;
//     }

//     const assignmentName = extractAfterKeyword(raw, ["assignment", "bai tap"]);
//     if (assignmentName) {
//       const assignment = await fuzzyFindAssignment(assignmentName);
//       if (!assignment)
//         return isVietnamese
//           ? `Không tìm thấy bài tập ${assignmentName}.`
//           : `Assignment ${assignmentName} not found.`;
//       const count = await SubmissionModel.countDocuments({
//         assignment: assignment._id,
//       });
//       return isVietnamese
//         ? `Bài tập: ${assignment.title}\nKhóa học: ${
//             assignment.courseId?.name
//           }\nGiảng viên: ${assignment.courseId?.teacherId?.name}\nHạn nộp: ${
//             assignment.dueDate?.toLocaleString() || "N/A"
//           }\nSố lượt nộp: ${count}`
//         : `Assignment: ${assignment.title}\nCourse: ${
//             assignment.courseId?.name
//           }\nTeacher: ${assignment.courseId?.teacherId?.name}\nDue: ${
//             assignment.dueDate?.toLocaleString() || "N/A"
//           }\nSubmissions: ${count}`;
//     }

//     const studentName = extractAfterKeyword(raw, [
//       "student",
//       "sinh vien",
//       "sinhvien",
//     ]);
//     if (studentName) {
//       const student = await fuzzyFindUser(studentName, "STUDENT");
//       if (!student)
//         return isVietnamese
//           ? `Không tìm thấy sinh viên ${studentName}.`
//           : `Student ${studentName} not found.`;
//       const subs = await SubmissionModel.find({
//         student: student._id,
//       }).populate("assignment", "title");
//       if (!subs.length)
//         return isVietnamese
//           ? `Sinh viên ${student.name} chưa nộp bài nào.`
//           : `Student ${student.name} has no submissions.`;
//       const list = subs
//         .map(
//           (s, i) =>
//             `${i + 1}. ${s.assignment?.title || "N/A"} - ${s.status || "N/A"}`
//         )
//         .join("\n");
//       return isVietnamese
//         ? `Các bài đã nộp của ${student.name}:\n${list}`
//         : `Submissions of ${student.name}:\n${list}`;
//     }

//     return await (async () => {
//       const chatCompletion = await groq.chat.completions.create({
//         model: "openai/gpt-oss-20b",
//         messages: [
//           {
//             role: "system",
//             content: `You are an AI assistant for a learning system. Only answer based on the provided system data. Respond in the same language as the user.`,
//           },
//           { role: "user", content: raw },
//         ],
//         temperature: 0.6,
//         max_completion_tokens: 1500,
//       });

//       const gptReply = chatCompletion.choices?.[0]?.message?.content?.trim();
//       if (gptReply) return gptReply;

//       return isVietnamese
//         ? "Vui lòng cung cấp rõ tên khóa học, bài tập, giảng viên hoặc sinh viên để tôi có thể trả lời chính xác hơn."
//         : "Please provide a specific course, assignment, teacher or student name for a more accurate answer.";
//     })();
//   } catch (err) {
//     logError(err);
//     throw new Error("Chatbot internal error");
//   }
// };
