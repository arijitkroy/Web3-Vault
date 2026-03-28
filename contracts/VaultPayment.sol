// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VaultPayment
/// @notice Collects a configurable fee for each Web3 Vault action (encrypt / decrypt).
contract VaultPayment {
    address public owner;
    uint256 public fee;

    error InsufficientFee();
    error NotOwner();
    error NothingToWithdraw();
    error WithdrawalFailed();
    error ZeroAddress();

    event ActionPaid(
        address indexed user,
        string actionType,
        uint256 amount,
        uint256 timestamp
    );

    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event Withdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @param initialFee The fee in wei charged per vault action.
    constructor(uint256 initialFee) {
        owner = msg.sender;
        fee = initialFee;
    }

    /// @notice Pay the required fee for an encrypt or decrypt action.
    /// @param actionType A label such as "encrypt" or "decrypt".
    function payForAction(string calldata actionType) external payable {
        if (msg.value < fee) revert InsufficientFee();

        emit ActionPaid(msg.sender, actionType, msg.value, block.timestamp);
    }

    /// @notice Update the fee. Only callable by the owner.
    function setFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = fee;
        fee = newFee;
        emit FeeUpdated(oldFee, newFee);
    }

    /// @notice Withdraw all collected fees to the owner address.
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToWithdraw();

        (bool success, ) = payable(owner).call{value: balance}("");
        if (!success) revert WithdrawalFailed();

        emit Withdrawn(owner, balance);
    }

    /// @notice Transfer ownership to a new address.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }
}
