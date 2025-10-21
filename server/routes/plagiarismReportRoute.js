import express from "express";
import { checkPlagiarismController } from "../controllers/plagiarismReportController.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";

const plagiarismRouter = express.Router();

plagiarismRouter.get(
  "/check-plagiarism/:submissionId",
  isAuthenticated,
  checkPlagiarismController
);

export default plagiarismRouter;
