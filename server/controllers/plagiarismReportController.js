import axios from "axios";
import PlagiarismReportModel from "../models/PlagiarismReport.js";

export const checkPlagiarismController = async (req, res) => {
  try {
    const { submissionId } = req.body;
    const { materialId } = req.params;

    if (!submissionId || !materialId) {
      return res.status(400).json({
        success: false,
        message: "Missing submissionId or materialId",
      });
    }

    // Call Flask plagiarism checking API
    const flaskResponse = await axios.get(
      `http://localhost:5000/check_plagiarism/${parseInt(materialId)}`
    );
    const data = flaskResponse.data;

    if (!data.success) {
      return res.status(500).json({
        success: false,
        message: "Flask analysis failed",
      });
    }

    // Prepare mapped sources for DB
    const mappedSources = data.matchedSources.map((s) => ({
      sourceType: s.sourceType,
      sourceId: s.sourceId,
      chunkText: s.chunkText,
      matchedText: s.matchedText,
      similarity: s.similarity,
    }));

    // Check if report already exists ---
    let existingReport = await PlagiarismReportModel.findOne({ submissionId });

    if (existingReport) {
      // Update existing report
      existingReport.similarityScore = data.similarityScore;
      existingReport.matchedSources = mappedSources;
      existingReport.reportDetails = JSON.stringify({
        materialId,
        totalSources: mappedSources.length,
      });

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
        reportDetails: JSON.stringify({
          materialId,
          totalSources: mappedSources.length,
        }),
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
