import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_URL);

async function main() {
    const network = await provider.getNetwork();
    console.log("Network name:", network.name);
    console.log("Chain ID:", network.chainId.toString());
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    console.log("Address:", wallet.address);
    const balance = await provider.getBalance("0x6beb7B74BA1392072d21D4791aA2dECe3E84B964");
    console.log("Sepolia ETH Balance:", ethers.formatEther(balance));
}

main().catch((err) => console.error(err));
