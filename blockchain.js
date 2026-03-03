/**
 * ============================================================
 *  blockchain.js  —  Blockchain Service Module
 *  Used by server.js to write/read from the smart contract.
 * ============================================================
 *  USAGE in server.js:
 *    const blockchain = require('./blockchain');
 *    await blockchain.recordViolation(data);
 *    const record = await blockchain.getViolation(challanId);
 * ============================================================
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// ---- Load ABI and Deployed Contract Address ----
let CONTRACT_ABI, CONTRACT_ADDRESS;

try {
  CONTRACT_ABI = JSON.parse(
    fs.readFileSync(path.join(__dirname, "contractABI.json"), "utf8")
  );
  const deployed = JSON.parse(
    fs.readFileSync(path.join(__dirname, "deployed.json"), "utf8")
  );
  CONTRACT_ADDRESS = deployed.contractAddress;
} catch (e) {
  console.warn(
    "⚠️  contractABI.json or deployed.json not found. Run deploy.js first."
  );
}

// ---- RPC Provider Setup ----
function getProvider() {
  const rpcUrl =
    process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
  return new ethers.JsonRpcProvider(rpcUrl);
}

// ---- Signer (your backend wallet) ----
function getSigner() {
  const provider = getProvider();
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not set in .env");
  return new ethers.Wallet(privateKey, provider);
}

// ---- Contract Instance ----
function getContract(withSigner = false) {
  const address = process.env.CONTRACT_ADDRESS || CONTRACT_ADDRESS;
  if (!address) throw new Error("CONTRACT_ADDRESS not set");
  if (!CONTRACT_ABI) throw new Error("ABI not loaded");

  const providerOrSigner = withSigner ? getSigner() : getProvider();
  return new ethers.Contract(address, CONTRACT_ABI, providerOrSigner);
}

// ============================================================
//  WRITE FUNCTIONS
// ============================================================

/**
 * Record a violation on the blockchain.
 * @param {Object} data  - violation data from AI detection
 * @returns {Object}     - { txHash, blockNumber, gasUsed }
 */
async function recordViolation(data) {
  const contract = getContract(true); // true = use signer

  // Convert fine to paise (avoids decimals on-chain)
  const fineInPaise = BigInt(data.fine * 100);

  // Map severity string to number
  const severityMap = { Low: 1, Medium: 2, High: 3, Critical: 4 };
  const severityNum = severityMap[data.aiData?.severity] || 2;

  console.log(`⛓️  Recording violation ${data.challanId} on blockchain...`);

  const tx = await contract.recordViolation(
    data.challanId,
    data.vehicleNumber,
    data.violationType,
    data.location || "Unknown",
    data.officerId || "SYSTEM",
    fineInPaise,
    severityNum,
    data.isRepeat || false,
    `${data.aiData?.confidence || 0}%`,
    data.ipfsHash || ""
  );

  const receipt = await tx.wait(); // Wait for block confirmation

  console.log(`✅ Recorded! TX Hash: ${receipt.hash}`);
  console.log(`   Block: ${receipt.blockNumber}, Gas: ${receipt.gasUsed}`);

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
    status: receipt.status === 1 ? "confirmed" : "failed",
  };
}

/**
 * Mark a challan as paid on-chain.
 */
async function markAsPaid(challanId) {
  const contract = getContract(true);
  const tx = await contract.markAsPaid(challanId);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, status: "paid" };
}

// ============================================================
//  READ FUNCTIONS (free, no gas)
// ============================================================

/**
 * Get violation details from blockchain.
 */
async function getViolation(challanId) {
  try {
    const contract = getContract(false);
    const v = await contract.getViolation(challanId);
    return {
      challanId:       v.challanId,
      vehicleNumber:   v.vehicleNumber,
      violationType:   v.violationType,
      location:        v.location,
      officerId:       v.officerId,
      fineAmount:      Number(v.fineAmount) / 100, // paise → rupees
      timestamp:       new Date(Number(v.timestamp) * 1000),
      severity:        ["", "Low", "Medium", "High", "Critical"][v.severity],
      isPaid:          v.isPaid,
      isRepeatOffender:v.isRepeatOffender,
      aiConfidence:    v.aiConfidence,
      ipfsImageHash:   v.ipfsImageHash,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Get all challan IDs for a vehicle number.
 */
async function getVehicleHistory(vehicleNumber) {
  const contract = getContract(false);
  return await contract.getVehicleHistory(vehicleNumber);
}

/**
 * Get total violation count for a vehicle.
 */
async function getViolationCount(vehicleNumber) {
  const contract = getContract(false);
  const count = await contract.getViolationCount(vehicleNumber);
  return Number(count);
}

/**
 * Get total violations recorded on the entire blockchain.
 */
async function getTotalViolations() {
  const contract = getContract(false);
  return Number(await contract.getTotalViolations());
}

/**
 * Get current block number (proof the chain is live).
 */
async function getBlockNumber() {
  const provider = getProvider();
  return await provider.getBlockNumber();
}

/**
 * Health check: is the blockchain node reachable?
 */
async function isConnected() {
  try {
    await getBlockNumber();
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  recordViolation,
  markAsPaid,
  getViolation,
  getVehicleHistory,
  getViolationCount,
  getTotalViolations,
  getBlockNumber,
  isConnected,
};
