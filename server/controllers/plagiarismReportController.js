import axios from "axios";
import PlagiarismReportModel from "../models/PlagiarismReport.js";
import submissionModel from "../models/submissionModel.js";

export const checkPlagiarismController = async (req, res) => {
  try {
    const { submissionId } = req.params;

    const submission = await submissionModel.findById(submissionId);
    if (!submission) {
      return res.status(404).send({
        success: false,
        message: "Submission Not found"
      });
    };

    if (submissionId) {
      const flaskCheck = await axios.get(
        `http://localhost:5000/get_materials_by_submission/${submissionId.toString()}`
      );
      if (flaskCheck.data?.materials.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Server can't not find materials of submission",
        });
      }
    }

    // Call Flask plagiarism checking API
    const flaskResponse = await axios.get(
      `http://localhost:5000/check_plagiarism/${submissionId.toString()}`
    );
    const data = flaskResponse.data;

    if (!data.success) {
      return res.status(500).json({
        success: false,
        message: "Flask analysis failed",
      });
    }

    const materialId = data.materialId;
    // Prepare mapped sources for DB
    const mappedSources = data.matchedSources.map((s) => ({
      sourceType: s.sourceType,
      sourceId: s.sourceId,
      chunkText: s.chunkText,
      matchedText: s.matchedText,
      similarity: s.similarity,
    }));

    // Check if report already exists
    let existingReport = await PlagiarismReportModel.findOne({ submissionId });

    if (existingReport) {
      // Update existing report
      existingReport.similarityScore = data.similarityScore;
      existingReport.matchedSources = mappedSources;
      existingReport.reportDetails = {
        materialId,
        totalSources: mappedSources.length,
      };

      await existingReport.save();

      return res.status(200).json({
        success: true,
        message: "Plagiarism report updated",
        report: existingReport,
      });
    } else {
      // Create new report
      const newReport = await PlagiarismReportModel.create({
        submissionId,
        similarityScore: data.similarityScore,
        matchedSources: mappedSources,
        reportDetails: {
          materialId,
          totalSources: mappedSources.length,
        },
      });

      return res.status(200).json({
        success: true,
        message: "Plagiarism report created",
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
      report
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
