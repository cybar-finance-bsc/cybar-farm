pragma solidity 0.6.12;

import "@pancakeswap/pancake-swap-lib/contracts/math/SafeMath.sol";
import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/IBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/SafeBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/access/Ownable.sol";

// import "@nomiclabs/buidler/console.sol";

interface IWBNB {
    function deposit() external payable;

    function transfer(address to, uint256 value) external returns (bool);

    function withdraw(uint256) external;
}

contract BnbStaking is Ownable {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    struct UserInfo {
        uint256 amount;
        uint256 rewardDebt;
        bool inBlackList;
    }

    struct PoolInfo {
        IBEP20 lpToken;
        uint256 allocPoint;
        uint256 lastRewardBlock;
        uint256 accCybarPerShare;
    }

    IBEP20 public rewardToken;
    address public adminAddress;
    address public immutable WBNB;
    uint256 public rewardPerBlock;

    PoolInfo[] public poolInfo;
    mapping(address => UserInfo) public userInfo;
    uint256 public limitAmount = 10000000000000000000;
    uint256 public totalAllocPoint = 0;
    uint256 public startBlock;
    uint256 public bonusEndBlock;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);

    /*
     * @notice Constructor
     * @dev The first Pool is the staking pool
     * @param _lp: LP token
     * @param _rewardToken: Reward token
     * @param _startBlock:
     * @param _bonusEndBlock:
     * @param _adminAddress:
     * @param _wbnb:
     */
    constructor(
        IBEP20 _lp,
        IBEP20 _rewardToken,
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _bonusEndBlock,
        address _adminAddress,
        address _wbnb
    ) public {
        rewardToken = _rewardToken;
        rewardPerBlock = _rewardPerBlock;
        startBlock = _startBlock;
        bonusEndBlock = _bonusEndBlock;
        adminAddress = _adminAddress;
        WBNB = _wbnb;

        poolInfo.push(
            PoolInfo({
                lpToken: _lp,
                allocPoint: 1000,
                lastRewardBlock: startBlock,
                accCybarPerShare: 0
            })
        );

        totalAllocPoint = 1000;
    }

    modifier onlyAdmin() {
        require(msg.sender == adminAddress, "admin: wut?");
        _;
    }

    receive() external payable {
        assert(msg.sender == WBNB); // only accept BNB via fallback from the WBNB contract
    }

    /*
     * @notice Sets a new admin address
     * @param _adminAddress: New admin address
     */
    function setAdmin(address _adminAddress) public onlyOwner {
        adminAddress = _adminAddress;
    }

    /*
     * @notice Add user to the blacklist
     * @param _blackListAddress: Address of the user to be added to the blacklist
     */
    function setBlackList(address _blacklistAddress) public onlyAdmin {
        userInfo[_blacklistAddress].inBlackList = true;
    }

    /*
     * @notice Remove user from blacklist
     * @param _blacklistAddress: Address of the user to be removed from the blacklist
     */
    function removeBlackList(address _blacklistAddress) public onlyAdmin {
        userInfo[_blacklistAddress].inBlackList = false;
    }

    /*
     * @notice Set limit amount
     * @dev Can only be called by the owner
     * @param _amount: New limit amount
     */
    function setLimitAmount(uint256 _amount) public onlyOwner {
        limitAmount = _amount;
    }

    /*
     * @notice Get the multiplier between two blocks 
     * @param _from: Start block
     * @param _to: End block
     */
    function getMultiplier(uint256 _from, uint256 _to)
        public
        view
        returns (uint256)
    {
        if (_to <= bonusEndBlock) {
            return _to.sub(_from);
        } else if (_from >= bonusEndBlock) {
            return 0;
        } else {
            return bonusEndBlock.sub(_from);
        }
    }

    /*
     * @notice View function to see pending rewards of a user in the frontend
     * @param _user: Address of the user
     */
    function pendingReward(address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[_user];
        uint256 accCybarPerShare = pool.accCybarPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier =
                getMultiplier(pool.lastRewardBlock, block.number);
            uint256 cybarReward =
                multiplier.mul(rewardPerBlock).mul(pool.allocPoint).div(
                    totalAllocPoint
                );
            accCybarPerShare = accCybarPerShare.add(
                cybarReward.mul(1e12).div(lpSupply)
            );
        }
        return user.amount.mul(accCybarPerShare).div(1e12).sub(user.rewardDebt);
    }

    /*
     * @notice Update reward variables of the given pool to be up-to-date
     * @param _pid: Pool Id of the pool to be updated
     */
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 cybarReward =
            multiplier.mul(rewardPerBlock).mul(pool.allocPoint).div(
                totalAllocPoint
            );
        pool.accCybarPerShare = pool.accCybarPerShare.add(
            cybarReward.mul(1e12).div(lpSupply)
        );
        pool.lastRewardBlock = block.number;
    }

    /*
     * @notice Update all pools
     * @dev Be careful of gas spending
     */
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    /*
     * @notice Stake tokens to SmartBarkeeper
     */
    function deposit() public payable {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[msg.sender];

        require(user.amount.add(msg.value) <= limitAmount, "exceed the top");
        require(!user.inBlackList, "in black list");

        updatePool(0);
        if (user.amount > 0) {
            uint256 pending =
                user.amount.mul(pool.accCybarPerShare).div(1e12).sub(
                    user.rewardDebt
                );
            if (pending > 0) {
                rewardToken.safeTransfer(address(msg.sender), pending);
            }
        }
        if (msg.value > 0) {
            IWBNB(WBNB).deposit{value: msg.value}();
            assert(IWBNB(WBNB).transfer(address(this), msg.value));
            user.amount = user.amount.add(msg.value);
        }
        user.rewardDebt = user.amount.mul(pool.accCybarPerShare).div(1e12);

        emit Deposit(msg.sender, msg.value);
    }

    // What is the purpose of this function?
    function safeTransferBNB(address to, uint256 value) internal {
        (bool success, ) = to.call{gas: 23000, value: value}("");
        // (bool success,) = to.call{value:value}(new bytes(0));
        require(success, "TransferHelper: ETH_TRANSFER_FAILED");
    }

    /*
     * @notice Withdraw tokens from staking
     * @param _amount: Amount to be withdrawn
     */
    function withdraw(uint256 _amount) public {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(0);
        uint256 pending =
            user.amount.mul(pool.accCybarPerShare).div(1e12).sub(
                user.rewardDebt
            );
        if (pending > 0 && !user.inBlackList) {
            rewardToken.safeTransfer(address(msg.sender), pending);
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            IWBNB(WBNB).withdraw(_amount);
            safeTransferBNB(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accCybarPerShare).div(1e12);

        emit Withdraw(msg.sender, _amount);
    }

    /*
     * @notice Withdraw without caring about the rewards.
     */
    function emergencyWithdraw() public {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    // Withdraw reward. EMERGENCY ONLY.
    // This function needs to go, the owner is capable to just withdraw all funds?
    function emergencyRewardWithdraw(uint256 _amount) public onlyOwner {
        require(
            _amount < rewardToken.balanceOf(address(this)),
            "not enough token"
        );
        rewardToken.safeTransfer(address(msg.sender), _amount);
    }
}
