import express from "express";
import { isAuthenticated, isTeacher } from "../middlewares/authMiddleware.js";
import {
    createAssignmentController,
    deleteAllAssignmentController,
    deleteAllMaterialsAssignmentController,
    deleteAssignmentController,
    deleteOneAssignmentMaterialController,
    getAllAssignmentController,
    getAllAssignmentFotStudentController,
    getAssignmentByCourseController,
    getAssignmentController,
    updateAssignmentController
} from "../controllers/assignmentController.js";
import uploadMaterials from "../middlewares/uploadMaterials.js";

const assignmentRoute = express.Router();

assignmentRoute.post("/create-assignment",
    isAuthenticated,
    isTeacher,
    uploadMaterials.array("materials", 10),
    createAssignmentController);
assignmentRoute.get("/get-assignment-by-course/:id", getAssignmentByCourseController);
assignmentRoute.get("/get-assignment/:id", isAuthenticated, getAssignmentController);
assignmentRoute.get("/get-assignments-for-student/",
    isAuthenticated,
    getAllAssignmentFotStudentController
);
assignmentRoute.get("/get-all-assignments", getAllAssignmentController);
assignmentRoute.put("/update-assignment/:id",
    isAuthenticated,
    isTeacher,
    uploadMaterials.array("materials"),
    updateAssignmentController
);
assignmentRoute.delete("/delete-assignment/:id",
    isAuthenticated,
    isTeacher,
    deleteAssignmentController
);
assignmentRoute.delete("/delete-all-assignments",
    isAuthenticated,
    isTeacher,
    deleteAllAssignmentController
);
assignmentRoute.delete("/delete-one-assignment-material",
    isAuthenticated,
    isTeacher,
    deleteOneAssignmentMaterialController
);
assignmentRoute.delete("/delete-all-assignment-materials/:id",
    isAuthenticated,
    isTeacher,
    deleteAllMaterialsAssignmentController
);

export default assignmentRoute;