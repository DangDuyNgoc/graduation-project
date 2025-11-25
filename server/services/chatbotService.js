import { Groq } from "groq-sdk";
import Fuse from "fuse.js";
import AssignmentModel from "../models/assignmentModel.js";
import chatbotMessageModel from "../models/chatbotMessageModel.js";
import CourseModel from "../models/courseModel.js";
import SubmissionModel from "../models/submissionModel.js";
import UserModel from "../models/userModel.js";
import { logError } from "../utils/logger.js";

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Conversation Cache
const conversationCache = new Map();

// Normalize Text
const normalize = (text = "") => text.toLowerCase().trim();

// Language Detection
const detectLanguage = (text = "") => {
  const vietnameseChars =
    /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
  if (vietnameseChars.test(text)) return "vi";

  const enChars = text.replace(/[^a-zA-Z]/g, "").length;
  const viChars = text.replace(/[a-zA-Z]/g, "").length;
  return enChars >= viChars ? "en" : "vi";
};

// Conversation Context
export const getConversationContext = async (userId, conversationId) => {
  if (conversationCache.has(userId)) return conversationCache.get(userId);

  const messages = await chatbotMessageModel
    .find({ conversation: conversationId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const reversed = messages.reverse();
  let langScore = { en: 0, vi: 0 };
  reversed.forEach((m) => {
    const lang = detectLanguage(m.text);
    langScore[lang]++;
  });
  const dominantLang = langScore.en >= langScore.vi ? "en" : "vi";

  const context = reversed
    .map((m) => `[${m.senderType}]: ${m.text}`)
    .join("\n");

  const result = { context, language: dominantLang };
  conversationCache.set(userId, result);
  return result;
};

export const clearConversationCache = (userId) => {
  conversationCache.delete(userId);
};

// Fuzzy Search Helpers
const fuzzyFindUser = async (name, role) => {
  if (!name) return null;
  const all = await UserModel.find(role ? { role } : {}).select("name role");
  const fuse = new Fuse(all, { keys: ["name"], threshold: 0.3 });
  const result = fuse.search(name.trim());
  return result[0]?.item || null;
};

const fuzzyFindCourse = async (name) => {
  if (!name) return null;
  const all = await CourseModel.find()
    .populate("teacherId", "name")
    .populate({ path: "studentIds", select: "name _id" });
  const fuse = new Fuse(all, { keys: ["name"], threshold: 0.3 });
  const result = fuse.search(name.trim());
  return result[0]?.item || null;
};

const fuzzyFindAssignment = async (title) => {
  if (!title) return null;
  const all = await AssignmentModel.find()
    .populate("createdBy", "name")
    .populate({
      path: "courseId",
      select: "name teacherId studentIds materials",
    });
  const fuse = new Fuse(all, { keys: ["title"], threshold: 0.3 });
  const result = fuse.search(title.trim());
  return result[0]?.item || null;
};

// Analyze Query via GPT OSS
const analyzeQuery = async (userId, messageText, conversationId) => {
  try {
    const { context, language } = await getConversationContext(
      userId,
      conversationId
    );

    const prompt = `
You are a professional bilingual study assistant (Vietnamese-English).
Your task is to extract structured intent, entity, and filters from the user's message.
Return strictly JSON only. Do not add any explanations or text.
Always include all keys: "intent", "entity", "filters", "language".
Use null for any missing or unknown values.
If the message is small talk, greetings, thanks, or unrelated to database, return null.
If unsure about database info, return null instead of guessing.

Previous conversation:
${context}

User asked: "${messageText}"

EXAMPLES:
- "Giảng viên A dạy bao nhiêu khóa học?" -> {"intent": "count", "entity": "course", "filters": {"teacher": "Giảng viên A"}, "language": "vi"}
- "Hôm nay có bao nhiêu bài tập mới?" -> {"intent": "count", "entity": "assignment", "filters": null, "language": "vi"}
- "Ai là giảng viên của khóa học ABC?" -> {"intent": "info", "entity": "course", "filters": {"course": "ABC"}, "language": "vi"}
- "Tôi muốn biết danh sách sinh viên của khóa Maths 101" -> {"intent": "list", "entity": "student", "filters": {"course": "Maths 101"}, "language": "vi"}
- "Tất cả khóa học trong hệ thống" -> {"intent": "list", "entity": "course", "filters": null, "language": "vi"}
- "Tên tất cả bài tập trong khóa Course 01" -> {"intent":"list","entity":"assignment","filters":{"course":"Course 01"},"language":"vi"}
- "What is the name of assignments in Course 01?" -> {"intent":"list","entity":"assignment","filters":{"course":"Course 01"},"language":"en"}
- "Ai là giảng viên của bài tập Lab 2?" -> {"intent":"info","entity":"assignment","filters":{"assignment":"Lab 2"},"language":"vi"}
- "List all courses" -> {"intent": "list", "entity": "course", "filters": null, "language": "en"}
- "List all assignments" -> {"intent": "list", "entity": "assignment", "filters": null, "language": "en"}
- "What's the submission count for Assignment X?" -> {"intent": "count", "entity": "submission", "filters": {"assignment": "Assignment X"}, "language": "en"}
- "Which students submitted Lab 3?" -> {"intent": "list", "entity": "submission", "filters": {"assignment": "Lab 3"}, "language": "en"}
- "Xin chào" -> null
- "Cảm ơn, bạn nhé" -> null
- "Hôm nay trời đẹp quá" -> null

Rules:
- Always detect language correctly: set "language" to "vi" or "en" matching the user's message.
- Only respond in JSON, nothing else.
`;

    const completion = await groqClient.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: "You are a structured data extractor." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_completion_tokens: 350,
    });

    const text = completion.choices[0]?.message?.content || "{}";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);

    console.log("Parsed query:", parsed);
    return parsed;
  } catch (err) {
    logError(err);
    return null;
  }
};

// Query MongoDB Based on Parsed JSON
const queryDB = async (parsed, detectedLang = "en") => {
  if (!parsed) return null;
  const { intent, entity, filters, language } = parsed;
  const lang = language || detectedLang;
  const t = (vi, en) => (lang === "vi" ? vi : en || vi);

  try {
    // count/info queries
    if (intent === "count" || intent === "info") {
      if ((entity === "course" || entity === "teacher") && filters?.teacher) {
        const teacher = await fuzzyFindUser(filters.teacher, "TEACHER");
        if (!teacher)
          return t(
            `Không tìm thấy giảng viên ${filters.teacher}.`,
            `Teacher ${filters.teacher} not found.`
          );
        const courseCount = await CourseModel.countDocuments({
          teacherId: teacher._id,
        });
        return t(
          `Giảng viên ${teacher.name} có ${courseCount} khóa học.`,
          `Teacher ${teacher.name} has ${courseCount} courses.`
        );
      }

      if (
        entity === "course" &&
        (!filters || Object.keys(filters).length === 0)
      ) {
        const totalCourses = await CourseModel.countDocuments({});
        return t(
          `Hiện có tổng cộng ${totalCourses} khóa học trong hệ thống.`,
          `There are currently ${totalCourses} courses in the system.`
        );
      }

      if (entity === "assignment") {
        if (!filters?.course && !filters?.assignment) {
          const assignmentCount = await AssignmentModel.countDocuments({});
          return t(
            `Hiện có tổng cộng ${assignmentCount} bài tập trong hệ thống.`,
            `There are currently ${assignmentCount} assignments in the system.`
          );
        }
        if (filters?.course) {
          const course = await fuzzyFindCourse(filters.course);
          if (!course)
            return t(
              `Khóa học ${filters.course} không tồn tại.`,
              `Course ${filters.course} not found.`
            );
          const assignmentCount = await AssignmentModel.countDocuments({
            courseId: course._id,
          });
          return t(
            `Khóa học ${course.name} có ${assignmentCount} bài tập.`,
            `Course ${course.name} has ${assignmentCount} assignments.`
          );
        }
        if (filters?.assignment) {
          const assignment = await fuzzyFindAssignment(filters.assignment);
          if (!assignment)
            return t(
              `Bài tập ${filters.assignment} không tồn tại.`,
              `Assignment ${filters.assignment} not found.`
            );
          const teacherName = assignment.courseId?.teacherId?.name;
          return t(
            `Bài tập "${assignment.title}" thuộc khóa học ${
              assignment.courseId?.name
            }${teacherName ? `, giảng viên ${teacherName}` : ""}.`,
            `Assignment "${assignment.title}" belongs to course ${
              assignment.courseId?.name
            }${teacherName ? `, teacher ${teacherName}` : ""}.`
          );
        }
      }

      if (entity === "submission") {
        if (!filters?.assignment)
          return t(
            `Cần chỉ định bài tập để đếm lượt nộp.`,
            `Assignment must be specified to count submissions.`
          );
        const assignment = await fuzzyFindAssignment(filters.assignment);
        if (!assignment)
          return t(
            `Bài tập ${filters.assignment} không tồn tại.`,
            `Assignment ${filters.assignment} not found.`
          );

        if (filters.course) {
          const course = await fuzzyFindCourse(filters.course);
          if (!course)
            return t(
              `Khóa học ${filters.course} không tồn tại.`,
              `Course ${filters.course} not found.`
            );
          if (assignment.courseId._id.toString() !== course._id.toString()) {
            return t(
              `Bài tập ${assignment.title} không thuộc khóa học ${course.name}.`,
              `Assignment ${assignment.title} does not belong to course ${course.name}.`
            );
          }
        }

        const submissionCount = await SubmissionModel.countDocuments({
          assignment: assignment._id,
        });
        return t(
          `Bài tập "${assignment.title}" có ${submissionCount} lượt nộp.`,
          `Assignment "${assignment.title}" has ${submissionCount} submissions.`
        );
      }

      if (entity === "student" && filters?.course) {
        const course = await fuzzyFindCourse(filters.course);
        if (!course)
          return t(
            `Khóa học ${filters.course} không tồn tại.`,
            `Course ${filters.course} not found.`
          );
        return t(
          `Có ${course.studentIds.length} sinh viên trong khóa học ${course.name}.`,
          `There are ${course.studentIds.length} students in course ${course.name}.`
        );
      }
    }

    // LIST queries
    if (intent === "list") {
      if (entity === "assignment") {
        if (filters?.course) {
          const course = await fuzzyFindCourse(filters.course);
          if (!course)
            return t(
              `Khóa học ${filters.course} không tồn tại.`,
              `Course ${filters.course} not found.`
            );
          const assignments = await AssignmentModel.find({
            courseId: course._id,
          });
          const list = assignments
            .map((a, i) => `${i + 1}. ${a.title}`)
            .join("\n");
          return t(
            `Danh sách bài tập trong khóa học ${course.name}:\n${list}`,
            `Assignments in course ${course.name}:\n${list}`
          );
        }
        if (!filters || Object.keys(filters).length === 0) {
          const assignments = await AssignmentModel.find();
          const list = assignments
            .map((a, i) => `${i + 1}. ${a.title}`)
            .join("\n");
          return t(
            `Danh sách tất cả các bài tập:\n${list}`,
            `List of all assignments:\n${list}`
          );
        }
      }

      if (entity === "course") {
        if (filters?.teacher) {
          const teacher = await fuzzyFindUser(filters.teacher, "TEACHER");
          if (!teacher)
            return t(
              `Không tìm thấy giảng viên ${filters.teacher}.`,
              `Teacher ${filters.teacher} not found.`
            );
          const courses = await CourseModel.find({ teacherId: teacher._id });
          const list = courses
            .map(
              (c, i) =>
                `${i + 1}. ${c.name} - ${c.description || "No description"}`
            )
            .join("\n");
          return t(
            `Các khóa học của giảng viên ${teacher.name}:\n${list}`,
            `Courses of teacher ${teacher.name}:\n${list}`
          );
        }
        if (!filters || Object.keys(filters).length === 0) {
          const courses = await CourseModel.find();
          const list = courses.map((c, i) => `${i + 1}. ${c.name}`).join("\n");
          return t(
            `Danh sách tất cả các khóa học:\n${list}`,
            `List of all courses:\n${list}`
          );
        }
      }

      if (entity === "student" && filters?.course) {
        const course = await fuzzyFindCourse(filters.course);
        if (!course)
          return t(
            `Khóa học ${filters.course} không tồn tại.`,
            `Course ${filters.course} not found.`
          );
        if (filters.student) {
          const student = course.studentIds.find(
            (s) => normalize(s.name) === normalize(filters.student)
          );
          return student
            ? t(
                `Sinh viên ${student.name} có trong khóa học ${course.name}.`,
                `Student ${student.name} is enrolled in ${course.name}.`
              )
            : t(
                `Sinh viên ${filters.student} không có trong khóa học ${course.name}.`,
                `Student ${filters.student} is not enrolled in ${course.name}.`
              );
        }
        return t(
          `Có ${course.studentIds.length} sinh viên trong khóa học ${course.name}.`,
          `There are ${course.studentIds.length} students in course ${course.name}.`
        );
      }

      if (entity === "submission" && filters?.assignment) {
        const assignment = await fuzzyFindAssignment(filters.assignment);
        if (!assignment)
          return t(
            `Bài tập ${filters.assignment} không tồn tại.`,
            `Assignment ${filters.assignment} not found.`
          );
        const submissions = await SubmissionModel.find({
          assignment: assignment._id,
        });
        const list = submissions
          .map((s, i) => `${i + 1}. ${s.studentName || "Unknown"}`)
          .join("\n");
        return t(
          `Danh sách lượt nộp bài tập "${assignment.title}":\n${list}`,
          `Submission list for assignment "${assignment.title}":\n${list}`
        );
      }
    }

    // Assignment guidance
    if (
      intent === "assignment_guidance" &&
      entity === "assignment" &&
      filters?.assignment
    ) {
      return t(
        `Bạn có thể thử giải bài tập "${filters.assignment}" bằng cách phân tích yêu cầu và áp dụng kiến thức đã học.`,
        `You can try solving assignment "${filters.assignment}" by analyzing the requirements and applying learned concepts.`
      );
    }

    return null;
  } catch (err) {
    logError(err);
    return null;
  }
};

// Main Chatbot Reply Function
export const getChatbotReply = async (userId, conversationId, messageText) => {
  try {
    const userLang = detectLanguage(messageText);

    // Extract structured intent/entity/filters
    const parsed = await analyzeQuery(userId, messageText, conversationId);

    // Query database for structured answers
    const dbReply = await queryDB(parsed, userLang);
    if (dbReply) return dbReply;

    // Fallback GPT for guidance / small talk
    const { context } = await getConversationContext(userId, conversationId);
    const prompt = `
${context}
User asked: "${messageText}"

Rules:
- Never provide direct answers to assignments.
- Only give hints, guidance, or explanations.
- If the question is about system data and unknown, reply "I don't know".
- Answer concisely in ${userLang === "vi" ? "Vietnamese" : "English"}.
`;

    const fallbackResp = await groqClient.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful study assistant. Answer clearly and concisely.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_completion_tokens: 250,
    });

    const textResp = fallbackResp.choices[0]?.message?.content;

    if (!textResp)
      return userLang === "vi"
        ? "Xin lỗi, tôi không thể trả lời câu hỏi này."
        : "Sorry, I cannot answer this question.";

    return textResp;
  } catch (err) {
    logError(err);
    return userLang === "vi"
      ? "Lỗi nội bộ Chatbot."
      : "Chatbot internal error.";
  }
};
