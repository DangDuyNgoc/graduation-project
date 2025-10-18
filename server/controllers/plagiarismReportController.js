import axios from "axios";
import PlagiarismReportModel from "../models/PlagiarismReport.js";

export const checkPlagiarismController = async (req, res) => {
  try {
    const { submissionId } = req.params;

    if (!submissionId) {
      return res.status(400).json({
        success: false,
        message: "Missing submissionId or materialId",
      });
    }

    if (submissionId) {
      const flaskCheck = await axios.get(
        `http://localhost:5000/get_materials_by_submission/${submissionId.toString()}`
      );
      if (flaskCheck.data?.materials.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Server can't not find my submisson",
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
