import express from "express";
import { isAuthenticated, isTeacher } from "../middlewares/authMiddleware.js";
import {
    addStudentsToCourseController,
    createCourseController,
    deleteCourseController,
    deleteCourseMaterialsController,
    deleteOneCourseMaterialController,
    getAllCourseController,
    getCourseController,
    removeStudentsFromCourseController,
    updateCourseController
} from "../controllers/courseController.js";
import uploadMaterials from "../middlewares/uploadMaterials.js";

const courseRoute = express.Router();

courseRoute.post("/create-course", isAuthenticated, isTeacher, uploadMaterials.array("materials", 10), createCourseController);
courseRoute.get("/get-all-courses", getAllCourseController);
courseRoute.get("/get-course/:id", getCourseController);
courseRoute.put("/update-course/:id", isAuthenticated, isTeacher, uploadMaterials.array("materials"), updateCourseController);
courseRoute.delete("/delete-course/:id", isAuthenticated, isTeacher, deleteCourseController);
courseRoute.delete("/delete-course-materials/:id", isAuthenticated, isTeacher, deleteCourseMaterialsController);
courseRoute.delete("/delete-one-course-material", isAuthenticated, isTeacher, deleteOneCourseMaterialController);

// route for adding and removing students
courseRoute.put("/add-students/:id", isAuthenticated, isTeacher, addStudentsToCourseController);
courseRoute.put("/remove-students/:id", isAuthenticated, isTeacher, removeStudentsFromCourseController)

export default courseRoute;