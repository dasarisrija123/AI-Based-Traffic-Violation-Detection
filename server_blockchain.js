/**
 * =====================================================
 *  server.js  — TrafficAI Backend WITH Blockchain
 *  Node.js + Express + Claude AI + Ethereum/Polygon
 * =====================================================
 */

require("dotenv").config();
const express     = require("express");
const cors        = require("cors");
const multer      = require("multer");
const Anthropic   = require("@anthropic-ai/sdk");
const blockchain  = require("./blockchain"); // ← Our blockchain module

const app    = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Fine chart (in INR)
const FINES = {
  "No Helmet": 500, "Signal Jump": 1000, "Over Speed": 2000,
  "Triple Riding": 700, "Wrong Route Driving": 500,
  "No Seatbelt": 500, "Mobile Usage": 1500, "Drunk Driving": 5000,
};

// In-memory violation count (replace with MongoDB for production)
const violationCounts = {};

// =====================================================
//  GET /api/health  — System + Blockchain status
// =====================================================
app.get("/api/health", async (req, res) => {
  const chainConnected = await blockchain.isConnected();
  const blockNumber    = chainConnected ? await blockchain.getBlockNumber() : null;
  const totalOnChain   = chainConnected ? await blockchain.getTotalViolations() : 0;

  res.json({
    status: "ok",
    ai: "Claude claude-opus-4-6 ready",
    blockchain: {
      connected: chainConnected,
      network:   process.env.BLOCKCHAIN_NETWORK || "localhost",
      contract:  process.env.CONTRACT_ADDRESS   || "not set",
      latestBlock: blockNumber,
      totalViolationsOnChain: totalOnChain,
    },
    timestamp: new Date(),
  });
});

// =====================================================
//  POST /api/detect  — AI detection + blockchain record
// =====================================================
app.post("/api/detect", upload.single("image"), async (req, res) => {
  try {
    const { vehicleNumber, violationType, location, officerId } = req.body;
    if (!vehicleNumber || !violationType)
      return res.status(400).json({ success: false, error: "vehicleNumber and violationType required" });

    // ---- 1. Call Claude AI ----
    const aiData = await runAIAnalysis(vehicleNumber, violationType, location, req.file);

    // ---- 2. Build violation record ----
    const challanId = `CH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const pastCount = violationCounts[vehicleNumber] || 0;
    const isRepeat  = pastCount >= 2;
    const baseFine  = FINES[violationType] || 500;
    const fine      = isRepeat ? Math.round(baseFine * 1.5) : baseFine;

    violationCounts[vehicleNumber] = pastCount + 1;

    const violationData = {
      challanId,
      vehicleNumber,
      violationType,
      location:   location || "Unknown",
      officerId:  officerId || "SYSTEM-AUTO",
      fine,
      isRepeat,
      totalViolations: pastCount + 1,
      aiData,
      ipfsHash: "", // Optional: add IPFS upload here
      timestamp: new Date(),
    };

    // ---- 3. Record on Blockchain ----
    let blockchainResult = null;
    try {
      blockchainResult = await blockchain.recordViolation(violationData);
      console.log("✅ Blockchain TX:", blockchainResult.txHash);
    } catch (chainErr) {
      console.error("⚠️  Blockchain record failed (proceeding without it):", chainErr.message);
      blockchainResult = { error: chainErr.message, status: "failed" };
    }

    // ---- 4. Respond ----
    res.json({
      success: true,
      ...violationData,
      blockchain: blockchainResult,
    });

  } catch (err) {
    console.error("Detection error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
//  GET /api/blockchain/violation/:challanId
//  Fetch a violation record DIRECTLY from the chain
// =====================================================
app.get("/api/blockchain/violation/:challanId", async (req, res) => {
  try {
    const record = await blockchain.getViolation(req.params.challanId);
    if (!record)
      return res.status(404).json({ success: false, error: "Challan not found on blockchain" });
    res.json({ success: true, source: "blockchain", record });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
//  GET /api/blockchain/vehicle/:vehicleNumber
//  Get all violations for a vehicle from the chain
// =====================================================
app.get("/api/blockchain/vehicle/:vehicleNumber", async (req, res) => {
  try {
    const challanIds = await blockchain.getVehicleHistory(req.params.vehicleNumber);
    const count      = challanIds.length;

    // Fetch full details for each challan
    const records = await Promise.all(
      challanIds.map(id => blockchain.getViolation(id))
    );

    res.json({
      success: true,
      source: "blockchain",
      vehicleNumber: req.params.vehicleNumber,
      totalViolations: count,
      isRepeatOffender: count >= 3,
      records: records.filter(Boolean),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
//  PATCH /api/blockchain/pay/:challanId
//  Mark a challan as paid on the blockchain
// =====================================================
app.patch("/api/blockchain/pay/:challanId", async (req, res) => {
  try {
    const result = await blockchain.markAsPaid(req.params.challanId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
//  GET /api/blockchain/stats  — Chain-wide stats
// =====================================================
app.get("/api/blockchain/stats", async (req, res) => {
  try {
    const [total, blockNum] = await Promise.all([
      blockchain.getTotalViolations(),
      blockchain.getBlockNumber(),
    ]);
    res.json({
      success: true,
      totalViolationsOnChain: total,
      latestBlock: blockNum,
      contractAddress: process.env.CONTRACT_ADDRESS,
      network: process.env.BLOCKCHAIN_NETWORK || "localhost",
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
//  POST /api/analyze  — AI proxy (used by frontend)
// =====================================================
app.post("/api/analyze", async (req, res) => {
  try {
    const { vehicleNum, violationType, location, imageDataUrl } = req.body;
    const aiData = await runAIAnalysisFromBase64(vehicleNum, violationType, location, imageDataUrl);
    res.json({ success: true, analysis: JSON.stringify(aiData) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// =====================================================
//  HELPERS
// =====================================================
async function runAIAnalysis(vehicleNum, violationType, location, imageFile) {
  const prompt = buildPrompt(vehicleNum, violationType, location);
  let messages;

  if (imageFile) {
    messages = [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: imageFile.mimetype, data: imageFile.buffer.toString("base64") }},
      { type: "text", text: prompt }
    ]}];
  } else {
    messages = [{ role: "user", content: prompt }];
  }

  const resp = await anthropic.messages.create({
    model: "claude-opus-4-6", max_tokens: 800, messages
  });

  return parseAI(resp.content[0].text);
}

async function runAIAnalysisFromBase64(vehicleNum, violationType, location, imageDataUrl) {
  const prompt = buildPrompt(vehicleNum, violationType, location);
  let messages;

  if (imageDataUrl?.startsWith("data:image")) {
    const [meta, base64] = imageDataUrl.split(",");
    const mimeType = meta.match(/:(.*?);/)[1];
    messages = [{ role: "user", content: [
      { type: "image", source: { type: "base64", media_type: mimeType, data: base64 }},
      { type: "text", text: prompt }
    ]}];
  } else {
    messages = [{ role: "user", content: prompt }];
  }

  const resp = await anthropic.messages.create({
    model: "claude-opus-4-6", max_tokens: 800, messages
  });

  return parseAI(resp.content[0].text);
}

function parseAI(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
  } catch (_) {}
  return { violationConfirmed: true, confidence: 85, severity: "Medium", aiSummary: text.slice(0, 200) };
}

function buildPrompt(vehicle, violation, location) {
  return `You are an AI traffic violation detection system for Indian roads.
Vehicle: ${vehicle}, Violation: ${violation}, Location: ${location || "Unknown"}.
Respond ONLY with valid JSON:
{"violationConfirmed":true,"confidence":94,"severity":"High","vehicleType":"Two-Wheeler","aiSummary":"Clear violation.","recommendation":"Issue challan.","additionalViolations":[],"weatherCondition":"Clear","trafficDensity":"Moderate"}`;
}

// =====================================================
//  START
// =====================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`\n🚦 TrafficAI Backend  →  http://localhost:${PORT}`);
  console.log(`🤖 AI: Claude claude-opus-4-6`);

  const ok = await blockchain.isConnected();
  if (ok) {
    const block = await blockchain.getBlockNumber();
    console.log(`⛓️  Blockchain: CONNECTED  |  Block #${block}`);
    console.log(`📄 Contract: ${process.env.CONTRACT_ADDRESS || "check deployed.json"}`);
  } else {
    console.log(`⚠️  Blockchain: NOT CONNECTED (run: npx hardhat node)`);
  }
  console.log();
});

module.exports = app;
