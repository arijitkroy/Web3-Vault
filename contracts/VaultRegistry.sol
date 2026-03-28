// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title VaultRegistry
/// @notice Anchors vault receipt hashes on-chain for immutable proof of encryption events.
contract VaultRegistry {
    mapping(address => bytes32[]) private _hashes;
    mapping(address => mapping(bytes32 => bool)) private _exists;

    error EmptyHash();
    error AlreadyRegistered();
    error IndexOutOfBounds();

    event ReceiptRegistered(
        address indexed user,
        bytes32 indexed receiptHash,
        uint256 timestamp
    );

    /// @notice Register a hash of a vault receipt.
    /// @param receiptHash The hash of the receipt content.
    function registerReceipt(bytes32 receiptHash) external {
        if (receiptHash == bytes32(0)) revert EmptyHash();
        if (_exists[msg.sender][receiptHash]) revert AlreadyRegistered();

        _exists[msg.sender][receiptHash] = true;
        _hashes[msg.sender].push(receiptHash);

        emit ReceiptRegistered(msg.sender, receiptHash, block.timestamp);
    }

    /// @notice Check whether a receipt hash has been registered by a specific user.
    function verifyReceipt(
        address user,
        bytes32 receiptHash
    ) external view returns (bool) {
        return _exists[user][receiptHash];
    }

    /// @notice Return the number of receipts registered by a user.
    function getReceiptCount(address user) external view returns (uint256) {
        return _hashes[user].length;
    }

    /// @notice Return a specific receipt hash by index.
    function getReceipt(
        address user,
        uint256 index
    ) external view returns (bytes32) {
        if (index >= _hashes[user].length) revert IndexOutOfBounds();
        return _hashes[user][index];
    }
}
