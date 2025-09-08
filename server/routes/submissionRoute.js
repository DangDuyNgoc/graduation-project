import express from "express";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import {
    getAllSubmissionController,
    uploadSubmissionController
} from "../controllers/submissionController.js";
import uploadMaterials from "../middlewares/uploadMaterials.js";

const submissionRoute = express.Router();

submissionRoute.post("/add-submission/:id",
    isAuthenticated,
    uploadMaterials.array("fileUrls"),
    uploadSubmissionController
);

submissionRoute.get("/get-all-submissions/:id",
    isAuthenticated,
    getAllSubmissionController
);

export default submissionRoute;