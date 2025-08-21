import express from "express";
import { isAuthenticated, isTeacher } from "../middlewares/authMiddleware.js";
import {
    createCourseController,
    deleteCourseController,
    getAllCourseController,
    getCourseController,
    updateCourseController
} from "../controllers/courseController.js";
import uploadMaterials from "../middlewares/uploadMaterials.js";

const courseRoute = express.Router();

courseRoute.post("/create-course", isAuthenticated, isTeacher, uploadMaterials.array("files", 10), createCourseController);
courseRoute.get("/get-all-courses", getAllCourseController);
courseRoute.get("/get-course/:id", getCourseController);
courseRoute.put("/update-course/:id", isAuthenticated, isTeacher, updateCourseController);
courseRoute.delete("/delete-course/:id", isAuthenticated, isTeacher, deleteCourseController);

export default courseRoute;