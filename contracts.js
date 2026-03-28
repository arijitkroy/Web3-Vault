export const VAULT_PAYMENT_ADDRESS = "0x59b19C5982f1444f620fC642839A3fea046d0F59";
export const VAULT_REGISTRY_ADDRESS = "0xd736E7D4b3eF43fE0790607B21e0d1e9E005b1e7";

export const VAULT_PAYMENT_ABI = [
  "function payForAction(string calldata actionType) external payable",
  "function fee() external view returns (uint256)",
  "event ActionPaid(address indexed user, string actionType, uint256 amount, uint256 timestamp)"
];

export const VAULT_REGISTRY_ABI = [
  "function registerReceipt(bytes32 receiptHash) external",
  "function verifyReceipt(address user, bytes32 receiptHash) external view returns (bool)",
  "function getReceiptCount(address user) external view returns (uint256)",
  "event ReceiptRegistered(address indexed user, bytes32 receiptHash, uint256 timestamp)"
];

const SELECTOR_PAY_FOR_ACTION = "0x9181bd4c";
const SELECTOR_REGISTER_RECEIPT = "0xf37ca3d8";
const SELECTOR_FEE = "0xddca3f43";

export function encodePayForAction(actionType) {
  return SELECTOR_PAY_FOR_ACTION + abiEncodeString(actionType);
}

export function encodeRegisterReceipt(receiptHash) {
  const hash = receiptHash.startsWith("0x") ? receiptHash.slice(2) : receiptHash;
  return SELECTOR_REGISTER_RECEIPT + hash.padStart(64, "0");
}

export function encodeFeeCall() {
  return SELECTOR_FEE;
}

export async function hashReceiptForRegistry(receiptJson) {
  const encoder = new TextEncoder();
  const data = encoder.encode(
    typeof receiptJson === "string" ? receiptJson : JSON.stringify(receiptJson)
  );
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return "0x" + Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function abiEncodeString(value) {
  const offset = "0000000000000000000000000000000000000000000000000000000000000020";
  const length = value.length.toString(16).padStart(64, "0");
  const hex = Array.from(new TextEncoder().encode(value))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, "0");
  return offset + length + padded;
}
