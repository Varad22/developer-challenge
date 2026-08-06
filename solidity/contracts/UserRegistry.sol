// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

/// @title UserRegistry - on-chain rater accounts for Blockbuster
/// @notice Maps usernames to wallets and password hashes. Usernames must be
///         registered lowercase from the app. Admin may rebind a wallet after
///         local key loss (e.g. FireFly stack reset).
contract UserRegistry {
    address public immutable admin;

    struct Account {
        address wallet;
        bytes32 passwordHash;
        bytes32 salt;
    }

    uint256 public userCount;

    mapping(string => Account) private _accounts;
    mapping(address => string) private _walletUsernames;

    event UserRegistered(
        string indexed username,
        address indexed wallet
    );

    event WalletUpdated(
        string indexed username,
        address indexed wallet
    );

    constructor(address admin_) {
        require(admin_ != address(0), "UserRegistry: admin required");
        admin = admin_;
    }

    function register(
        string calldata username,
        bytes32 passwordHash,
        bytes32 salt
    ) external {
        require(_isValidUsername(username), "UserRegistry: invalid username");
        require(_accounts[username].wallet == address(0), "UserRegistry: username taken");
        require(
            bytes(_walletUsernames[msg.sender]).length == 0,
            "UserRegistry: wallet already registered"
        );

        _accounts[username] = Account({
            wallet: msg.sender,
            passwordHash: passwordHash,
            salt: salt
        });
        _walletUsernames[msg.sender] = username;
        userCount += 1;

        emit UserRegistered(username, msg.sender);
    }

    function adminUpdateWallet(
        string calldata username,
        address newWallet
    ) external {
        require(msg.sender == admin, "UserRegistry: only admin");
        require(newWallet != address(0), "UserRegistry: wallet required");

        Account storage account = _accounts[username];
        require(account.wallet != address(0), "UserRegistry: not found");

        delete _walletUsernames[account.wallet];
        account.wallet = newWallet;
        _walletUsernames[newWallet] = username;

        emit WalletUpdated(username, newWallet);
    }

    function getAccount(
        string calldata username
    )
        external
        view
        returns (
            address wallet,
            bytes32 passwordHash,
            bytes32 salt
        )
    {
        Account storage account = _accounts[username];
        require(account.wallet != address(0), "UserRegistry: not found");
        return (account.wallet, account.passwordHash, account.salt);
    }

    function _isValidUsername(
        string calldata username
    ) private pure returns (bool) {
        bytes memory name = bytes(username);
        if (name.length < 3 || name.length > 32) {
            return false;
        }

        for (uint256 i = 0; i < name.length; i++) {
            bytes1 char = name[i];
            bool isLower = char >= 0x61 && char <= 0x7A;
            bool isDigit = char >= 0x30 && char <= 0x39;
            bool isUnderscore = char == 0x5F;
            if (!isLower && !isDigit && !isUnderscore) {
                return false;
            }
        }

        return true;
    }
}
