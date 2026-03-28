const hre = require("hardhat");

async function main() {
  const initialFee = hre.ethers.parseEther("0.0001");

  console.log("Deploying VaultPayment...");
  const VaultPayment = await hre.ethers.getContractFactory("VaultPayment");
  const vaultPayment = await VaultPayment.deploy(initialFee);
  await vaultPayment.waitForDeployment();
  const paymentAddress = await vaultPayment.getAddress();
  console.log(`VaultPayment deployed to: ${paymentAddress}`);

  console.log("Deploying VaultRegistry...");
  const VaultRegistry = await hre.ethers.getContractFactory("VaultRegistry");
  const vaultRegistry = await VaultRegistry.deploy();
  await vaultRegistry.waitForDeployment();
  const registryAddress = await vaultRegistry.getAddress();
  console.log(`VaultRegistry deployed to: ${registryAddress}`);

  console.log("\n--- Update contracts.js with these addresses ---");
  console.log(`VAULT_PAYMENT_ADDRESS: "${paymentAddress}"`);
  console.log(`VAULT_REGISTRY_ADDRESS: "${registryAddress}"`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
