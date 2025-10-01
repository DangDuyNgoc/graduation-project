const hre = require("hardhat");

async function main() {
    const SubmissionStorage = await hre.ethers.getContractFactory("SubmissionStorage");
    const submissionStorage = await SubmissionStorage.deploy();
    await submissionStorage.waitForDeployment();

    console.log("Contract deployed to:", await submissionStorage.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
