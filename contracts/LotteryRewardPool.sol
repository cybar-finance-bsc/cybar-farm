pragma solidity 0.6.12;

import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/IBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/SafeBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/access/Ownable.sol";

import "./MasterBarkeeper.sol";

contract LotteryRewardPool is Ownable {
    using SafeBEP20 for IBEP20;

    MasterBarkeeper public barkeeper;
    address public adminAddress;
    address public receiver;
    IBEP20 public lptoken;
    IBEP20 public cybar;

    constructor(
        MasterBarkeeper _barkeeper,
        IBEP20 _cybar,
        address _admin,
        address _receiver
    ) public {
        barkeeper = _barkeeper;
        cybar = _cybar;
        adminAddress = _admin;
        receiver = _receiver;
    }

    event StartFarming(address indexed user, uint256 indexed pid);
    event Harvest(address indexed user, uint256 indexed pid);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == adminAddress, "admin: wut?");
        _;
    }

    function startFarming(
        uint256 _pid,
        IBEP20 _lptoken,
        uint256 _amount
    ) external onlyAdmin {
        _lptoken.safeApprove(address(barkeeper), _amount);
        barkeeper.deposit(_pid, _amount);
        emit StartFarming(msg.sender, _pid);
    }

    function harvest(uint256 _pid) external onlyAdmin {
        barkeeper.deposit(_pid, 0);
        uint256 balance = cybar.balanceOf(address(this));
        cybar.safeTransfer(receiver, balance);
        emit Harvest(msg.sender, _pid);
    }

    function setReceiver(address _receiver) external onlyAdmin {
        receiver = _receiver;
    }

    function pendingReward(uint256 _pid) external view returns (uint256) {
        return barkeeper.pendingCybar(_pid, address(this));
    }

    // EMERGENCY ONLY.
    function emergencyWithdraw(IBEP20 _token, uint256 _amount)
        external
        onlyOwner
    {
        cybar.safeTransfer(address(msg.sender), _amount);
        emit EmergencyWithdraw(msg.sender, _amount);
    }

    function setAdmin(address _admin) external onlyOwner {
        adminAddress = _admin;
    }
}
