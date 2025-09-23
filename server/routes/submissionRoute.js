import express from "express";
import { isAuthenticated, isTeacher } from "../middlewares/authMiddleware.js";
import {
    deleteAllSubmissionsController,
    deleteOneSubmissionController,
    getAllSubmissionController,
    getStudentSubmissionsController,
    getSubmissionController,
    updateSubmissionController,
    uploadSubmissionController
} from "../controllers/submissionController.js";
import uploadMaterials from "../middlewares/uploadMaterials.js";

const submissionRoute = express.Router();

submissionRoute.post("/add-submission/:id",
    isAuthenticated,
    uploadMaterials.array("fileUrls"),
    uploadSubmissionController
);

submissionRoute.put("/update-submission/:id",
    isAuthenticated,
    uploadMaterials.array("fileUrls"),
    updateSubmissionController
);

submissionRoute.get("/get-all-submissions/:id",
    isAuthenticated,
    getAllSubmissionController
);

submissionRoute.get("/get-submission/:id",
    isAuthenticated,
    getSubmissionController
);

submissionRoute.get("/get-submission-by-student/:id",
    isAuthenticated,
    getStudentSubmissionsController
);

submissionRoute.delete("/delete-submission/:id",
    isAuthenticated,
    deleteOneSubmissionController
);

submissionRoute.delete("/delete-all-submissions/:id",
    isAuthenticated,
    isTeacher,
    deleteAllSubmissionsController
);

export default submissionRoute;