import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_URL);

// Wallet from private key
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// get ABI contract
const contractPath = path.resolve(__dirname, "../../blockchain/artifacts/contracts/SubmissionStorage.sol/SubmissionStorage.json");
const contractJson = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const abi = contractJson.abi;

// connect contract
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, abi, wallet);

export default contract;