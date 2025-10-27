import express from "express";
import { isAuthenticated, isTeacher } from "../middlewares/authMiddleware.js";
import {
    addStudentsToCourseController,
    createCourseController,
    deleteAllCourseController,
    deleteCourseController,
    deleteCourseMaterialsController,
    deleteOneCourseMaterialController,
    getAllCourseController,
    getCourseByIdController,
    getCoursesByTeacherId,
    removeStudentsFromCourseController,
    updateCourseController
} from "../controllers/courseController.js";
import uploadCourseFiles from "../middlewares/uploadCourseFiles.js";

const courseRoute = express.Router();

courseRoute.post(
    "/create-course",
    uploadCourseFiles,
    isAuthenticated,
    isTeacher,
    createCourseController
);
courseRoute.get("/get-all-courses", getAllCourseController);
courseRoute.get("/get-course/:id", isAuthenticated, getCourseByIdController);
courseRoute.get(
  "/get-teacher-courses",
  isAuthenticated,
  isTeacher,
  getCoursesByTeacherId
);
courseRoute.put(
    "/update-course/:id",
    isAuthenticated,
    isTeacher,
    uploadCourseFiles,
    updateCourseController
);
courseRoute.delete("/delete-course/:id",
    isAuthenticated,
    isTeacher,
    deleteCourseController);
courseRoute.delete(
    "/delete-all-course",
    isAuthenticated,
    isTeacher,
    deleteAllCourseController
);
courseRoute.delete(
    "/delete-course-materials/:id",
    isAuthenticated,
    isTeacher,
    deleteCourseMaterialsController
);
courseRoute.delete(
    "/delete-one-course-material",
    isAuthenticated,
    isTeacher,
    deleteOneCourseMaterialController
);

// route for adding and removing students
courseRoute.put(
    "/add-students/:id",
    isAuthenticated,
    isTeacher,
    addStudentsToCourseController
);
courseRoute.put(
    "/remove-students/:id",
    isAuthenticated,
    isTeacher,
    removeStudentsFromCourseController
);

export default courseRoute;