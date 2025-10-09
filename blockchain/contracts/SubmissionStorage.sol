// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract SubmissionStorage {
    struct Submission {
        string assignmentId;
        string contentHash;
        uint256 timestamp;
    }

    // mapping: studentId => submissions
    mapping(string => Submission[]) private submissions;

    event SubmissionStored(
        string indexed studentId,
        string assignmentId,
        string contentHash,
        uint256 timestamp
    );

    // store submission on behalf of student
    function storeSubmission(
        string memory studentId,
        string memory assignmentId, 
        string memory contentHash
    ) public {
        Submission memory newSubmission = Submission({
            assignmentId: assignmentId,
            contentHash: contentHash,
            timestamp: block.timestamp
        });

        submissions[studentId].push(newSubmission);

        emit SubmissionStored(studentId, assignmentId, contentHash, block.timestamp);
    }

    // get all submissions of a student
    function getSubmissions(string memory studentId) 
        public 
        view 
        returns (Submission[] memory) 
    {
        return submissions[studentId];
    }

    // verify by hash
    function verifySubmission(string memory studentId, string memory assignmentId, string memory contentHash) 
        public 
        view 
        returns (bool) 
    {
        Submission[] memory subs = submissions[studentId];
        for (uint i = 0; i < subs.length; i++) {
            if (
                keccak256(abi.encodePacked(subs[i].assignmentId)) == keccak256(abi.encodePacked(assignmentId)) &&
                keccak256(abi.encodePacked(subs[i].contentHash)) == keccak256(abi.encodePacked(contentHash))
            ) {
                return true;
            }
        }
        return false;
    }

    // get one submission by index
    function getSubmission(string memory studentId, uint index) 
        public 
        view 
        returns (string memory assignmentId, string memory contentHash, uint256 timestamp) 
    {
        require(index < submissions[studentId].length, "Invalid index");
        Submission memory sub = submissions[studentId][index];
        return (sub.assignmentId, sub.contentHash, sub.timestamp);
    }

    // count submissions
    function getSubmissionCount(string memory studentId) 
        public 
        view 
        returns (uint) 
    {
        return submissions[studentId].length;
    }
}
