const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SubmissionStorage", function () {
    let SubmissionStorage, submissionStorage, owner, student1, student2;

    beforeEach(async function () {
        [owner, student1, student2] = await ethers.getSigners();
        SubmissionStorage = await ethers.getContractFactory("SubmissionStorage");
        submissionStorage = await SubmissionStorage.deploy();
        await submissionStorage.waitForDeployment();
    });

    it("Lưu 1 bài nộp và lấy lại đúng dữ liệu", async function () {
        const assignmentId = "ASSIGN1";
        const hash = "hash_123";

        await submissionStorage.connect(student1).storeSubmission(assignmentId, hash);

        const submissions = await submissionStorage.getSubmissions(student1.address, assignmentId);

        expect(submissions.length).to.equal(1);
        expect(submissions[0].hash).to.equal(hash);
    });

    it("Cho phép lưu nhiều lần nộp cho cùng 1 assignment", async function () {
        const assignmentId = "ASSIGN2";

        await submissionStorage.connect(student1).storeSubmission(assignmentId, "hash_1");
        await submissionStorage.connect(student1).storeSubmission(assignmentId, "hash_2");

        const submissions = await submissionStorage.getSubmissions(student1.address, assignmentId);

        expect(submissions.length).to.equal(2);
        expect(submissions[0].hash).to.equal("hash_1");
        expect(submissions[1].hash).to.equal("hash_2");
    });

    it("Kiểm tra verifySubmission hoạt động đúng", async function () {
        const assignmentId = "ASSIGN3";
        const correctHash = "hash_ok";
        const wrongHash = "hash_wrong";

        await submissionStorage.connect(student2).storeSubmission(assignmentId, correctHash);

        const verifyOk = await submissionStorage.verifySubmission(student2.address, assignmentId, correctHash);
        const verifyFail = await submissionStorage.verifySubmission(student2.address, assignmentId, wrongHash);

        expect(verifyOk).to.equal(true);
        expect(verifyFail).to.equal(false);
    });

    it("Mỗi sinh viên độc lập dữ liệu", async function () {
        const assignmentId = "ASSIGN4";

        await submissionStorage.connect(student1).storeSubmission(assignmentId, "hash_student1");
        await submissionStorage.connect(student2).storeSubmission(assignmentId, "hash_student2");

        const submissions1 = await submissionStorage.getSubmissions(student1.address, assignmentId);
        const submissions2 = await submissionStorage.getSubmissions(student2.address, assignmentId);

        expect(submissions1[0].hash).to.equal("hash_student1");
        expect(submissions2[0].hash).to.equal("hash_student2");
    });
});
