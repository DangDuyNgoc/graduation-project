import React from "react";
import { Button } from "../ui/button";
function PlagiarismReport({ report, onCheck, threshold = 0.3 }) {
  if (!report) return;

  const similarityPercent = (report.similarityScore * 100).toFixed(2);
  const isOverThreshold = report.similarityScore > threshold;
  const scoreColor = isOverThreshold ? "text-red-600" : "text-green-600";
  return (
    <div className="bg-white shadow-md rounded-lg p-6 mt-6">
      <h2>Plagiarism Report</h2>
      <p className="text-gray-700 mb-4">
        Similarity Score:{" "}
        <span className={`font-bold ${scoreColor}`}>{similarityPercent}%</span>
      </p>

      {isOverThreshold && <Button onClick={onCheck}>Check Again</Button>}

      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3">
          Matched Sources
          {report.matchedSources.length > 0 ? (
            <ul className="space-y-3">
              {report.matchedSources.map((source, index) => (
                <li
                  key={index}
                  className="border rounded-md p-3 bg-gray-50 text-sm"
                >
                  <p className="text-gray-600 mb-2">Source Type: </p>
                  <span>{source.sourceType}</span>
                  <p>
                    <span className="font-semibold text-blue-600">
                      Matched Text:
                    </span>
                    <span className="bg-yellow-200 text-gray-900 ml-2 px-1 rounded">
                      {source.matchedText}
                    </span>
                  </p>
                  <p className="mt-1 text-gray-700">
                    <span className="font-semibold">Similarity:</span>{" "}
                    {(source.similarity * 100).toFixed(2)}%
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-600 mt-2">No matched sources found.</p>
          )}
        </h3>
      </div>
    </div>
  );
}
export default PlagiarismReport;
