import express from "express";
import { isAuthenticated, isTeacher } from "../middlewares/authMiddleware.js";
import {
    createAssignmentController,
    deleteAssignmentController,
    getAssignmentByCourseController,
    getAssignmentController,
    updateAssignmentController
} from "../controllers/assignmentController.js";

const assignmentRoute = express.Router();

assignmentRoute.post("/create-assignment", isAuthenticated, isTeacher, createAssignmentController);
assignmentRoute.get("/get-assignment-by-course/:id", getAssignmentByCourseController);
assignmentRoute.get("/get-assignment/:id", getAssignmentController);
assignmentRoute.put("/update-assignment/:id", isAuthenticated, isTeacher, updateAssignmentController);
assignmentRoute.delete("/delete-assignment/:id", isAuthenticated, isTeacher, deleteAssignmentController);

export default assignmentRoute;