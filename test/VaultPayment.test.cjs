const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("VaultPayment", function () {
  let vaultPayment;
  let owner;
  let user;
  const initialFee = ethers.parseEther("0.0001");

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    const VaultPayment = await ethers.getContractFactory("VaultPayment");
    vaultPayment = await VaultPayment.deploy(initialFee);
    await vaultPayment.waitForDeployment();
  });

  it("should set the correct owner and fee", async function () {
    expect(await vaultPayment.owner()).to.equal(owner.address);
    expect(await vaultPayment.fee()).to.equal(initialFee);
  });

  it("should accept payment and emit ActionPaid", async function () {
    await expect(
      vaultPayment.connect(user).payForAction("encrypt", { value: initialFee })
    )
      .to.emit(vaultPayment, "ActionPaid")
      .withArgs(user.address, "encrypt", initialFee, anyValue);
  });

  it("should reject payment below the required fee", async function () {
    const lowFee = ethers.parseEther("0.00001");
    await expect(
      vaultPayment.connect(user).payForAction("encrypt", { value: lowFee })
    ).to.be.revertedWithCustomError(vaultPayment, "InsufficientFee");
  });

  it("should accept overpayment", async function () {
    const overFee = ethers.parseEther("0.001");
    await expect(
      vaultPayment.connect(user).payForAction("decrypt", { value: overFee })
    ).to.emit(vaultPayment, "ActionPaid");
  });

  it("should allow the owner to update the fee", async function () {
    const newFee = ethers.parseEther("0.0005");
    await expect(vaultPayment.connect(owner).setFee(newFee))
      .to.emit(vaultPayment, "FeeUpdated")
      .withArgs(initialFee, newFee);

    expect(await vaultPayment.fee()).to.equal(newFee);
  });

  it("should reject fee update from non-owner", async function () {
    const newFee = ethers.parseEther("0.0005");
    await expect(
      vaultPayment.connect(user).setFee(newFee)
    ).to.be.revertedWithCustomError(vaultPayment, "NotOwner");
  });

  it("should allow the owner to withdraw collected fees", async function () {
    await vaultPayment.connect(user).payForAction("encrypt", { value: initialFee });

    const contractBalance = await ethers.provider.getBalance(
      await vaultPayment.getAddress()
    );
    expect(contractBalance).to.equal(initialFee);

    await expect(vaultPayment.connect(owner).withdraw())
      .to.emit(vaultPayment, "Withdrawn")
      .withArgs(owner.address, initialFee);
  });

  it("should reject withdrawal from non-owner", async function () {
    await vaultPayment.connect(user).payForAction("encrypt", { value: initialFee });

    await expect(
      vaultPayment.connect(user).withdraw()
    ).to.be.revertedWithCustomError(vaultPayment, "NotOwner");
  });

  it("should reject withdrawal when balance is zero", async function () {
    await expect(
      vaultPayment.connect(owner).withdraw()
    ).to.be.revertedWithCustomError(vaultPayment, "NothingToWithdraw");
  });

  it("should allow ownership transfer", async function () {
    await vaultPayment.connect(owner).transferOwnership(user.address);
    expect(await vaultPayment.owner()).to.equal(user.address);
  });
});


