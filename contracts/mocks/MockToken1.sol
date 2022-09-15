// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract MockToken1 is ERC20, AccessControl {
    modifier onlyOwner() {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender));
        _;
    }

    constructor() ERC20("TestBTC", "TBTC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Mints desired amount of tokens for the recipient
     * @param _receiver Receiver of the tokens.
     * @param _amount Amount (in wei - smallest decimals)
     */
    function mintFor(address _receiver, uint256 _amount) external onlyOwner {
        require(_receiver != address(0), "Zero address");
        require(_receiver != address(this), "Incorrect address");
        require(_amount > 0, "Incorrect amount");
        _mint(_receiver, _amount);
    }

    function mint(uint256 _amount) external onlyOwner {
        require(_amount > 0, "Incorrect amount");
        _mint(_msgSender(), _amount);
    }
}
