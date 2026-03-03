// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * ============================================================
 *  TrafficViolationLedger — Smart Contract
 *  Stores every challan permanently & tamper-proof on-chain.
 * ============================================================
 *  Deploy on:
 *    Local  → Hardhat / Ganache (free, instant)
 *    Testnet → Polygon Amoy / Sepolia (free test ETH)
 *    Mainnet → Polygon (cheap gas ~$0.001 per tx)
 * ============================================================
 */
contract TrafficViolationLedger {

    // ---- Owner (Traffic Authority) ----
    address public owner;
    mapping(address => bool) public authorizedOfficers;

    // ---- Data Structures ----
    struct Violation {
        string  challanId;
        string  vehicleNumber;
        string  violationType;
        string  location;
        string  officerId;
        uint256 fineAmount;       // in paise (1 INR = 100 paise) to avoid decimals
        uint256 timestamp;
        uint8   severity;         // 1=Low 2=Medium 3=High 4=Critical
        bool    isPaid;
        bool    isRepeatOffender;
        string  aiConfidence;     // e.g. "94%"
        string  ipfsImageHash;    // IPFS hash of violation image (optional)
    }

    // ---- Storage ----
    // challanId → Violation
    mapping(string => Violation) public violations;

    // vehicleNumber → list of challanIds
    mapping(string => string[]) public vehicleHistory;

    // All challan IDs ever recorded
    string[] public allChallanIds;

    // ---- Events (indexed for fast frontend queries) ----
    event ViolationRecorded(
        string  indexed challanId,
        string  indexed vehicleNumber,
        string  violationType,
        uint256 fineAmount,
        uint256 timestamp
    );

    event FinePaid(
        string  indexed challanId,
        string  indexed vehicleNumber,
        uint256 fineAmount,
        uint256 paidAt
    );

    event OfficerAuthorized(address indexed officer);
    event OfficerRevoked(address indexed officer);

    // ---- Modifiers ----
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner allowed");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == owner || authorizedOfficers[msg.sender],
            "Not authorized"
        );
        _;
    }

    modifier challanExists(string memory challanId) {
        require(
            bytes(violations[challanId].challanId).length > 0,
            "Challan not found"
        );
        _;
    }

    // ---- Constructor ----
    constructor() {
        owner = msg.sender;
        authorizedOfficers[msg.sender] = true;
    }

    // ---- Write Functions ----

    /**
     * @dev Record a new traffic violation on the blockchain.
     * Called by your Node.js backend after AI detection.
     */
    function recordViolation(
        string memory _challanId,
        string memory _vehicleNumber,
        string memory _violationType,
        string memory _location,
        string memory _officerId,
        uint256 _fineAmount,
        uint8 _severity,
        bool _isRepeat,
        string memory _aiConfidence,
        string memory _ipfsImageHash
    ) public onlyAuthorized {
        require(bytes(_challanId).length > 0, "Challan ID required");
        require(
            bytes(violations[_challanId].challanId).length == 0,
            "Challan already exists"
        );

        violations[_challanId] = Violation({
            challanId:       _challanId,
            vehicleNumber:   _vehicleNumber,
            violationType:   _violationType,
            location:        _location,
            officerId:       _officerId,
            fineAmount:      _fineAmount,
            timestamp:       block.timestamp,
            severity:        _severity,
            isPaid:          false,
            isRepeatOffender:_isRepeat,
            aiConfidence:    _aiConfidence,
            ipfsImageHash:   _ipfsImageHash
        });

        vehicleHistory[_vehicleNumber].push(_challanId);
        allChallanIds.push(_challanId);

        emit ViolationRecorded(
            _challanId,
            _vehicleNumber,
            _violationType,
            _fineAmount,
            block.timestamp
        );
    }

    /**
     * @dev Mark a challan as paid.
     */
    function markAsPaid(string memory _challanId)
        public
        onlyAuthorized
        challanExists(_challanId)
    {
        require(!violations[_challanId].isPaid, "Already paid");
        violations[_challanId].isPaid = true;

        emit FinePaid(
            _challanId,
            violations[_challanId].vehicleNumber,
            violations[_challanId].fineAmount,
            block.timestamp
        );
    }

    // ---- Read Functions ----

    /**
     * @dev Get full details of a violation by challan ID.
     */
    function getViolation(string memory _challanId)
        public
        view
        challanExists(_challanId)
        returns (Violation memory)
    {
        return violations[_challanId];
    }

    /**
     * @dev Get all challan IDs for a vehicle.
     */
    function getVehicleHistory(string memory _vehicleNumber)
        public
        view
        returns (string[] memory)
    {
        return vehicleHistory[_vehicleNumber];
    }

    /**
     * @dev Get violation count for a vehicle.
     */
    function getViolationCount(string memory _vehicleNumber)
        public
        view
        returns (uint256)
    {
        return vehicleHistory[_vehicleNumber].length;
    }

    /**
     * @dev Get total number of violations ever recorded.
     */
    function getTotalViolations() public view returns (uint256) {
        return allChallanIds.length;
    }

    // ---- Admin Functions ----

    function authorizeOfficer(address _officer) public onlyOwner {
        authorizedOfficers[_officer] = true;
        emit OfficerAuthorized(_officer);
    }

    function revokeOfficer(address _officer) public onlyOwner {
        authorizedOfficers[_officer] = false;
        emit OfficerRevoked(_officer);
    }
}
