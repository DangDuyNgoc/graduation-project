import express from "express";
import { checkPlagiarismController, getPlagiarismReportController } from "../controllers/plagiarismReportController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";

const plagiarismRouter = express.Router();

plagiarismRouter.get(
  "/check-plagiarism/:submissionId",
  isAuthenticated,
  checkPlagiarismController
);

plagiarismRouter.get(
  "/get-plagiarism-report/:submissionId",
  isAuthenticated,
  getPlagiarismReportController
);

export default plagiarismRouter;
