// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

contract SubmissionStorage {
    struct Submission {
        string hash;
        uint256 timestamp;
    }

    // mapping: studentAddress => assignmentId => list submissions
    mapping(address => mapping(string => Submission[])) private submissions;

    event SubmissionStored(address indexed student, string assignmentId, string hash, uint256 timestamp);

    function storeSubmission(string memory assignmentId, string memory hash) public {
        submissions[msg.sender][assignmentId].push(Submission(hash, block.timestamp));

        emit SubmissionStored(msg.sender, assignmentId, hash, block.timestamp);
    }

    function getSubmissions(address student, string memory assignmentId) public view returns (Submission[] memory) {
        return submissions[student][assignmentId];
    }

    function verifySubmission(address student, string memory assignmentId, string memory hash) public view returns (bool) {
        Submission[] memory subs = submissions[student][assignmentId];
        for (uint i = 0; i < subs.length; i++) {
            if (keccak256(abi.encodePacked(subs[i].hash)) == keccak256(abi.encodePacked(hash))) {
                return true;
            }
        }
        return false;
    }

    function getSubmission(address student, string memory assignmentId, uint index) 
    public view returns (string memory, uint256) 
    {
        require(index < submissions[student][assignmentId].length, "Invalid index");
        Submission memory sub = submissions[student][assignmentId][index];
        return (sub.hash, sub.timestamp);
    }

    function getSubmissionCount(address student, string memory assignmentId) 
        public view returns (uint) 
    {
        return submissions[student][assignmentId].length;
    }
}
