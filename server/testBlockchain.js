import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
    try {
        // 1. Provider
        const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
        const blockNumber = await provider.getBlockNumber();
        console.log("✅ Connected to blockchain. Current block:", blockNumber);

        // 2. Wallet
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        console.log("✅ Using wallet address:", wallet.address);

        // 3. Contract ABI + Address
        const contractPath = path.resolve(
            __dirname,
            "../blockchain/artifacts/contracts/SubmissionStorage.sol/SubmissionStorage.json"
        );
        const contractJson = JSON.parse(fs.readFileSync(contractPath, "utf8"));
        const contract = new ethers.Contract(
            process.env.CONTRACT_ADDRESS,
            contractJson.abi,
            wallet
        );

        const addr = await contract.getAddress();
        console.log("✅ Connected to contract at:", addr);

        // 4. Test gọi hàm view (không tốn gas)
        const testAddr = wallet.address; // địa chỉ ví của bạn
        const [hash, timestamp] = await contract.getSubmission(testAddr);
        console.log("✅ Test getSubmission:", { hash, timestamp: Number(timestamp) });

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
})();
