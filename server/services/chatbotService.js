import { Groq } from "groq-sdk";
import Fuse from "fuse.js";
import AssignmentModel from "../models/assignmentModel.js";
import chatbotMessageModel from "../models/chatbotMessageModel.js";
import CourseModel from "../models/courseModel.js";
import SubmissionModel from "../models/submissionModel.js";
import UserModel from "../models/userModel.js";
import { logError } from "../utils/logger.js";

const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });

const conversationCache = new Map();

const normalize = (text = "") => text.toLowerCase().trim();

const normalizeText = (text) =>
  (text ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@.+]/g, "")
    .trim();

const detectLanguage = (text = "") => {
  const vietnameseChars =
    /[àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
  if (vietnameseChars.test(text)) return "vi";
  const enChars = text.replace(/[^a-zA-Z]/g, "").length;
  const viChars = text.replace(/[a-zA-Z]/g, "").length;
  return enChars >= viChars ? "en" : "vi";
};

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

const fuzzyFindUser = async (keyword, role) => {
  if (!keyword) return null;

  const users = await UserModel.find(role ? { role } : {}).select(
    "name role email phone"
  );

  const indexedUsers = users.map((u) => ({
    ...u.toObject(),
    _search: {
      name: normalizeText(u.name),
      email: normalizeText(u.email),
      phone: normalizeText(u.phone),
    },
  }));

  const fuse = new Fuse(indexedUsers, {
    keys: ["_search.name", "_search.email", "_search.phone"],
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
  });

  const result = fuse.search(normalizeText(keyword));
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

const analyzeQuery = async (userId, messageText, conversationId) => {
  try {
    const { context } = await getConversationContext(userId, conversationId);

    const prompt = `
You are a professional bilingual study assistant (Vietnamese-English).

Allowed intent values:
- count
- list
- info

Allowed entity values:
- course
- assignment
- teacher
- student
- submission

Return strictly JSON only.
Always include keys: intent, entity, filters, language.
Use null if not applicable.
Do not invent new intent or entity names.

Examples:
- "Danh sách khóa học Python có bao nhiêu assignment?"
{"intent":"count","entity":"assignment","filters":{"course":"Python"},"language":"vi"}

Previous conversation:
${context}

User asked: "${messageText}"
`;

    const completion = await groqClient.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: "You extract structured JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_completion_tokens: 300,
    });

    const text = completion.choices[0]?.message?.content || "{}";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]);

    const entityMap = {
      "khóa học": "course",
      "môn học": "course",
      course: "course",
      "bài tập": "assignment",
      assignment: "assignment",
      "giảng viên": "teacher",
      instructor: "teacher",
      teacher: "teacher",
      "sinh viên": "student",
      student: "student",
      "bài nộp": "submission",
      submission: "submission",
    };

    if (parsed.entity) {
      const key = normalize(parsed.entity);
      parsed.entity = entityMap[key] || parsed.entity;
    }

    if (parsed.filters) {
      if (parsed.filters.instructor && !parsed.filters.teacher) {
        parsed.filters.teacher = parsed.filters.instructor;
        delete parsed.filters.instructor;
      }
      if (parsed.filters.giang_vien && !parsed.filters.teacher) {
        parsed.filters.teacher = parsed.filters.giang_vien;
        delete parsed.filters.giang_vien;
      }
      if (parsed.filters?.name && !parsed.filters.teacher) {
        parsed.filters.teacher = parsed.filters.name;
        delete parsed.filters.name;
      }
    }

    return parsed;
  } catch (err) {
    logError(err);
    return null;
  }
};

const queryDB = async (parsed) => {
  if (!parsed) return null;

  const { intent, entity, filters } = parsed;

  try {
    if (intent === "count" || intent === "info") {
      if (intent === "info" && entity === "teacher" && filters?.teacher) {
        const teacher = await fuzzyFindUser(filters.teacher, "TEACHER");
        if (!teacher) return null;
        return {
          type: "TEACHER_INFO",
          data: {
            name: teacher.name,
            email: teacher.email ?? null,
            phone: teacher.phone ?? null,
          },
        };
      }

      if ((entity === "course" || entity === "teacher") && filters?.teacher) {
        const teacher = await fuzzyFindUser(filters.teacher, "TEACHER");
        if (!teacher) return null;
        const count = await CourseModel.countDocuments({
          teacherId: teacher._id,
        });
        return {
          type: "COUNT_COURSE_BY_TEACHER",
          data: { teacher: teacher.name, count },
        };
      }

      if (entity === "course" && !filters) {
        const count = await CourseModel.countDocuments({});
        return { type: "COUNT_ALL_COURSES", data: { count } };
      }

      if (entity === "assignment") {
        if (!filters) {
          const count = await AssignmentModel.countDocuments({});
          return { type: "COUNT_ALL_ASSIGNMENTS", data: { count } };
        }

        if (filters.course) {
          const course = await fuzzyFindCourse(filters.course);
          if (!course) return null;
          const count = await AssignmentModel.countDocuments({
            courseId: course._id,
          });
          return {
            type: "COUNT_ASSIGNMENT_BY_COURSE",
            data: { course: course.name, count },
          };
        }
      }

      if (entity === "submission" && filters?.assignment) {
        const assignment = await fuzzyFindAssignment(filters.assignment);
        if (!assignment) return null;
        const count = await SubmissionModel.countDocuments({
          assignment: assignment._id,
        });
        return {
          type: "COUNT_SUBMISSION",
          data: { assignment: assignment.title, count },
        };
      }

      if (entity === "student" && filters?.course) {
        const course = await fuzzyFindCourse(filters.course);
        if (!course) return null;
        return {
          type: "COUNT_STUDENT_BY_COURSE",
          data: { course: course.name, count: course.studentIds.length },
        };
      }
    }

    if (intent === "list") {
      if (entity === "assignment" && filters?.course) {
        const course = await fuzzyFindCourse(filters.course);
        if (!course) return null;
        const assignments = await AssignmentModel.find({
          courseId: course._id,
        }).select("title");
        return {
          type: "LIST_ASSIGNMENT_BY_COURSE",
          data: {
            course: course.name,
            assignments: assignments.map((a) => a.title),
          },
        };
      }

      if (entity === "course") {
        const courses = await CourseModel.find().select("name description");
        return { type: "LIST_ALL_COURSES", data: courses };
      }
    }

    return null;
  } catch (err) {
    logError(err);
    return null;
  }
};

const generateAnswer = async (structuredData, language) => {
  if (!structuredData) return null;

  const prompt = `
Language: ${language}
Data:
${JSON.stringify(structuredData, null, 2)}
`;

  const completion = await groqClient.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [
      { role: "system", content: "Generate user-friendly answer." },
      { role: "user", content: prompt },
    ],
    temperature: 0.4,
    max_completion_tokens: 300,
  });

  return completion.choices[0]?.message?.content || null;
};

export const getChatbotReply = async (userId, conversationId, messageText) => {
  try {
    const userLang = detectLanguage(messageText);

    const parsed = await analyzeQuery(userId, messageText, conversationId);
    console.log("Parsed Query:", parsed);

    const dbResult = await queryDB(parsed);
    console.log("DB Result:", dbResult);

    if (dbResult) {
      const answer = await generateAnswer(dbResult, userLang);
      if (answer) return answer;
    }

    const { context } = await getConversationContext(userId, conversationId);

    const fallbackPrompt = `
${context}
User asked: "${messageText}"
`;

    const fallbackResp = await groqClient.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: "Helpful study assistant." },
        { role: "user", content: fallbackPrompt },
      ],
      temperature: 0.3,
      max_completion_tokens: 250,
    });

    return fallbackResp.choices[0]?.message?.content || null;
  } catch (err) {
    logError(err);
    return detectLanguage(messageText) === "vi"
      ? "Lỗi nội bộ Chatbot."
      : "Chatbot internal error.";
  }
};
