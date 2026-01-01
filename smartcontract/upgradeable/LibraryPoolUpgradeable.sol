// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "../Libere1155Core.sol";

/* ---------- Minimal ERC-5006 interface ---------- */
interface IERC5006 is IERC165 {
    event CreateUserRecord(
        uint256 indexed recordId,
        address indexed owner,
        address indexed user,
        uint256 tokenId,
        uint64 amount,
        uint64 expiry
    );
    event DeleteUserRecord(uint256 indexed recordId);

    function createUserRecord(address owner, address user, uint256 tokenId, uint64 amount, uint64 expiry) external returns (uint256 recordId);
    function deleteUserRecord(uint256 recordId) external;

    function usableBalanceOf(address user, uint256 tokenId) external view returns (uint256);
    function frozenBalanceOf(address owner, uint256 tokenId) external view returns (uint256);
    function userRecordOf(uint256 recordId) external view returns (uint256 tokenId, address owner, address user, uint64 amount, uint64 expiry);
}

/* ---------- EAS (RESMI: struct-based ABI) ---------- */
interface IEAS {
    struct AttestationRequestData {
        address recipient;
        uint64  expirationTime;
        bool    revocable;
        bytes32 refUID;
        bytes   data;
        uint256 value;
    }

    struct AttestationRequest {
        bytes32 schema;
        AttestationRequestData data;
    }

    function attest(AttestationRequest calldata request) external payable returns (bytes32);
}

/**
 * @title LibraryPoolUpgradeable
 * @notice UUPS Upgradeable version of LibraryPool contract for ERC-5006 NFT borrowing/lending
 * @dev Implements ERC-5006 rental standard with UUPS proxy pattern
 */
contract LibraryPoolUpgradeable is
    Initializable,
    IERC5006,
    IERC1155Receiver,
    ERC165,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    UUPSUpgradeable
{
    using ECDSA for bytes32;

    /* ---------------- Events ---------------- */
    event RentalPeriodSet(uint256 indexed tokenId, uint64 duration);
    event Swept(uint256 indexed tokenId, uint256 removed, uint256 remainingActive);
    event PermitRequiredSet(bool required);
    event PermitSignerSet(address indexed signer);
    event EASSet(address indexed eas, bytes32 indexed schemaId);
    event EASAttested(bytes32 uid);
    event EASAttestSkipped();
    event EASAttestFailed(bytes reason);

    /* ---------------- External refs (CHANGED: removed immutable) ---------------- */
    Libere1155Core public core;  // Changed from immutable to regular storage

    /* ---------------- ERC-5006 storage ---------------- */
    struct UserRecord {
        uint256 tokenId;
        address owner; // pool (owner of this contract)
        address user;
        uint64  amount; // 1
        uint64  expiry; // unix seconds
        bool    active;
    }

    uint256 public nextRecordId;
    mapping(uint256 => UserRecord) private records;
    mapping(address => mapping(uint256 => uint256)) private activeRecordOf; // user => tokenId => recordId
    mapping(uint256 => uint256[]) private recordListByToken;                // tokenId => record list
    mapping(uint256 => uint256)  private sweepCursor;                       // tokenId => cursor

    /* ---------------- Borrow config ---------------- */
    mapping(uint256 => uint64) public rentalPeriod; // default 3 days
    uint256 public constant AUTO_SWEEP_QUOTA = 8;

    /* ---------------- Allowlist (EIP-712) ---------------- */
    address public permitSigner;
    bool    public permitRequired; // if true, permit (allowlist) required
    mapping(address => uint256) public nonces;

    /* ---------------- EAS wiring ---------------- */
    IEAS    public eas;
    bytes32 public easSchemaId;
    bool    public easRevocable;   // toggle agar cocok dengan properti schema (default false)
    bool    public easStrict;      // jika true: revert bila EAS gagal; jika false: lanjut & emit EASAttestFailed
    bytes32 public lastEASUid;     // UID terakhir untuk verifikasi cepat

    /* ---------------- Storage gap for future upgrades ---------------- */
    uint256[50] private __gap;

    /* ---------------- Constructor & Initializer ---------------- */

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the upgradeable contract
     * @param admin The address that will be the owner
     * @param core_ The Libere1155Core contract address
     */
    function initialize(address admin, Libere1155Core core_) public initializer {
        __Ownable_init(admin);
        __ReentrancyGuard_init();
        __EIP712_init("LibereLibraryPool", "1");
        __UUPSUpgradeable_init();

        core = core_;
        easRevocable = false; // skema disarankan non-revocable
        easStrict = false;    // default: UX tidak putus jika EAS gagal
        nextRecordId = 1;
    }

    /* ---------------- UUPS Authorization ---------------- */

    /**
     * @notice Authorize upgrade (only owner can upgrade)
     * @param newImplementation Address of new implementation contract
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice Get contract version
     * @return Version string
     */
    function version() public pure virtual returns (string memory) {
        return "1.0.0";
    }

    /* ---------------- Admin ---------------- */
    function setPermitSigner(address signer) external onlyOwner {
        permitSigner = signer;
        emit PermitSignerSet(signer);
    }

    function setPermitRequired(bool required) external onlyOwner {
        permitRequired = required;
        emit PermitRequiredSet(required);
    }

    function setRentalPeriod(uint256 tokenId, uint64 seconds_) external onlyOwner {
        rentalPeriod[tokenId] = seconds_;
        emit RentalPeriodSet(tokenId, seconds_);
    }

    function setEAS(IEAS eas_, bytes32 schemaId_) external onlyOwner {
        eas = eas_;
        easSchemaId = schemaId_;
        emit EASSet(address(eas_), schemaId_);
    }

    function setEASRevocable(bool v) external onlyOwner { easRevocable = v; }
    function setEASStrict(bool v) external onlyOwner { easStrict = v; }

    /* ---------------- EIP-712 Permit ---------------- */
    bytes32 public constant BORROW_PERMIT_TYPEHASH =
        keccak256("BorrowPermit(address user,address pool,uint256 tokenId,uint256 nonce,uint64 sigDeadline)");

    function _verifyPermit(address user, uint256 tokenId, uint64 sigDeadline, bytes calldata sig) internal {
        require(permitSigner != address(0), "permit signer not set");
        require(block.timestamp <= sigDeadline, "permit expired");

        bytes32 structHash = keccak256(abi.encode(
            BORROW_PERMIT_TYPEHASH,
            user,
            address(this),
            tokenId,
            nonces[user],
            sigDeadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, sig);
        require(recovered == permitSigner, "bad permit signature");

        unchecked { nonces[user] += 1; }
    }

    /* ---------------- Helpers ---------------- */
    function _now() internal view returns (uint64) { return uint64(block.timestamp); }
    function _defaultPeriod(uint256 tokenId) internal view returns (uint64 p) { p = rentalPeriod[tokenId]; if (p==0) p = 3 days; }

    /* ---------------- Stock views ---------------- */
    function _frozenNow(uint256 tokenId) internal view returns (uint256 count) {
        uint64 nowTs = _now();
        uint256[] storage list = recordListByToken[tokenId];
        for (uint256 i = 0; i < list.length; i++) {
            UserRecord storage r = records[list[i]];
            if (r.active && r.expiry > nowTs) count++;
        }
    }

    /// @notice (available, frozenNow) real-time stocks
    function previewAvailability(uint256 tokenId) external view returns (uint256 available, uint256 frozenNow) {
        frozenNow = _frozenNow(tokenId);
        uint256 stock = core.balanceOf(address(this), tokenId);
        available = stock > frozenNow ? stock - frozenNow : 0;
    }

    /* ---------------- Borrow/Return ---------------- */

    /// @notice Borrow tanpa permit (hanya jika permitRequired=false). Tetap 1:1 via 5006.
    function borrowFromPool(uint256 tokenId) external nonReentrant returns (uint256 recordId) {
        require(!permitRequired, "permit required");
        recordId = _borrowAfterGate(tokenId, msg.sender);
    }

    /// @notice Borrow dengan EIP-712 permit (SSO allowlist). Wajib jika permitRequired=true.
    function borrowFromPoolWithPermit(uint256 tokenId, uint64 sigDeadline, bytes calldata sig)
        external nonReentrant returns (uint256 recordId)
    {
        if (permitRequired) {
            _verifyPermit(msg.sender, tokenId, sigDeadline, sig);
        } else if (permitSigner != address(0) && sig.length > 0) {
            _verifyPermit(msg.sender, tokenId, sigDeadline, sig);
        }
        recordId = _borrowAfterGate(tokenId, msg.sender);
    }

    function _borrowAfterGate(uint256 tokenId, address user) internal returns (uint256 recordId) {
        // 1) auto-sweep kecil
        _sweepExpired(tokenId, AUTO_SWEEP_QUOTA);

        // 2) seat tersedia?
        uint256 frozen = _frozenNow(tokenId);
        uint256 stock  = core.balanceOf(address(this), tokenId);
        require(stock > frozen, "no stock");

        // 3) satu pinjaman aktif per user/judul
        uint256 existing = activeRecordOf[user][tokenId];
        if (existing != 0) {
            (, , , , uint64 exp) = userRecordOf(existing);
            require(exp <= _now() || !records[existing].active, "already borrowed");
        }

        // 4) buat record (amount=1)
        uint64 expiry = _now() + _defaultPeriod(tokenId);
        uint256 rid = createUserRecord(address(this), user, tokenId, 1, expiry);

        // 5) EAS (opsional) — attestation LoanIssued
        _attestLoan(user, tokenId, rid, expiry);

        return rid;
    }

    function _attestLoan(address user, uint256 tokenId, uint256 rid, uint64 expiry) internal {
        if (address(eas) == address(0) || easSchemaId == bytes32(0)) {
            emit EASAttestSkipped();
            return;
        }

        // PASTIKAN skema di EAS persis:
        // "address pool,address user,uint256 tokenId,uint256 recordId,uint64 expiry,uint64 issuedAt"
        bytes memory payload = abi.encode(
            address(this),   // pool
            user,            // user
            tokenId,
            rid,
            expiry,
            uint64(block.timestamp) // issuedAt
        );

        IEAS.AttestationRequest memory req = IEAS.AttestationRequest({
            schema: easSchemaId,
            data: IEAS.AttestationRequestData({
                recipient: address(0),   // atau user jika ingin
                expirationTime: 0,       // 0 = tidak expire di level attestation
                revocable: easRevocable, // harus cocok dengan properti schema
                refUID: bytes32(0),
                data: payload,
                value: 0
            })
        });

        if (easStrict) {
            // mode strict: biar error EAS kelihatan jelas (akan revert)
            bytes32 uid = eas.attest(req);
            lastEASUid = uid;
            emit EASAttested(uid);
        } else {
            // mode non-strict: UX tidak putus kalau EAS gagal
            try eas.attest(req) returns (bytes32 uid) {
                lastEASUid = uid;
                emit EASAttested(uid);
            } catch {
                emit EASAttestFailed("attest revert");
            }
        }
    }

    function returnBorrow(uint256 recordId) external nonReentrant {
        (, , address user, , ) = userRecordOf(recordId);
        require(msg.sender == user, "not borrower");
        deleteUserRecord(recordId);
    }

    function returnMyBorrow(uint256 tokenId) external nonReentrant {
        uint256 rid = activeRecordOf[msg.sender][tokenId];
        require(rid != 0, "no active");
        deleteUserRecord(rid);
    }

    /* ---------------- ERC-5006 core ---------------- */
    function createUserRecord(
        address owner, address user, uint256 tokenId, uint64 amount, uint64 expiry
    ) public override returns (uint256 recordId) {
        require(owner == address(this), "owner must be pool");
        require(user != address(0), "bad user");
        require(amount == 1, "amount=1");
        require(expiry > _now(), "expiry past");

        uint256 frozen = _frozenNow(tokenId);
        uint256 stock  = core.balanceOf(address(this), tokenId);
        require(stock > frozen, "no stock");

        uint256 existing = activeRecordOf[user][tokenId];
        if (existing != 0) {
            (, , , , uint64 exp) = userRecordOf(existing);
            require(exp <= _now() || !records[existing].active, "already borrowed");
        }

        recordId = nextRecordId++;
        records[recordId] = UserRecord({
            tokenId: tokenId,
            owner: owner,
            user: user,
            amount: 1,
            expiry: expiry,
            active: true
        });

        activeRecordOf[user][tokenId] = recordId;
        recordListByToken[tokenId].push(recordId);

        emit CreateUserRecord(recordId, owner, user, tokenId, 1, expiry);
    }

    function deleteUserRecord(uint256 recordId) public override {
        UserRecord storage r = records[recordId];
        require(r.active, "not active");

        bool isUser  = (msg.sender == r.user);
        bool isPool  = (msg.sender == r.owner);
        bool isAdmin = (msg.sender == owner());
        bool expired = (r.expiry <= _now());
        require(isUser || isPool || isAdmin || expired, "no permission");

        r.active = false;
        if (activeRecordOf[r.user][r.tokenId] == recordId) {
            activeRecordOf[r.user][r.tokenId] = 0;
        }
        emit DeleteUserRecord(recordId);
    }

    function usableBalanceOf(address user, uint256 tokenId) public view override returns (uint256) {
        uint256 rid = activeRecordOf[user][tokenId];
        if (rid == 0) return 0;
        UserRecord storage r = records[rid];
        if (!r.active || r.expiry <= _now()) return 0;
        return 1;
    }

    function frozenBalanceOf(address owner, uint256 tokenId) public view override returns (uint256) {
        if (owner != address(this)) return 0;
        return _frozenNow(tokenId);
    }

    function userRecordOf(uint256 recordId)
        public view override
        returns (uint256 tokenId, address owner, address user, uint64 amount, uint64 expiry)
    {
        UserRecord storage r = records[recordId];
        return (r.tokenId, r.owner, r.user, r.amount, r.expiry);
    }

    /* ---------------- Sweep ---------------- */
    function sweepExpiredRecords(uint256 tokenId, uint256 maxOps) external returns (uint256 removed) {
        removed = _sweepExpired(tokenId, maxOps);
        emit Swept(tokenId, removed, _frozenNow(tokenId));
    }

    function sweepExpiredGlobal(uint256[] calldata ids, uint256 maxPerToken) external returns (uint256 totalRemoved) {
        for (uint256 i = 0; i < ids.length; i++) {
            uint256 removed = _sweepExpired(ids[i], maxPerToken);
            totalRemoved += removed;
            emit Swept(ids[i], removed, _frozenNow(ids[i]));
        }
    }

    function _sweepExpired(uint256 tokenId, uint256 maxOps) internal returns (uint256 removed) {
        uint256[] storage list = recordListByToken[tokenId];
        uint256 cursor = sweepCursor[tokenId];
        uint256 n = list.length;
        uint64 nowTs = _now();

        while (cursor < n && removed < maxOps) {
            uint256 rid = list[cursor];
            UserRecord storage r = records[rid];
            if (r.active && r.expiry <= nowTs) {
                r.active = false;
                if (activeRecordOf[r.user][r.tokenId] == rid) {
                    activeRecordOf[r.user][r.tokenId] = 0;
                }
                emit DeleteUserRecord(rid);
                removed++;
            }
            cursor++;
        }
        if (cursor >= n) cursor = 0;
        sweepCursor[tokenId] = cursor;
    }

    /* ---------------- IERC165 / IERC1155Receiver ---------------- */
    function supportsInterface(bytes4 interfaceId) public view override(ERC165, IERC165) returns (bool) {
        // ERC-5006 interface id (referensi)
        return interfaceId == 0xc26d96cc || super.supportsInterface(interfaceId);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }
    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external pure override returns (bytes4)
    { return this.onERC1155BatchReceived.selector; }
}
