import { getblock } from "./getblock.config";

export function getConfiguredSepoliaRpc() {
  const tokenEntry = getblock?.shared?.eth?.sepolia?.jsonRpc?.[0];

  if (!tokenEntry || typeof tokenEntry.go !== "function") {
    throw new Error("Could not find getblock.shared.eth.sepolia.jsonRpc[0].go() in getblock.config.js.");
  }

  const rpcUrl = tokenEntry.go();

  if (!rpcUrl || typeof rpcUrl !== "string") {
    throw new Error("GetBlock Sepolia RPC URL is invalid.");
  }

  return {
    rpcUrl,
    token: typeof tokenEntry.token === "function" ? tokenEntry.token() : ""
  };
}

export async function callRpcMethod(rpcUrl, method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id: `${method}-getblock`
    })
  });

  if (!response.ok) {
    throw new Error(`GetBlock RPC request failed with status ${response.status}.`);
  }

  const payload = await response.json();

  if (payload?.error) {
    throw new Error(payload.error.message || "GetBlock RPC returned an error.");
  }

  return payload?.result || "";
}

export async function fetchChainIdFromRpc(rpcUrl) {
  return callRpcMethod(rpcUrl, "eth_chainId");
}

export async function waitForTransactionReceipt(rpcUrl, txHash, options = {}) {
  const timeoutMs = options.timeoutMs ?? 180000;
  const pollIntervalMs = options.pollIntervalMs ?? 2500;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const receipt = await callRpcMethod(rpcUrl, "eth_getTransactionReceipt", [txHash]);

    if (receipt) {
      return receipt;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, pollIntervalMs);
    });
  }

  throw new Error("Timed out while waiting for the Sepolia confirmation transaction.");
}
