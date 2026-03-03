// scripts/deploy.js
// Run with: npx hardhat run scripts/deploy.js --network localhost
//       or: npx hardhat run scripts/deploy.js --network amoy

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🚦 Deploying TrafficViolationLedger Smart Contract...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📋 Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // Deploy contract
  const TrafficLedger = await ethers.getContractFactory("TrafficViolationLedger");
  const contract = await TrafficLedger.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("✅ Contract deployed at:", address);
  console.log("🔗 Transaction hash:", contract.deploymentTransaction().hash);

  // Save contract address and ABI to a JSON file
  // so the backend (server.js) can auto-import it
  const deployInfo = {
    contractAddress: address,
    deployerAddress: deployer.address,
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
  };

  // Write deployment info
  fs.writeFileSync(
    path.join(__dirname, "../deployed.json"),
    JSON.stringify(deployInfo, null, 2)
  );
  console.log("\n📝 Deployment info saved to deployed.json");

  // Copy ABI
  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/TrafficViolationLedger.sol/TrafficViolationLedger.json"
  );
  if (fs.existsSync(artifactPath)) {
    const artifact = JSON.parse(fs.readFileSync(artifactPath));
    fs.writeFileSync(
      path.join(__dirname, "../contractABI.json"),
      JSON.stringify(artifact.abi, null, 2)
    );
    console.log("📋 ABI saved to contractABI.json");
  }

  console.log("\n✅ DONE! Update your .env file:");
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
