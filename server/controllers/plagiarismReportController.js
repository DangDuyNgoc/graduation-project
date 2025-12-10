import axios from "axios";
import PlagiarismReportModel from "../models/PlagiarismReport.js";
import submissionModel from "../models/submissionModel.js";

export const checkPlagiarismController = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await submissionModel.findById(submissionId);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found",
      });
    }

    const flaskResponse = await axios.get(
      `http://localhost:5000/check_plagiarism/${submissionId}`
    );

    const data = flaskResponse.data;
    if (!data.success) {
      return res.status(500).json({
        success: false,
        message: "Flask plagiarism analysis failed",
      });
    }

    const files = data.files || [];
    console.log("file", files);
    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No files found in Flask report",
      });
    }

    // transform and normalize Flask data
    const mappedFiles = files.map((file) => ({
      materialId: file.materialId,
      fileName: file.fileName,
      matchedSources: (file.matchedSources || []).map((src) => ({
        sourceType: src.sourceType,
        sourceId: src.sourceId,
        matchedText: src.matchedText,
        similarity: src.similarity,
      })),
      similarityScore: Number(file.similarityScore?.toFixed(4) || 0),
      reportDetails: file.reportDetails,
    }));

    // compute overall similarity across all files
    const overallSimilarity =
      mappedFiles.length > 0
        ? Number(
          (
            mappedFiles.reduce(
              (sum, f) => sum + (f.similarityScore || 0),
              0
            ) / mappedFiles.length
          ).toFixed(4)
        )
        : 0;

    // check if a plagiarism report already exists
    let report = await PlagiarismReportModel.findOne({ submissionId });

    if (report) {
      // update existing report
      report.similarityScore = overallSimilarity;
      report.files = mappedFiles;
      await report.save();

      return res.status(200).json({
        success: true,
        message: "Plagiarism report updated successfully",
        report,
      });
    } else {
      // create a new report
      const newReport = await PlagiarismReportModel.create({
        submissionId,
        similarityScore: overallSimilarity,
        files: mappedFiles,
      });

      return res.status(201).json({
        success: true,
        message: "Plagiarism report created successfully",
        report: newReport,
      });
    }
  } catch (err) {
    console.error("[ERROR checkPlagiarismController]", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getPlagiarismReportController = async (req, res) => {
  try {
    const { submissionId } = req.params;

    if (!submissionId) {
      return res.status(400).send({
        success: false,
        message: "SubmissionId is required"
      });
    }

    const submission = await submissionModel.findById(submissionId);
    if (!submission) {
      return res.status(404).send({
        success: false,
        message: "Submission not found"
      });
    }

    const report = await PlagiarismReportModel.findOne({ submissionId })

    if (!report) {
      return res.status(404).send({
        success: false,
        message: "Plagiarism report not found"
      });
    };

    res.status(200).send({
      success: true,
      message: "Plagiarism report fetched successfully",
      report,
      submission
    });
  } catch (error) {
    console.error("[ERROR getPlagiarismReportController]", error);
    res.status(500).send({
      success: false,
      message: "Error getting plagiarism report",
      error: error.message
    })
  }
}