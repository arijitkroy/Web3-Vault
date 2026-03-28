import { startTransition, useEffect, useRef, useState } from "react";
import { fetchChainIdFromRpc, getConfiguredSepoliaRpc, waitForTransactionReceipt } from "./getblock";
import { decryptVaultFile, encryptVaultFile, formatBytes } from "./vault";
import {
  connectMetaMask,
  ensureSepoliaNetwork,
  getEthereumProvider,
  readWalletSnapshot,
  registerReceiptOnChain,
  SEPOLIA_CHAIN_ID,
  sendVaultPayment,
  shortenAddress
} from "./wallet";

const securityCards = [
  {
    label: "Algorithm",
    title: "AES-256-GCM",
    text: "Authenticated encryption for confidentiality and tamper detection."
  },
  {
    label: "Key Derivation",
    title: "PBKDF2 / SHA-256",
    text: "Derives the vault key from your passphrase with a unique salt."
  },
  {
    label: "Network",
    title: "Smart contract billing",
    text: "Each encrypt and decrypt action calls a Solidity smart contract on Sepolia that collects a fee and records an on-chain event."
  }
];

const notes = [
  {
    title: "GitHub Pages ready",
    text: "The app is configured for static Vite builds and deploys cleanly through GitHub Actions to Pages."
  },
  {
    title: "Wallet-linked receipts",
    text: "Each encryption receipt now stores the MetaMask address, network context, and Sepolia payment transaction for that specific encryption action."
  },
  {
    title: "Runtime GetBlock config",
    text: "The app reads the local getblock.config.js module and uses its Sepolia endpoint to drive the wallet session."
  }
];

function createDownloadState(blob, filename) {
  return {
    filename,
    url: URL.createObjectURL(blob)
  };
}

function DownloadLink({ item, className, children }) {
  if (!item) {
    return null;
  }

  return (
    <a className={className} href={item.url} download={item.filename}>
      {children}
    </a>
  );
}

function shortenHash(hash) {
  if (!hash) {
    return "";
  }

  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function walletGateMessage(wallet, getblockSession) {
  if (!getblockSession.verified) {
    return "Load a valid getblock.config.js with a verified Sepolia RPC before using the vault.";
  }

  if (!wallet.hasProvider) {
    return "Install MetaMask to use the Sepolia vault flow.";
  }

  if (!wallet.account) {
    return "Connect MetaMask before encrypting or decrypting.";
  }

  if (!wallet.isSepolia) {
    return "Switch MetaMask to Sepolia before using the vault.";
  }

  return "";
}

export default function App() {
  const [wallet, setWallet] = useState({
    hasProvider: false,
    account: "",
    chainId: "",
    isSepolia: false
  });
  const [walletStatus, setWalletStatus] = useState({ type: "", message: "Checking wallet availability." });
  const [connectBusy, setConnectBusy] = useState(false);
  const [switchBusy, setSwitchBusy] = useState(false);
  const [getblockSession, setGetblockSession] = useState({
    rpcUrl: "",
    chainId: "",
    verified: false
  });
  const [getblockStatus, setGetblockStatus] = useState({
    type: "",
    message: "Loading GetBlock Sepolia configuration."
  });
  const [paymentSession, setPaymentSession] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState({
    type: "warning",
    message: "Each encrypt and decrypt action calls the VaultPayment contract on Sepolia."
  });
  const [paymentBusy, setPaymentBusy] = useState(false);

  const [encryptFile, setEncryptFile] = useState(null);
  const [encryptPassphrase, setEncryptPassphrase] = useState("");
  const [encryptConfirm, setEncryptConfirm] = useState("");
  const [vaultLabel, setVaultLabel] = useState("");
  const [encryptStatus, setEncryptStatus] = useState({ type: "", message: "" });
  const [encryptBusy, setEncryptBusy] = useState(false);
  const [encryptResult, setEncryptResult] = useState(null);

  const [decryptFile, setDecryptFile] = useState(null);
  const [manifestFile, setManifestFile] = useState(null);
  const [decryptPassphrase, setDecryptPassphrase] = useState("");
  const [decryptStatus, setDecryptStatus] = useState({ type: "", message: "" });
  const [decryptBusy, setDecryptBusy] = useState(false);
  const [decryptResult, setDecryptResult] = useState(null);

  const previousEncryptUrls = useRef([]);
  const previousDecryptUrls = useRef([]);

  useEffect(() => {
    let active = true;

    async function loadGetBlockSession() {
      try {
        const session = getConfiguredSepoliaRpc();
        const chainId = await fetchChainIdFromRpc(session.rpcUrl);

        if (!active) {
          return;
        }

        if (chainId !== SEPOLIA_CHAIN_ID) {
          throw new Error(`GetBlock endpoint returned ${chainId}, not Sepolia (${SEPOLIA_CHAIN_ID}).`);
        }

        setGetblockSession({
          rpcUrl: session.rpcUrl,
          chainId,
          verified: true
        });
        setGetblockStatus({
          type: "success",
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setGetblockSession({
          rpcUrl: "",
          chainId: "",
          verified: false
        });
        setGetblockStatus({
          type: "error",
          message: error.message || "Unable to load GetBlock Sepolia configuration."
        });
      }
    }

    loadGetBlockSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const provider = getEthereumProvider();

    async function syncWallet() {
      try {
        const snapshot = await readWalletSnapshot();

        if (!active) {
          return;
        }

        setWallet(snapshot);

        if (!snapshot.hasProvider) {
          setWalletStatus({ type: "warning", message: "MetaMask was not detected. Install it to enable the Sepolia dapp flow." });
        } else if (!snapshot.account) {
          setWalletStatus({ type: "warning", message: "MetaMask detected. Connect your wallet to start a Sepolia vault session." });
        } else if (!snapshot.isSepolia) {
          setWalletStatus({ type: "warning", message: "Wallet connected. Switch to Sepolia to use the vault tools." });
        } else {
          setWalletStatus({ type: "success", message: "MetaMask connected on Sepolia. The vault is ready, and each action will request its own payment transaction." });
        }
      } catch (error) {
        if (active) {
          setWalletStatus({ type: "error", message: error.message || "Unable to read MetaMask state." });
        }
      }
    }

    syncWallet();

    if (!provider?.on) {
      return () => {
        active = false;
      };
    }

    const handleWalletChange = () => {
      syncWallet();
    };

    provider.on("accountsChanged", handleWalletChange);
    provider.on("chainChanged", handleWalletChange);

    return () => {
      active = false;
      provider.removeListener?.("accountsChanged", handleWalletChange);
      provider.removeListener?.("chainChanged", handleWalletChange);
    };
  }, []);

  useEffect(() => {
    previousEncryptUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previousEncryptUrls.current = [];

    if (encryptResult) {
      previousEncryptUrls.current = [
        encryptResult.encryptedDownload.url,
        encryptResult.manifestDownload.url
      ];
    }

    return () => {
      previousEncryptUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previousEncryptUrls.current = [];
    };
  }, [encryptResult]);

  useEffect(() => {
    previousDecryptUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previousDecryptUrls.current = [];

    if (decryptResult) {
      previousDecryptUrls.current = [decryptResult.restoredDownload.url];
    }

    return () => {
      previousDecryptUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previousDecryptUrls.current = [];
    };
  }, [decryptResult]);

  useEffect(() => {
    setPaymentSession(null);
    setPaymentStatus({
      type: "warning",
      message: "Each encrypt and decrypt action calls the VaultPayment contract on Sepolia."
    });
  }, [wallet.account, wallet.chainId, wallet.isSepolia]);

  async function handleConnectWallet() {
    setConnectBusy(true);
    setWalletStatus({ type: "", message: "Requesting MetaMask connection." });

    try {
      const snapshot = await connectMetaMask();
      setWallet(snapshot);

      if (snapshot.isSepolia) {
        setWalletStatus({ type: "success", message: "MetaMask connected on Sepolia. The vault is ready, and each action will request its own payment transaction." });
      } else {
        setWalletStatus({ type: "warning", message: "Wallet connected. Switch to Sepolia to continue." });
      }
    } catch (error) {
      setWalletStatus({ type: "error", message: error.message || "MetaMask connection failed." });
    } finally {
      setConnectBusy(false);
    }
  }

  function handleResetSession() {
    setPaymentSession(null);
    setPaymentStatus({
      type: "warning",
      message: "Each encrypt and decrypt action calls the VaultPayment contract on Sepolia."
    });
    setEncryptResult(null);
    setDecryptResult(null);
    setEncryptStatus({ type: "", message: "" });
    setDecryptStatus({ type: "", message: "" });
    setEncryptFile(null);
    setDecryptFile(null);
    setManifestFile(null);
    setEncryptPassphrase("");
    setEncryptConfirm("");
    setDecryptPassphrase("");
    setVaultLabel("");
    setWalletStatus({
      type: "warning",
      message: "App session reset. To fully disconnect this site, remove it from MetaMask connected sites."
    });
  }

  async function handleSwitchToSepolia() {
    if (!getblockSession.verified) {
      setWalletStatus({ type: "error", message: "Load getblock.config.js before switching MetaMask to the GetBlock-powered Sepolia session." });
      return;
    }

    if (!wallet.hasProvider) {
      setWalletStatus({ type: "error", message: "Install MetaMask before switching to Sepolia." });
      return;
    }

    if (!wallet.account) {
      setWalletStatus({ type: "error", message: "Connect MetaMask before switching to Sepolia." });
      return;
    }

    setSwitchBusy(true);
    setWalletStatus({ type: "", message: "Requesting Sepolia network in MetaMask using the imported GetBlock RPC." });

    try {
      const snapshot = await ensureSepoliaNetwork(getblockSession.rpcUrl);
      setWallet(snapshot);
      setWalletStatus({ type: "success", message: "MetaMask is now on Sepolia. The vault is ready, and each action will request its own payment transaction." });
    } catch (error) {
      setWalletStatus({ type: "error", message: error.message || "Unable to switch to Sepolia." });
    } finally {
      setSwitchBusy(false);
    }
  }

  async function runPaidVaultAction(actionLabel) {
    const gateMessage = walletGateMessage(wallet, getblockSession);

    if (gateMessage) {
      setPaymentStatus({ type: "error", message: gateMessage });
      throw new Error(gateMessage);
    }

    setPaymentBusy(true);
    setPaymentStatus({ type: "", message: `Calling VaultPayment contract for ${actionLabel}. You will pay the contract fee plus Sepolia gas.` });

    try {
      const txHash = await sendVaultPayment(wallet.account, actionLabel, getblockSession.rpcUrl);

      setPaymentStatus({ type: "", message: `${actionLabel} contract call submitted. Waiting for Sepolia confirmation...` });

      const receipt = await waitForTransactionReceipt(getblockSession.rpcUrl, txHash);

      if (receipt.status !== "0x1") {
        throw new Error(`The Sepolia ${actionLabel} transaction did not succeed.`);
      }

      const paymentContext = {
        method: "VaultPayment.payForAction",
        network: "Sepolia",
        txHash,
        blockNumber: receipt.blockNumber,
        contractAddress: receipt.to,
        feePaidByUser: true,
        confirmationType: "smart-contract",
        purpose: actionLabel,
        paidAt: new Date().toISOString()
      };

      setPaymentSession(paymentContext);
      setPaymentStatus({
        type: "success",
        message: `${actionLabel} payment confirmed on Sepolia: ${shortenHash(txHash)}.`
      });
      return paymentContext;
    } catch (error) {
      const message = error?.code === 4001
        ? "MetaMask transaction was rejected."
        : error.message || `Unable to confirm the Sepolia ${actionLabel} transaction.`;

      setPaymentSession(null);
      setPaymentStatus({ type: "error", message });
      throw error;
    } finally {
      setPaymentBusy(false);
    }
  }

  async function handleEncryptSubmit(event) {
    event.preventDefault();
    setEncryptResult(null);

    const gateMessage = walletGateMessage(wallet, getblockSession);
    if (gateMessage) {
      setEncryptStatus({ type: "error", message: gateMessage });
      return;
    }

    if (!encryptFile) {
      setEncryptStatus({ type: "error", message: "Choose a file or archive to encrypt." });
      return;
    }

    if (encryptPassphrase !== encryptConfirm) {
      setEncryptStatus({ type: "error", message: "The passphrases do not match yet." });
      return;
    }

    if (encryptPassphrase.length < 10) {
      setEncryptStatus({ type: "error", message: "Use a passphrase with at least 10 characters." });
      return;
    }

    setEncryptBusy(true);
    setEncryptStatus({ type: "", message: "Requesting Sepolia payment, then encrypting locally." });

    try {
      const paymentContext = await runPaidVaultAction("encrypt");
      const result = await encryptVaultFile({
        sourceFile: encryptFile,
        passphrase: encryptPassphrase,
        vaultLabel,
        walletContext: {
          provider: "MetaMask",
          rpcProvider: "GetBlock",
          rpcUrl: getblockSession.rpcUrl,
          address: wallet.account,
          chainId: wallet.chainId,
          network: "Sepolia"
        },
        paymentContext: {
          ...paymentContext,
          transactionHash: paymentContext.txHash,
          confirmedAt: paymentContext.paidAt
        }
      });

      let registryNote = "";
      try {
        setEncryptStatus({ type: "", message: "Anchoring receipt hash on-chain via VaultRegistry..." });
        const regResult = await registerReceiptOnChain(wallet.account, result.manifest);
        await waitForTransactionReceipt(getblockSession.rpcUrl, regResult.txHash);
        registryNote = ` Receipt hash anchored on-chain: ${shortenHash(regResult.receiptHash)}.`;
      } catch (regError) {
        registryNote = " Receipt anchoring skipped (registry transaction failed or was rejected).";
      }

      startTransition(() => {
        setEncryptResult({
          encryptedDownload: createDownloadState(result.encryptedBlob, result.encryptedFilename),
          manifestDownload: createDownloadState(result.manifestBlob, result.manifestFilename),
          encryptedSummary: `Encrypted ${encryptFile.name} into ${result.encryptedFilename} (${formatBytes(result.encryptedBlob.size)}).`,
          manifestSummary: `Receipt records AES-256-GCM settings, wallet ${shortenAddress(wallet.account)}, and Sepolia contract payment ${shortenHash(paymentContext.txHash)}.${registryNote}`
        });
        setEncryptStatus({
          type: "success",
          message: "Vault package ready. Download both files and keep the passphrase separate from the receipt."
        });
      });
    } catch (error) {
      setEncryptStatus({ type: "error", message: error.message || "Encryption failed." });
    } finally {
      setEncryptBusy(false);
    }
  }

  async function handleDecryptSubmit(event) {
    event.preventDefault();
    setDecryptResult(null);

    const gateMessage = walletGateMessage(wallet, getblockSession);
    if (gateMessage) {
      setDecryptStatus({ type: "error", message: gateMessage });
      return;
    }

    if (!decryptFile || !manifestFile) {
      setDecryptStatus({ type: "error", message: "Choose both the encrypted file and its receipt JSON." });
      return;
    }

    setDecryptBusy(true);
    setDecryptStatus({ type: "", message: "Requesting Sepolia payment, then decrypting locally." });

    try {
      const paymentContext = await runPaidVaultAction("decrypt");
      const result = await decryptVaultFile({
        encryptedFile: decryptFile,
        manifestFile,
        passphrase: decryptPassphrase
      });

      const receiptWallet = result.manifest.walletContext?.address;
      const receiptPayment = result.manifest.paymentContext?.transactionHash;
      const walletNote = receiptWallet && receiptWallet.toLowerCase() !== wallet.account.toLowerCase()
        ? ` Receipt was created by ${shortenAddress(receiptWallet)}, while the current MetaMask wallet is ${shortenAddress(wallet.account)}.`
        : receiptWallet
          ? ` Receipt matches the connected wallet ${shortenAddress(wallet.account)} on Sepolia.`
          : "";
      const paymentNote = receiptPayment
        ? ` Payment proof: ${shortenHash(receiptPayment)}.`
        : "";
      const decryptPaymentNote = paymentContext?.txHash
        ? ` Decrypt transaction: ${shortenHash(paymentContext.txHash)}.`
        : "";

      startTransition(() => {
        setDecryptResult({
          restoredDownload: createDownloadState(result.restoredBlob, result.restoredFilename),
          summary: `Restored ${result.manifest.originalFile.name} (${formatBytes(result.manifest.originalFile.size)}).${walletNote}${paymentNote}${decryptPaymentNote}`
        });
        setDecryptStatus({
          type: "success",
          message: "Vault opened successfully. Your original file is ready to download."
        });
      });
    } catch (error) {
      const message = error.name === "OperationError"
        ? "Decryption failed. Check that the receipt, encrypted file, and passphrase belong together."
        : error.message || "Decryption failed.";

      setDecryptStatus({ type: "error", message });
    } finally {
      setDecryptBusy(false);
    }
  }

  const sessionReady = !walletGateMessage(wallet, getblockSession);
  const walletConnectedOnSepolia = Boolean(wallet.account) && wallet.isSepolia;
  const explorerUrl = wallet.account
    ? `https://sepolia.etherscan.io/address/${wallet.account}`
    : "https://sepolia.etherscan.io";

  return (
    <>
      <div className="noise" />
      <main className="shell">
        <section className="hero panel">
          <p className="eyebrow">Web3 Technology</p>
          <h1>Welcome to Web3 Vault</h1>
          <p className="lede">
            This React dapp runs as a static GitHub Pages site, connects to MetaMask, switches to Sepolia, and encrypts files locally in the browser with downloadable vault receipts.
          </p>

          <div className="hero-grid">
            {securityCards.map((card) => (
              <div className="hero-card" key={card.label}>
                <span className="hero-label">{card.label}</span>
                <strong>{card.title}</strong>
                <p>{card.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="panel wallet-panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">Wallet session</p>
              <h2>MetaMask on Sepolia</h2>
            </div>
            <span className={`status-pill ${sessionReady ? "" : "alt"}`}>
              {sessionReady ? "Sepolia ready" : "Action needed"}
            </span>
          </div>

          <div className="wallet-grid">
            <div className="wallet-card">
              <span className="wallet-label">Provider</span>
              <strong>{wallet.hasProvider ? "MetaMask detected" : "MetaMask missing"}</strong>
              <p>{wallet.hasProvider ? "Wallet extension is available in this browser." : "Install MetaMask to unlock the Sepolia dapp flow."}</p>
            </div>
            <div className="wallet-card">
              <span className="wallet-label">Account</span>
              <strong>{wallet.account ? shortenAddress(wallet.account) : "Not connected"}</strong>
              <p>{wallet.account || "Connect MetaMask to attach a wallet context to each vault receipt."}</p>
            </div>
            <div className="wallet-card">
              <span className="wallet-label">Chain</span>
              <strong>{wallet.chainId ? wallet.chainId : "Unavailable"}</strong>
              <p>{wallet.isSepolia ? `Sepolia active (${SEPOLIA_CHAIN_ID})` : "Switch the wallet to Sepolia before using the vault."}</p>
            </div>
            <div className="wallet-card">
              <span className="wallet-label">Last payment</span>
              <strong>{paymentSession?.txHash ? "Confirmed" : "Pending action"}</strong>
              <p>{paymentSession?.txHash ? `${paymentSession.purpose}: ${shortenHash(paymentSession.txHash)}` : "Each encrypt and decrypt click calls the VaultPayment smart contract."}</p>
            </div>
          </div>

          <div className="wallet-actions">
            <button className="action" type="button" onClick={handleConnectWallet} disabled={connectBusy || walletConnectedOnSepolia}>
              {connectBusy ? "Connecting MetaMask..." : "Connect MetaMask"}
            </button>
            <button className="action alt" type="button" onClick={handleSwitchToSepolia} disabled={switchBusy || walletConnectedOnSepolia || !wallet.hasProvider || !wallet.account || !getblockSession.verified}>
              {switchBusy ? "Switching network..." : "Switch to Sepolia"}
            </button>
            <button className="action alt" type="button" onClick={handleResetSession} disabled={!wallet.account && !paymentSession && !encryptResult && !decryptResult}>
              Reset app session
            </button>
            <a className="download secondary slim" href={explorerUrl} target="_blank" rel="noreferrer">
              Open Sepolia explorer
            </a>
            <a className="download slim" href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank" rel="noreferrer">
              Get Sepolia ETH
            </a>
            <a className="download slim" href="https://support.metamask.io/more-web3/dapps/disconnect-wallet-from-a-dapp/" target="_blank" rel="noreferrer">
              Disconnect in MetaMask
            </a>
          </div>

          <div className={`feedback${walletStatus.type ? ` ${walletStatus.type}` : ""}`} aria-live="polite">
            {walletStatus.message}
          </div>
          <div className={`feedback${paymentStatus.type ? ` ${paymentStatus.type}` : ""}`} aria-live="polite">
            {paymentStatus.message}
          </div>
        </section>

        <section className="workspace">
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2>Encrypt a file or archive</h2>
              </div>
              <span className="status-pill">Local encryption</span>
            </div>

            <form className="vault-form" onSubmit={handleEncryptSubmit}>
              <label className="field">
                <span>Choose a file</span>
                <input type="file" required onChange={(event) => setEncryptFile(event.target.files?.[0] || null)} />
              </label>

              <div className="field-grid">
                <label className="field">
                  <span>Vault passphrase</span>
                  <input
                    type="password"
                    minLength="10"
                    placeholder="At least 10 characters"
                    required
                    value={encryptPassphrase}
                    onChange={(event) => setEncryptPassphrase(event.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Confirm passphrase</span>
                  <input
                    type="password"
                    minLength="10"
                    placeholder="Re-enter passphrase"
                    required
                    value={encryptConfirm}
                    onChange={(event) => setEncryptConfirm(event.target.value)}
                  />
                </label>
              </div>

              <label className="field">
                <span>Vault label</span>
                <input
                  type="text"
                  maxLength="40"
                  placeholder="Example: private-archive"
                  value={vaultLabel}
                  onChange={(event) => setVaultLabel(event.target.value)}
                />
              </label>

              <button className="action" type="submit" disabled={encryptBusy || paymentBusy}>
                {encryptBusy ? "Encrypting vault..." : paymentBusy ? "Waiting for payment..." : "Pay gas and encrypt"}
              </button>
            </form>

            <div className={`feedback${encryptStatus.type ? ` ${encryptStatus.type}` : ""}`} aria-live="polite">
              {encryptStatus.message}
            </div>

            {encryptResult ? (
              <div className="results">
                <div className="result-card">
                  <h3>Vault package ready</h3>
                  <p>{encryptResult.encryptedSummary}</p>
                  <DownloadLink className="download" item={encryptResult.encryptedDownload}>
                    Download encrypted file
                  </DownloadLink>
                </div>

                <div className="result-card">
                  <h3>Decryption receipt ready</h3>
                  <p>{encryptResult.manifestSummary}</p>
                  <DownloadLink className="download secondary" item={encryptResult.manifestDownload}>
                    Download receipt JSON
                  </DownloadLink>
                </div>
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Step 2</p>
                <h2>Decrypt a vault package</h2>
              </div>
              <span className="status-pill alt">Recovery flow</span>
            </div>

            <form className="vault-form" onSubmit={handleDecryptSubmit}>
              <label className="field">
                <span>Encrypted vault file</span>
                <input type="file" required onChange={(event) => setDecryptFile(event.target.files?.[0] || null)} />
              </label>

              <label className="field">
                <span>Receipt JSON</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  required
                  onChange={(event) => setManifestFile(event.target.files?.[0] || null)}
                />
              </label>

              <label className="field">
                <span>Vault passphrase</span>
                <input
                  type="password"
                  minLength="10"
                  placeholder="Enter the same passphrase"
                  required
                  value={decryptPassphrase}
                  onChange={(event) => setDecryptPassphrase(event.target.value)}
                />
              </label>

              <button className="action alt" type="submit" disabled={decryptBusy || paymentBusy}>
                {decryptBusy ? "Decrypting vault..." : paymentBusy ? "Waiting for payment..." : "Pay gas and decrypt"}
              </button>
            </form>

            <div className={`feedback${decryptStatus.type ? ` ${decryptStatus.type}` : ""}`} aria-live="polite">
              {decryptStatus.message}
            </div>

            {decryptResult ? (
              <div className="results">
                <div className="result-card">
                  <h3>Original file restored</h3>
                  <p>{decryptResult.summary}</p>
                  <DownloadLink className="download" item={decryptResult.restoredDownload}>
                    Download restored file
                  </DownloadLink>
                </div>
              </div>
            ) : null}
          </section>
        </section>
      </main>

      <footer className="site-footer">
        <p>
          Built with React, Vite, Solidity, and MetaMask on Ethereum Sepolia.
        </p>
        <a
          href="https://github.com/arijitkroy/Web3-Vault"
          target="_blank"
          rel="noreferrer"
        >
          View on GitHub
        </a>
      </footer>
    </>
  );
}
