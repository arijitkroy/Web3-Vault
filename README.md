# Web3 Vault

Web3 Vault is a React and Vite-based browser dapp that:

- connects to MetaMask
- validates a GetBlock Sepolia RPC
- switches the wallet to Ethereum Sepolia
- requires a confirmed Sepolia transaction on every encrypt click
- requires a confirmed Sepolia transaction on every decrypt click
- encrypts files locally in the browser with `AES-256-GCM`
- returns an encrypted vault file plus a receipt JSON
- deploys as a static site on GitHub Pages

## Who this guide is for

This README is written for two kinds of users:

1. Developers who want to run or deploy the app.
2. New web3 users who may not have used MetaMask, Sepolia, or a testnet faucet before.

## What the wallet does in this app

The wallet is not only for display.

For every encrypt action and every decrypt action:

1. the app asks MetaMask to submit a Sepolia transaction
2. the user approves it
3. the user pays Sepolia gas
4. the app waits for the transaction receipt
5. only then does the encrypt or decrypt action continue

Current implementation detail:

- the payment transaction is a self-transaction
- the transaction value is `0`
- the user still pays real Sepolia gas
- the receipt JSON stores the transaction proof for the encrypt action

This is a real wallet-and-gas flow, but it is not yet a smart-contract billing system.

## Security warning

This app is a static GitHub Pages frontend.

That means anything bundled into the frontend is public, including the token inside [getblock.config.js](/d:/CollabGithub/Web3-Vault/getblock.config.js).

Only use a GetBlock token you are comfortable exposing client-side. If you need private credentials, move RPC access behind a backend or serverless proxy.

## Project structure

Core files:

- [index.html](/d:/CollabGithub/Web3-Vault/index.html): Vite HTML entry
- [main.jsx](/d:/CollabGithub/Web3-Vault/main.jsx): React bootstrap
- [App.jsx](/d:/CollabGithub/Web3-Vault/App.jsx): UI, MetaMask flow, payment flow, encrypt/decrypt flow
- [styles.css](/d:/CollabGithub/Web3-Vault/styles.css): styling
- [vault.js](/d:/CollabGithub/Web3-Vault/vault.js): browser encryption and decryption helpers
- [wallet.js](/d:/CollabGithub/Web3-Vault/wallet.js): MetaMask, Sepolia, and transaction helpers
- [getblock.config.js](/d:/CollabGithub/Web3-Vault/getblock.config.js): GetBlock token/config module
- [getblock.js](/d:/CollabGithub/Web3-Vault/getblock.js): GetBlock RPC resolution and receipt polling
- [vite.config.js](/d:/CollabGithub/Web3-Vault/vite.config.js): Vite config with GitHub Pages base handling
- [.github/workflows/deploy.yml](/d:/CollabGithub/Web3-Vault/.github/workflows/deploy.yml): GitHub Pages deployment workflow

## How the dapp works

### Wallet and RPC flow

1. The app loads [getblock.config.js](/d:/CollabGithub/Web3-Vault/getblock.config.js).
2. It reads `getblock.shared.eth.sepolia.jsonRpc[0].go()`.
3. It calls `eth_chainId` against that GetBlock RPC to verify the endpoint is Sepolia.
4. The user connects MetaMask.
5. The user switches MetaMask to Sepolia.
6. If needed, the app asks MetaMask to add Sepolia with the GetBlock RPC URL.

### Payment flow

For every `Pay gas and encrypt` click and every `Pay gas and decrypt` click:

1. the app requests `eth_sendTransaction`
2. MetaMask opens a real transaction prompt
3. the user approves it
4. the user pays Sepolia gas
5. the app polls the GetBlock RPC with `eth_getTransactionReceipt`
6. the requested action runs only after the receipt is confirmed

### Encryption flow

1. The user selects a file or archive.
2. The user enters and confirms a passphrase.
3. The browser generates a random salt and IV.
4. The passphrase becomes a key using `PBKDF2 / SHA-256`.
5. The file is encrypted with `AES-256-GCM`.
6. The app generates:
   - an encrypted `.vault` file
   - a receipt `.json` file

The receipt contains:

- vault version
- creation timestamp
- original file metadata
- encryption algorithm and IV
- PBKDF2 salt and iteration count
- MetaMask wallet context
- GetBlock RPC context
- Sepolia transaction context for the encrypt action

### Decryption flow

1. The user uploads the encrypted `.vault` file.
2. The user uploads the receipt JSON.
3. The user enters the original passphrase.
4. The browser reconstructs the key from the receipt metadata.
5. The app requires a new Sepolia transaction for the decrypt action.
6. After confirmation, the file is decrypted locally in the browser.
7. The original file is restored as a download.

## Full setup for brand new web3 users

### Step 1: Install MetaMask

Use the official MetaMask website:

- https://metamask.io/

Recommended path for browser users:

1. Open the official MetaMask site.
2. Click the install or get started option.
3. Install the browser extension for your browser.
4. Pin MetaMask in your browser toolbar so you can find it easily.

Important safety rule:

- Only install MetaMask from the official MetaMask website or the official browser extension store page it sends you to.

### Step 2: Create a new MetaMask wallet

When MetaMask opens for first-time setup:

1. Choose `Create a new wallet`.
2. Pick whether you want a traditional Secret Recovery Phrase setup or a Google/Apple-backed setup if MetaMask offers it.
3. Create a strong local password for opening MetaMask on your device.

### Step 3: Back up your Secret Recovery Phrase safely

If you use the traditional self-custody setup:

1. MetaMask will generate a 12-word Secret Recovery Phrase.
2. Write it down on paper.
3. Store it offline in a safe place.
4. Never paste it into chats, email, cloud notes, or screenshots.
5. Never share it with anyone.

If you lose the phrase and lose wallet access, MetaMask generally cannot recover it for you.

### Step 4: Understand password vs recovery phrase

- Your MetaMask password unlocks the wallet on your current device.
- Your Secret Recovery Phrase restores the wallet itself.
- If someone gets your Secret Recovery Phrase, they can control your wallet.

### Step 5: Open MetaMask and find your address

After setup:

1. Open MetaMask.
2. Look at the selected account.
3. Copy your wallet address. It will look like `0x...`.

You will use that address when funding the wallet with testnet ETH.

## Get Sepolia ETH from the Google Cloud faucet

Official faucet page:

- https://cloud.google.com/application/web3/faucet/ethereum/sepolia

Google Cloud also has a general Web3 faucet page:

- https://cloud.google.com/application/web3/faucet

Typical faucet flow:

1. Open the Ethereum Sepolia faucet page.
2. Sign in with a Google account if prompted.
3. Paste your MetaMask wallet address.
4. Request Sepolia ETH.
5. Wait for the testnet funds to arrive in MetaMask.

Note:

- The exact faucet UI may change over time.
- If the button labels differ, use the Ethereum Sepolia faucet page and submit your MetaMask address there.
- This step is based on the current Google Cloud Web3 faucet pages and page structure.

### How to check that Sepolia ETH arrived

In MetaMask:

1. Switch to the Sepolia network if it is already available.
2. Look at your balance.
3. If funds do not appear immediately, wait a bit and refresh MetaMask.

You can also paste your address into Sepolia Etherscan:

- https://sepolia.etherscan.io/

## Configure GetBlock

This project uses the GetBlock config pattern you provided.

Edit [getblock.config.js](/d:/CollabGithub/Web3-Vault/getblock.config.js) and set your token if needed.

Example structure:

```js
class Token {
  constructor(material) {
    this.material = material;
  }

  go() {
    return `https://go.getblock.io/${this.material}/`;
  }

  token() {
    return this.material;
  }
}

export const getblock = {
  shared: {
    eth: {
      sepolia: {
        jsonRpc: [
          new Token("YOUR_GETBLOCK_TOKEN")
        ]
      }
    }
  }
};
```

The app expects:

- `getblock.shared.eth.sepolia.jsonRpc[0].go()`

Expected Sepolia chain ID:

- hex: `0xaa36a7`
- decimal: `11155111`

## Set up MetaMask for this app

### Switch MetaMask to Sepolia

The app can request the network switch for you.

Inside the app:

1. Connect MetaMask.
2. Click `Switch to Sepolia`.
3. Approve the request in MetaMask.

If Sepolia is not already configured, MetaMask may ask to add it first. Approve that too.

### Why Sepolia is required

This app is wired to:

- Ethereum Sepolia
- GetBlock Sepolia RPC
- Sepolia payment confirmations for encrypt and decrypt actions

If the wallet is on another network, the app will not proceed.

## Running the app locally

### Requirements

- Node.js 18+ recommended
- npm
- MetaMask browser extension
- Sepolia ETH in your MetaMask wallet

### Install dependencies

```powershell
npm install
```

### Start the dev server

```powershell
npm run dev
```

Open the local Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

## Full local test flow

1. Install MetaMask if you do not already have it.
2. Create a wallet.
3. Back up the Secret Recovery Phrase securely.
4. Fund the wallet with Sepolia ETH from the Google Cloud faucet.
5. Set your GetBlock token in [getblock.config.js](/d:/CollabGithub/Web3-Vault/getblock.config.js).
6. Run `npm install`.
7. Run `npm run dev`.
8. Open the app in your browser.
9. Wait for the GetBlock RPC verification to succeed.
10. Click `Connect MetaMask`.
11. Click `Switch to Sepolia`.
12. Select a file.
13. Enter and confirm a passphrase.
14. Click `Pay gas and encrypt`.
15. Approve the MetaMask transaction.
16. Wait for confirmation.
17. Download the `.vault` file and receipt JSON.
18. Re-upload both files.
19. Click `Pay gas and decrypt`.
20. Approve the second MetaMask transaction.
21. Wait for confirmation.
22. Download the restored file.

## User guide

### Encrypt a file

1. Open the app.
2. Wait for GetBlock RPC verification.
3. Connect MetaMask.
4. Switch to Sepolia.
5. Choose a file or archive.
6. Enter a passphrase.
7. Confirm the passphrase.
8. Optionally enter a vault label.
9. Click `Pay gas and encrypt`.
10. Approve the Sepolia transaction in MetaMask.
11. Wait for the transaction confirmation message.
12. Download:
   - the encrypted `.vault` file
   - the receipt `.json` file

### Decrypt a file

1. Open the app.
2. Wait for GetBlock RPC verification.
3. Connect MetaMask.
4. Switch to Sepolia.
5. Upload the encrypted `.vault` file.
6. Upload the receipt `.json` file.
7. Enter the original passphrase.
8. Click `Pay gas and decrypt`.
9. Approve the Sepolia transaction in MetaMask.
10. Wait for the transaction confirmation message.
11. Download the restored file.

## Disconnecting the site

There are two different actions:

- `Reset app session` clears the vault UI state inside this app.
- `Disconnect in MetaMask` is the real wallet-site disconnect path.

Why this matters:

- Refreshing the page will restore the wallet if the site is still connected in MetaMask.
- Browser dapps generally cannot force MetaMask to revoke site permissions on behalf of the user.
- To fully disconnect, use the `Disconnect in MetaMask` link or remove the site from MetaMask connected sites manually.

## Production build

```powershell
npm run build
```

The build output goes to:

```text
dist/
```

Preview locally with:

```powershell
npm run preview
```

## Deploy to GitHub Pages

This repo is already set up for GitHub Pages with GitHub Actions.

[vite.config.js](/d:/CollabGithub/Web3-Vault/vite.config.js) sets the correct Vite `base` path during Actions builds based on the repository name.

[.github/workflows/deploy.yml](/d:/CollabGithub/Web3-Vault/.github/workflows/deploy.yml) handles:

1. checkout
2. Node.js setup
3. dependency install
4. Vite build
5. Pages artifact upload
6. Pages deployment

### Enable Pages in GitHub

1. Push the repository to GitHub.
2. Open `Settings`.
3. Open `Pages`.
4. Under `Build and deployment`, choose `GitHub Actions`.
5. Save.

### Deploy

```powershell
git add .
git commit -m "Deploy Web3 Vault"
git push origin main
```

GitHub Actions will build and publish the site automatically.

## Troubleshooting

### MetaMask not detected

- Make sure MetaMask is installed and enabled.
- Refresh the page after enabling the extension.
- Use a supported browser like Chrome, Edge, Firefox, Brave, or Opera.

### I am new and don’t know where my wallet address is

- Open MetaMask.
- Select your account.
- Use the copy-address button.
- It should start with `0x`.

### I do not see Sepolia ETH after using the Google Cloud faucet

- Wait a few minutes.
- Make sure you used the correct wallet address.
- Make sure you are viewing the Sepolia network in MetaMask.
- Check the address on Sepolia Etherscan.
- Retry on the faucet page if needed.

### GetBlock config error

- Check [getblock.config.js](/d:/CollabGithub/Web3-Vault/getblock.config.js).
- Confirm `getblock.shared.eth.sepolia.jsonRpc[0]` exists.
- Confirm `.go()` returns a valid RPC URL.

### Sepolia switch fails

- Unlock MetaMask first.
- Make sure GetBlock RPC verification succeeded.
- Retry and approve the MetaMask prompt.

### `Pay gas and encrypt` or `Pay gas and decrypt` does not finish

- Make sure the wallet is on Sepolia.
- Make sure the wallet has Sepolia ETH for gas.
- Approve the MetaMask transaction.
- Wait for the receipt to be mined.
- If the transaction stalls, retry later.

### Encryption fails

- Check that the passphrase and confirmation match.
- Check that the file is still selected.
- Make sure the payment transaction succeeded.

### Decryption fails

- Make sure the `.vault` file and receipt belong together.
- Make sure the original passphrase is correct.
- Make sure the decrypt payment transaction succeeded.

## Current limitations

- This is a client-side encryption app, not a backend storage service.
- The GetBlock token is public because the site is static.
- The payment step is a self-transaction used as an on-chain confirmation gate for each encrypt and decrypt action.
- There is not yet a smart-contract fee recipient or on-chain receipt registry.

## Future improvements

- Replace the self-transaction with a real vault payment contract
- Add smart contract receipt anchoring on Sepolia
- Store receipt hashes on-chain
- Move RPC/token usage behind a backend or proxy
- Add drag-and-drop uploads
- Add stronger file integrity reporting

## References

- MetaMask install: https://support.metamask.io/start/getting-started-with-metamask/
- MetaMask create wallet: https://support.metamask.io/tl/start/creating-a-new-wallet/
- MetaMask Secret Recovery Phrase safety: https://support.metamask.io/start/what-is-a-secret-recovery-phrase-and-how-to-keep-your-crypto-wallet-secure/
- MetaMask restore wallet: https://support.metamask.io/configure/wallet/how-to-restore-your-metamask-wallet-from-secret-recovery-phrase/
- Google Cloud Web3 faucet: https://cloud.google.com/application/web3/faucet
- Google Cloud Ethereum Sepolia faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia
- Google Cloud Blockchain RPC docs: https://cloud.google.com/blockchain-rpc/docs
- GetBlock configuration files: https://docs.getblock.io/getting-started/endpoint-setup/using-getblock-configuration-files
- GetBlock with MetaMask: https://docs.getblock.io/getting-started/connect-to-getblock-with-metamask
- Vite static deployment: https://vite.dev/guide/static-deploy.html
- GitHub Pages custom workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- GitHub Pages dapp article: https://bretahajek.com/2022/01/hosting-decentralized-application-for-free-with-github-pages/
