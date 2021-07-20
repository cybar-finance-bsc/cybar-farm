pragma solidity 0.6.12;

import "@pancakeswap/pancake-swap-lib/contracts/math/SafeMath.sol";
import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/IBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/token/BEP20/SafeBEP20.sol";
import "@pancakeswap/pancake-swap-lib/contracts/access/Ownable.sol";

import "./CybarToken.sol";
import "./ShotBar.sol";

interface IMigratorBarkeeper {
    // Perform LP token migration from legacy CybarSwap to CybarSwap.
    // Take the current LP token address and return the new LP token address.
    // Migrator should have full access to the caller's LP token.
    // Return the new LP token address.
    //
    // XXX Migrator must have allowance access to CybarSwap LP tokens.
    // CybarSwap must mint EXACTLY the same amount of CybarSwap LP tokens or
    // else something bad will happen. Traditional CybarSwap does not
    // do that so be careful!
    function migrate(IBEP20 token) external returns (IBEP20);
}

/*
 * @notice MasterBarkeeper controls the Cybar token distributed to the different pools.
 * It can mint new Cybar.
 * @dev The pool with pool Id = 0 is the Cybar staking pool
 */
contract MasterBarkeeper is Ownable {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided
        uint256 rewardDebt; // How many Cybar has the user already received
        uint256 lastDepositTime; // Time of the last user deposit
    }

    struct PoolInfo {
        IBEP20 lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. Cybars to distribute per block.
        uint256 lastRewardBlock; // Last block number that Cybars distribution occurs.
        uint256 accCybarPerShare; // Accumulated Cybars per share, times 1e12. See below.
        uint256 withdrawFeePeriod; // Timeframe in which a withdrawal fee will be applied.
        uint256 withdrawFee; // Withdrawal fee if the user withdraws the investment before the time lock has finished 
    }

    CybarToken public cybar;
    ShotBar public shot;
    address public devaddr;
    address public treasury;
    uint256 public cybarPerBlock;
    uint256 public BONUS_MULTIPLIER = 1;
    IMigratorBarkeeper public migrator;

    PoolInfo[] public poolInfo;
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    uint256 public totalAllocPoint = 0;
    uint256 public startBlock;

    /*
     * Maximal withdrawal fee parameters. MAX_WITHDRAW_FEE is given in 10**-4
     */
    uint256 public constant MAX_WITHDRAW_FEE = 200;
    uint256 public constant MAX_WITHDRAW_FEE_PERIOD = 72 hours;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );

    constructor(
        CybarToken _cybar,
        ShotBar _shot,
        address _devaddr,
        address _treasury,
        uint256 _cybarPerBlock,
        uint256 _startBlock
    ) public {
        cybar = _cybar;
        shot = _shot;
        devaddr = _devaddr;
        treasury = _treasury;
        cybarPerBlock = _cybarPerBlock;
        startBlock = _startBlock;

        poolInfo.push(
            PoolInfo({
                lpToken: _cybar,
                allocPoint: 1000,
                lastRewardBlock: startBlock,
                accCybarPerShare: 0,
                withdrawFeePeriod: 0,
                withdrawFee: 0
            })
        );

        totalAllocPoint = 1000;
    }

    /*
     * @notice Updates multiplier
     * @param multiplierNumber: New multiplier number
     */
    function updateMultiplier(uint256 multiplierNumber) public onlyOwner {
        BONUS_MULTIPLIER = multiplierNumber;
    }

    /*
     * @notice returns the number of pools
     */
    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /*
     * @notice Adds new LP to the pool. Can only be called by the owner. Do not add the same LP more than once.
     * @param _allocPoint: Allocation points for that LP pool
     * @param _lpToken: LP Token to be added
     * @param _withUpdate: Whether to update all pools
     */
    function add(
        uint256 _allocPoint,
        IBEP20 _lpToken,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock =
            block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accCybarPerShare: 0,
                withdrawFeePeriod: 0,
                withdrawFee: 0
                })
        );
        updateStakingPool();
    }

    /*
     * @notice Sets pool specific parameter
     * @param _pid: Pool Id of the pool to be updated
     * @param _allocPoint: Allocation points
     * @param _withdrawFee: Withdrawal fee for an early withdrawal
     * @param _withdrawFeePeriod: Time frame in which a withdrawal fee is applied
     * @param _withUpdate: Whether to update all pools
     */
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        uint256 _withdrawFee,
        uint256 _withdrawFeePeriod,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        require(_withdrawFee <= MAX_WITHDRAW_FEE, "Withdrawal fee is too large");
        require(_withdrawFeePeriod <= MAX_WITHDRAW_FEE_PERIOD, "Withdrawal fee time period is too large");
        uint256 prevAllocPoint = poolInfo[_pid].allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        poolInfo[_pid].withdrawFeePeriod = _withdrawFeePeriod;
        poolInfo[_pid].withdrawFee = _withdrawFee;
        if (prevAllocPoint != _allocPoint) {
            totalAllocPoint = totalAllocPoint.sub(prevAllocPoint).add(
                _allocPoint
            );
            updateStakingPool();
        }
    }

    /*
     * @notice Sets allocations points
     * @param _pid: Pool Id
     * @param _allocPoint: New allocation points for that pool
     * @param _withUpdate: Whether to update all pools before setting of allocation points
     */
    function setAllocPoint(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate){
            massUpdatePools();
        } 
        uint256 prevAllocPoint = poolInfo[_pid].allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        if (prevAllocPoint != _allocPoint) {
            totalAllocPoint = totalAllocPoint.sub(prevAllocPoint).add(_allocPoint);
            updateStakingPool();
        }
    }

    /*
     * @notice Set time related withdrawal fees
     * @param _pid: Pool Id
     * @param _withdrawFee: Withdrawal fee for premature withdrawal
     * @param _withdrawFeePeriod: Withdrawal fee period
     */
    function setWithdrawal(
        uint256 _pid,
        uint256 _withdrawFee,
        uint256 _withdrawFeePeriod
    ) public onlyOwner {
        require(_withdrawFee <= MAX_WITHDRAW_FEE, "Withdrawal fee is too large");
        require(_withdrawFeePeriod <= MAX_WITHDRAW_FEE_PERIOD, "Withdrawal fee time period is too large");
        poolInfo[_pid].withdrawFee = _withdrawFee;
        poolInfo[_pid].withdrawFeePeriod = _withdrawFeePeriod;
    }

    /*
     * @notice Updates the allocation points of the staking pool by setting it to a third of all allocation pools in the farms.
     */
    function updateStakingPool() internal {
        uint256 length = poolInfo.length;
        uint256 points = 0;
        for (uint256 pid = 1; pid < length; ++pid) {
            points = points.add(poolInfo[pid].allocPoint);
        }
        if (points != 0) {
            points = points.div(3);
            totalAllocPoint = totalAllocPoint.sub(poolInfo[0].allocPoint).add(
                points
            );
            poolInfo[0].allocPoint = points;
        }
    }

    /*
     * @notice Sets a new migrator
     * @dev Can only be called by the owner
     * @param _migrator: New migrator
     */
    function setMigrator(IMigratorBarkeeper _migrator) public onlyOwner {
        migrator = _migrator;
    }

    /*
     * @notice Migrates LP token to another LP contract.
     * @dev Can be called by anyone. Is this intended?
     * @param _pid: Pool Id of the pool to be migrated
     */
    function migrate(uint256 _pid) public {
        require(address(migrator) != address(0), "migrate: no migrator");
        PoolInfo storage pool = poolInfo[_pid];
        IBEP20 lpToken = pool.lpToken;
        uint256 bal = lpToken.balanceOf(address(this));
        lpToken.safeApprove(address(migrator), bal);
        IBEP20 newLpToken = migrator.migrate(lpToken);
        require(bal == newLpToken.balanceOf(address(this)), "migrate: bad");
        pool.lpToken = newLpToken;
    }

    /*
     * @notice Returns the multiplier between the _from and _to block
     * @param _from: Reference start block
     * @param _to: Reference end block
     */
    function getMultiplier(uint256 _from, uint256 _to)
        public
        view
        returns (uint256)
    {
        return _to.sub(_from).mul(BONUS_MULTIPLIER);
    }

    /*
     * @notice Returns the pending Cybar of a user for a pool
     * @param _pid: Pool Id of the pool
     * @param _user: User address
     */
    function pendingCybar(uint256 _pid, address _user)
        external
        view
        returns (uint256)
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accCybarPerShare = pool.accCybarPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier =
                getMultiplier(pool.lastRewardBlock, block.number);
            uint256 cybarReward =
                multiplier.mul(cybarPerBlock).mul(pool.allocPoint).div(
                    totalAllocPoint
                );
            accCybarPerShare = accCybarPerShare.add(
                cybarReward.mul(1e12).div(lpSupply)
            );
        }
        return user.amount.mul(accCybarPerShare).div(1e12).sub(user.rewardDebt);
    }

    /*
     * @notice Loops through all pools and updates each
     */
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    /*
     * @notice Updates reward variables of a pool given its pool Id
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
            multiplier.mul(cybarPerBlock).mul(pool.allocPoint).div(
                totalAllocPoint
            );
        cybar.mint(devaddr, cybarReward.div(10));
        cybar.mint(address(shot), cybarReward);
        pool.accCybarPerShare = pool.accCybarPerShare.add(
            cybarReward.mul(1e12).div(lpSupply)
        );
        pool.lastRewardBlock = block.number;
    }

    /*
     * @notice Deposit LP tokens to MasterBarkeeper for Cybar allocation
     * @param _pid: Pool Id
     * @param _amount: Amount of LP token
     */
    function deposit(uint256 _pid, uint256 _amount) public {
        require(_pid != 0, "deposit Cybar by staking");

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending =
                user.amount.mul(pool.accCybarPerShare).div(1e12).sub(
                    user.rewardDebt
                );
            if (pending > 0) {
                safeCybarTransfer(msg.sender, pending);
            }
        }
        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(
                address(msg.sender),
                address(this),
                _amount
            );
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accCybarPerShare).div(1e12);
        user.lastDepositTime = block.timestamp;
        emit Deposit(msg.sender, _pid, _amount);
    }

    /*
     * @notice Withdraw from LP pool
     * @param _pid: Pool Id
     * @param _amount: Amount of LP tokens to withdraw
     */
    function withdraw(uint256 _pid, uint256 _amount) public {
        require(_pid != 0, "Withdraw Cybar by unstaking");
        require(_amount > 0, "Nothing to withdraw");
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "Withdraw: not good");

        updatePool(_pid);
        uint256 pending =
            user.amount.mul(pool.accCybarPerShare).div(1e12).sub(
                user.rewardDebt
            );
        if (pending > 0) {
            safeCybarTransfer(msg.sender, pending);
        }
        uint256 currentAmount = _amount;
        user.amount = user.amount.sub(_amount);
        if(block.timestamp < user.lastDepositTime + pool.withdrawFeePeriod){
            uint256 withdrawFee = currentAmount.mul(pool.withdrawFee).div(10000);
            pool.lpToken.safeTransfer(treasury, withdrawFee);
            currentAmount = currentAmount.sub(withdrawFee);
        }
        pool.lpToken.safeTransfer(address(msg.sender), currentAmount);
        user.rewardDebt = user.amount.mul(pool.accCybarPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    /*
     * @notice Stake Cybar tokens to MasterBarkeeper
     * @param _amount: Amount of Cybar to be staked
     */
    function enterStaking(uint256 _amount) public {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];
        updatePool(0);
        if (user.amount > 0) {
            uint256 pending =
                user.amount.mul(pool.accCybarPerShare).div(1e12).sub(
                    user.rewardDebt
                );
            if (pending > 0) {
                safeCybarTransfer(msg.sender, pending);
            }
        }
        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(
                address(msg.sender),
                address(this),
                _amount
            );
            user.amount = user.amount.add(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accCybarPerShare).div(1e12);

        shot.mint(msg.sender, _amount);
        emit Deposit(msg.sender, 0, _amount);
    }

    /*
     * @notice Withdraw Cybar token from staking
     * @param _amount: Amount to be withdrawn from staking
     */
    function leaveStaking(uint256 _amount) public {
        PoolInfo storage pool = poolInfo[0];
        UserInfo storage user = userInfo[0][msg.sender];
        require(user.amount >= _amount, "Withdraw: not good");
        updatePool(0);
        uint256 pending =
            user.amount.mul(pool.accCybarPerShare).div(1e12).sub(
                user.rewardDebt
            );
        if (pending > 0) {
            safeCybarTransfer(msg.sender, pending);
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accCybarPerShare).div(1e12);

        shot.burn(msg.sender, _amount);
        emit Withdraw(msg.sender, 0, _amount);
    }

    /*
     * @notice Withdraw from pool in case of an emergency. All rewards will be forfeited.
     * @param _pid: Pool Id
     */
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    /*
     * @notice Safe Cybar transfer function.
     * @param _to: Address the Cybar is sent to
     * @param _amount: Amount to be transfered
     */
    function safeCybarTransfer(address _to, uint256 _amount) internal {
        shot.safeCybarTransfer(_to, _amount);
    }

    /*
     * @notice Update developer address
     * @dev Can only be called by the current developer
     * @param _devaddr: New developer address
     */
    function dev(address _devaddr) public {
        require(msg.sender == devaddr, "dev: wut?");
        devaddr = _devaddr;
    }
}
