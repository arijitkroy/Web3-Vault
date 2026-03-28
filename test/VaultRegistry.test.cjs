const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("VaultRegistry", function () {
  let vaultRegistry;
  let user;
  let other;

  beforeEach(async function () {
    [, user, other] = await ethers.getSigners();
    const VaultRegistry = await ethers.getContractFactory("VaultRegistry");
    vaultRegistry = await VaultRegistry.deploy();
    await vaultRegistry.waitForDeployment();
  });

  it("should register a receipt and emit ReceiptRegistered", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test-receipt-1"));

    await expect(vaultRegistry.connect(user).registerReceipt(hash))
      .to.emit(vaultRegistry, "ReceiptRegistered")
      .withArgs(user.address, hash, anyValue);
  });

  it("should verify a registered receipt", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test-receipt-2"));
    await vaultRegistry.connect(user).registerReceipt(hash);

    expect(await vaultRegistry.verifyReceipt(user.address, hash)).to.be.true;
  });

  it("should return false for an unregistered receipt", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("unknown-receipt"));
    expect(await vaultRegistry.verifyReceipt(user.address, hash)).to.be.false;
  });

  it("should reject duplicate receipt registration", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("test-receipt-dup"));
    await vaultRegistry.connect(user).registerReceipt(hash);

    await expect(
      vaultRegistry.connect(user).registerReceipt(hash)
    ).to.be.revertedWithCustomError(vaultRegistry, "AlreadyRegistered");
  });

  it("should reject empty hash", async function () {
    await expect(
      vaultRegistry.connect(user).registerReceipt(ethers.ZeroHash)
    ).to.be.revertedWithCustomError(vaultRegistry, "EmptyHash");
  });

  it("should track receipt count per user", async function () {
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes("receipt-a"));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("receipt-b"));

    await vaultRegistry.connect(user).registerReceipt(hash1);
    await vaultRegistry.connect(user).registerReceipt(hash2);

    expect(await vaultRegistry.getReceiptCount(user.address)).to.equal(2);
    expect(await vaultRegistry.getReceiptCount(other.address)).to.equal(0);
  });

  it("should return receipt entry by index", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("receipt-index"));
    await vaultRegistry.connect(user).registerReceipt(hash);

    const storedHash = await vaultRegistry.getReceipt(
      user.address,
      0
    );
    expect(storedHash).to.equal(hash);
  });

  it("should revert for out-of-bounds index", async function () {
    await expect(
      vaultRegistry.getReceipt(user.address, 0)
    ).to.be.revertedWithCustomError(vaultRegistry, "IndexOutOfBounds");
  });

  it("should isolate receipts between users", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("isolated-receipt"));
    await vaultRegistry.connect(user).registerReceipt(hash);

    expect(await vaultRegistry.verifyReceipt(user.address, hash)).to.be.true;
    expect(await vaultRegistry.verifyReceipt(other.address, hash)).to.be.false;
  });
});


