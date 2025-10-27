import mongoose from "mongoose";

const PlagiarismReportSchema = new mongoose.Schema({
    submissionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "submission",
        required: true
    },
    similarityScore: {
        type: Number
    },
    files: [
    {
      materialId: {
        type: String,
        required: true
      },
      fileName: String,
      matchedSources: [
        {
          sourceType: { type: String, enum: ["internal", "external"] },
          sourceId: String,
          matchedText: String,
          similarity: Number
        }
      ]
    }
  ],
}, { timestamps: true });

const PlagiarismReportModel = mongoose.model("plagiarismReport", PlagiarismReportSchema);

export default PlagiarismReportModel;