const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { assert } = require('chai');
const CybarToken = artifacts.require('CybarToken');
const DyceBar = artifacts.require('DyceBar');
const MasterChef = artifacts.require('MasterChef');
const MockBEP20 = artifacts.require('libs/MockBEP20');
const LotteryRewardPool = artifacts.require('LotteryRewardPool');

contract('LotteryPool', ([alice, bob, carol, dev, minter]) => {
  beforeEach(async () => {
    this.cybar = await CybarToken.new({ from: minter });
    this.dyce = await DyceBar.new(this.cybar.address, { from: minter });
    this.lp1 = await MockBEP20.new('LPToken', 'LP1', '1000000', {
      from: minter,
    });
    this.lp2 = await MockBEP20.new('LPToken', 'LP2', '1000000', {
      from: minter,
    });
    this.lp3 = await MockBEP20.new('LPToken', 'LP3', '1000000', {
      from: minter,
    });
    this.lp4 = await MockBEP20.new('LPToken', 'LP4', '1000000', {
      from: minter,
    });
    this.chef = await MasterChef.new(
      this.cybar.address,
      this.dyce.address,
      dev,
      '10',
      '10',
      { from: minter }
    );
    let currentBlock = (await time.latestBlock()).toString();
    console.log(`Block: ${currentBlock}`);
    await this.cybar.transferOwnership(this.chef.address, { from: minter });
    await this.dyce.transferOwnership(this.chef.address, { from: minter });

    await this.lp1.transfer(bob, '2000', { from: minter });
    await this.lp2.transfer(bob, '2000', { from: minter });
    await this.lp3.transfer(bob, '2000', { from: minter });

    await this.lp1.transfer(alice, '2000', { from: minter });
    await this.lp2.transfer(alice, '2000', { from: minter });
    await this.lp3.transfer(alice, '2000', { from: minter });
  });

  it('real case', async () => {
    await time.advanceBlockTo('90');
    this.lottery = await LotteryRewardPool.new(
      this.chef.address,
      this.cybar.address,
      dev,
      carol,
      { from: minter }
    );
    await this.lp4.transfer(this.lottery.address, '10', { from: minter });

    await this.chef.add('1000', this.lp1.address, true, { from: minter });
    await this.chef.add('1000', this.lp2.address, true, { from: minter });
    await this.chef.add('500', this.lp3.address, true, { from: minter });
    await this.chef.add('500', this.lp4.address, true, { from: minter });

    assert.equal(
      (await this.lp4.balanceOf(this.lottery.address)).toString(),
      '10'
    );
    // 
    await this.lottery.startFarming(4, this.lp4.address, '1', { from: dev });
    
    let pendingRewardLottery = (await this.lottery.pendingReward('4')).toString();
    let currentBlock = (await time.latestBlock()).toString();
    console.log(`Block: ${currentBlock} -- Pending Reward: ${pendingRewardLottery}`);
    
    await time.advanceBlock();
    
    pendingRewardLottery = (await this.lottery.pendingReward('4')).toString();
    currentBlock = (await time.latestBlock()).toString();
    console.log(`Block: ${currentBlock} -- Pending Reward: ${pendingRewardLottery}`);

    assert.equal((await this.lottery.pendingReward('4')).toString(), '3');
    assert.equal(
      (await this.cybar.balanceOf(this.lottery.address)).toString(),
      '0'
    );

    await this.lottery.harvest(4, { from: dev });
    // console.log(await this.lottery.pendingReward(4).toString())

    assert.equal(
      (await this.cybar.balanceOf(this.lottery.address)).toString(),
      '0'
    );
    assert.equal((await this.cybar.balanceOf(carol)).toString(), '5');
  });

  it('setReceiver', async () => {
    this.lottery = await LotteryRewardPool.new(
      this.chef.address,
      this.cybar.address,
      dev,
      carol,
      { from: minter }
    );
    await this.lp1.transfer(this.lottery.address, '10', { from: minter });
    await this.chef.add('1000', this.lp1.address, true, { from: minter });
    await this.lottery.startFarming(1, this.lp1.address, '1', {
      from: dev,
    });
    await this.lottery.harvest(1, { from: dev });
    assert.equal((await this.cybar.balanceOf(carol)).toString(), '7');
    await this.lottery.setReceiver(alice, { from: dev });
    assert.equal((await this.lottery.pendingReward('1')).toString(), '7');
    await this.lottery.harvest(1, { from: dev });
    assert.equal((await this.cybar.balanceOf(alice)).toString(), '15');
  });

  it('emergencyWithdraw', async () => {});

  it('update admin', async () => {
    this.lottery = await LotteryRewardPool.new(
      this.chef.address,
      this.cybar.address,
      dev,
      carol,
      { from: minter }
    );
    assert.equal(await this.lottery.adminAddress(), dev);
    await this.lottery.setAdmin(alice, { from: minter });
    assert.equal(await this.lottery.adminAddress(), alice);
    await this.chef.add('1000', this.lp1.address, true, { from: minter });
    await expectRevert(
      this.lottery.startFarming(1, this.lp1.address, '1', { from: dev }),
      'admin: wut?'
    );
  });
});
