const textEncoder = new TextEncoder();

export const VAULT_VERSION = 1;
export const PBKDF2_ITERATIONS = 250000;

export function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function formatBytes(value) {
  if (!Number.isFinite(value) || value < 1024) {
    return `${value || 0} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = -1;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

export function slugifyLabel(value, fallback) {
  const source = value || fallback || "vault";

  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "vault";
}

export async function deriveAesKey(passphrase, salt, usages, iterations = PBKDF2_ITERATIONS) {
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    passphraseKey,
    {
      name: "AES-GCM",
      length: 256
    },
    false,
    usages
  );
}

export function buildManifest({ sourceFile, label, salt, iv, walletContext, paymentContext }) {
  return {
    vaultVersion: VAULT_VERSION,
    vaultLabel: label,
    createdAt: new Date().toISOString(),
    walletContext: walletContext || null,
    paymentContext: paymentContext || null,
    encryption: {
      algorithm: "AES-256-GCM",
      iv: bytesToBase64(iv),
      keyDerivation: {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: PBKDF2_ITERATIONS,
        salt: bytesToBase64(salt)
      }
    },
    originalFile: {
      name: sourceFile.name,
      type: sourceFile.type || "application/octet-stream",
      size: sourceFile.size
    },
    decryptionMethod: [
      "Open Web3 Vault in a modern browser.",
      "Connect MetaMask and switch to Sepolia.",
      "Select the encrypted file and this receipt JSON.",
      "Enter the same passphrase used during encryption.",
      "Decrypt to restore the original file."
    ]
  };
}

export async function readManifest(file) {
  const text = await file.text();
  const manifest = JSON.parse(text);

  if (
    !manifest ||
    manifest.vaultVersion !== VAULT_VERSION ||
    !manifest.encryption ||
    !manifest.encryption.keyDerivation ||
    !manifest.originalFile
  ) {
    throw new Error("Unsupported or invalid receipt file.");
  }

  if (manifest.encryption.algorithm !== "AES-256-GCM") {
    throw new Error("This receipt does not describe an AES-256-GCM vault.");
  }

  if (manifest.encryption.keyDerivation.name !== "PBKDF2") {
    throw new Error("Unsupported key derivation method in receipt.");
  }

  return manifest;
}

export async function encryptVaultFile({ sourceFile, passphrase, vaultLabel, walletContext, paymentContext }) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBytes = new Uint8Array(await sourceFile.arrayBuffer());
  const key = await deriveAesKey(passphrase, salt, ["encrypt"]);
  const encryptedBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, fileBytes);
  const encryptedBytes = new Uint8Array(encryptedBuffer);
  const label = slugifyLabel(vaultLabel, sourceFile.name);
  const manifest = buildManifest({
    sourceFile,
    label,
    salt,
    iv,
    walletContext,
    paymentContext
  });

  return {
    encryptedBlob: new Blob([encryptedBytes], { type: "application/octet-stream" }),
    encryptedFilename: `${label}.vault`,
    manifestBlob: new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" }),
    manifestFilename: `${label}.receipt.json`,
    manifest
  };
}

export async function decryptVaultFile({ encryptedFile, manifestFile, passphrase }) {
  const manifest = await readManifest(manifestFile);
  const salt = base64ToBytes(manifest.encryption.keyDerivation.salt);
  const iv = base64ToBytes(manifest.encryption.iv);
  const iterations = Number(manifest.encryption.keyDerivation.iterations);
  const encryptedBytes = new Uint8Array(await encryptedFile.arrayBuffer());

  if (!Number.isInteger(iterations) || iterations < 100000) {
    throw new Error("Invalid PBKDF2 iteration count in receipt.");
  }

  const key = await deriveAesKey(passphrase, salt, ["decrypt"], iterations);
  const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encryptedBytes);

  return {
    restoredBlob: new Blob([decryptedBuffer], {
      type: manifest.originalFile.type || "application/octet-stream"
    }),
    restoredFilename: manifest.originalFile.name || "restored-file",
    manifest
  };
}
