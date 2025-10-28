import React from "react";
import { Copy, Link as LinkIcon, ShieldCheck, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import toast from "react-hot-toast";
import { formatLateDuration } from "@/utils/timeFormatter";

const BlockchainInfo = ({ submission }) => {
  if (!submission) return null;

  const { contentHash, blockchainTxHash, submittedAt, isLate, lateDuration } =
    submission;

  const copy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard", { id: "copy_success" });
  };

  const openUrl = blockchainTxHash
    ? `https://sepolia.etherscan.io/tx/${blockchainTxHash}`
    : null;

  return (
    <Card className="mt-6 shadow-md border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center text-lg font-semibold text-gray-800">
          <ShieldCheck className="mr-2 text-green-600" />
          Blockchain Verification
        </CardTitle>
      </CardHeader>

      <CardContent className="text-sm space-y-3 text-gray-700">
        <div className="flex  items-center justify-between">
          <span className="font-medium">Content Hash: </span>
          {contentHash ? (
            <div className="flex items-center space-x-2 text-gray-600">
              <span className="truncate max-w-[200px]">{contentHash}</span>
              <Copy
                size={16}
                className="cursor-pointer text-gray-400 hover:text-gray-600"
                onClick={() => copy(contentHash)}
              />
            </div>
          ) : (
            <span className="text-gray-400 italic">No Recorded</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="font-medium">Blockchain Tx hash: </span>
          {blockchainTxHash ? (
            <div className="flex items-center space-x-2 text-gray-600">
              <a
                href=""
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => window.open(openUrl, "_blank")}
                className="text-blue-600 hover:underline truncate max-w-[180px]"
              >
                {blockchainTxHash}
              </a>
              <LinkIcon
                size={16}
                className="text-gray-600 cursor-pointer hover:text-blue-600"
              />
            </div>
          ) : (
            <span className="text-gray-400 italic">No on-chain yet</span>
          )}
        </div>

        <div className="flex justify-between">
          <span className="font-medium">Submission Time:</span>
          <span>{new Date(submittedAt).toLocaleString()}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="font-medium">Late Duration:</span>
          <div className="flex items-center space-x-2">
            {isLate ? (
              <>
                <Clock size={16} className="text-orange-500" />
                <span className="text-orange-600 font-medium">
                  Yes {formatLateDuration(lateDuration)}{" "}
                </span>
              </>
            ) : (
              <span className="text-green-600 font-medium">No</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
export default BlockchainInfo;
