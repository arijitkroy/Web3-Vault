export const SEPOLIA_CHAIN_ID = "0xaa36a7";

export const SEPOLIA_NETWORK = {
  chainId: SEPOLIA_CHAIN_ID,
  chainName: "Sepolia",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18
  },
  rpcUrls: ["https://rpc.sepolia.org"],
  blockExplorerUrls: ["https://sepolia.etherscan.io"]
};

export function getEthereumProvider() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.ethereum ?? null;
}

export async function readWalletSnapshot() {
  const provider = getEthereumProvider();

  if (!provider) {
    return {
      hasProvider: false,
      account: "",
      chainId: "",
      isSepolia: false
    };
  }

  const [accounts, chainId] = await Promise.all([
    provider.request({ method: "eth_accounts" }),
    provider.request({ method: "eth_chainId" })
  ]);

  return {
    hasProvider: true,
    account: accounts?.[0] ?? "",
    chainId,
    isSepolia: chainId === SEPOLIA_CHAIN_ID
  };
}

export async function connectMetaMask() {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("MetaMask was not detected in this browser.");
  }

  const accounts = await provider.request({ method: "eth_requestAccounts" });
  const chainId = await provider.request({ method: "eth_chainId" });

  return {
    hasProvider: true,
    account: accounts?.[0] ?? "",
    chainId,
    isSepolia: chainId === SEPOLIA_CHAIN_ID
  };
}

export async function ensureSepoliaNetwork(customRpcUrl) {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("MetaMask was not detected in this browser.");
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_CHAIN_ID }]
    });
  } catch (error) {
    if (error?.code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{
        ...SEPOLIA_NETWORK,
        rpcUrls: customRpcUrl ? [customRpcUrl] : SEPOLIA_NETWORK.rpcUrls
      }]
    });
  }

  return readWalletSnapshot();
}

export async function sendVaultActionTransaction(fromAddress) {
  const provider = getEthereumProvider();

  if (!provider) {
    throw new Error("MetaMask was not detected in this browser.");
  }

  if (!fromAddress) {
    throw new Error("Connect MetaMask before creating a payment transaction.");
  }

  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: fromAddress,
      to: fromAddress,
      value: "0x0"
    }]
  });

  return txHash;
}

export function shortenAddress(address) {
  if (!address) {
    return "";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
