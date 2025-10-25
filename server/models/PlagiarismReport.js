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
    matchedSources: [
        {
            sourceType: {
                type: String,
                enum: ["internal", "external"]
            },
            sourceId: {
                type: String
            },
            matchedText: {
                type: String
            },
            similarity: {
                type: Number // % duplicate paragraphs
            }
        }
    ],
    reportDetails: {
        type: mongoose.Schema.Types.Mixed,
    },
}, { timestamps: true });

const PlagiarismReportModel = mongoose.model("plagiarismReport", PlagiarismReportSchema);

export default PlagiarismReportModel;