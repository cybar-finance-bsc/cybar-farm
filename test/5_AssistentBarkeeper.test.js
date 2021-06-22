const { expectRevert, time } = require('@openzeppelin/test-helpers');
const CybarToken = artifacts.require('CybarToken');
const MasterBarkeeper = artifacts.require('MasterBarkeeper');
const ShotBar = artifacts.require('ShotBar');
const AssistentBarkeeper = artifacts.require('AssistentBarkeeper');
const MockBEP20 = artifacts.require('libs/MockBEP20');

contract('AssistentBarkeeper', ([alice, bob, carol, dev, minter]) => {
  beforeEach(async () => {
    this.shot = await MockBEP20.new('LPToken', 'LP1', '1000000', {
      from: minter,
    });
    this.barkeeper = await AssistentBarkeeper.new(this.shot.address, '40', '300', '400', {
      from: minter,
    });
  });

  it('assistent barkeeper now', async () => {
    await this.shot.transfer(bob, '1000', { from: minter });
    await this.shot.transfer(carol, '1000', { from: minter });
    await this.shot.transfer(alice, '1000', { from: minter });
    assert.equal((await this.shot.balanceOf(bob)).toString(), '1000');

    await this.shot.approve(this.barkeeper.address, '1000', { from: bob });
    await this.shot.approve(this.barkeeper.address, '1000', { from: alice });
    await this.shot.approve(this.barkeeper.address, '1000', { from: carol });

    await this.barkeeper.deposit('10', { from: bob });
    assert.equal(
      (await this.shot.balanceOf(this.barkeeper.address)).toString(),
      '10'
    );

    await time.advanceBlockTo('300');

    await this.barkeeper.deposit('30', { from: alice });
    assert.equal(
      (await this.shot.balanceOf(this.barkeeper.address)).toString(),
      '40'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(bob, { from: bob })).toString(),
      '40'
    );

    await time.advanceBlockTo('302');
    assert.equal(
      (await this.barkeeper.pendingReward(bob, { from: bob })).toString(),
      '50'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(alice, { from: alice })).toString(),
      '30'
    );

    await this.barkeeper.deposit('40', { from: carol });
    assert.equal(
      (await this.shot.balanceOf(this.barkeeper.address)).toString(),
      '80'
    );
    await time.advanceBlockTo('304');
    //  bob 10, alice 30, carol 40
    assert.equal(
      (await this.barkeeper.pendingReward(bob, { from: bob })).toString(),
      '65'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(alice, { from: alice })).toString(),
      '75'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(carol, { from: carol })).toString(),
      '20'
    );

    await this.barkeeper.deposit('20', { from: alice }); // 305 bob 10, alice 50, carol 40
    await this.barkeeper.deposit('30', { from: bob }); // 306  bob 40, alice 50, carol 40

    assert.equal(
      (await this.barkeeper.pendingReward(bob, { from: bob })).toString(),
      '74'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(alice, { from: alice })).toString(),
      '110'
    );

    await time.advanceBlockTo('307');
    assert.equal(
      (await this.barkeeper.pendingReward(bob, { from: bob })).toString(),
      '86'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(alice, { from: alice })).toString(),
      '125'
    );

    await this.barkeeper.withdraw('20', { from: alice }); // 308 bob 40, alice 30, carol 40
    await this.barkeeper.withdraw('30', { from: bob }); // 309  bob 10, alice 30, carol 40

    await time.advanceBlockTo('310');
    assert.equal(
      (await this.barkeeper.pendingReward(bob, { from: bob })).toString(),
      '118'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(alice, { from: alice })).toString(),
      '166'
    );
    assert.equal(
      (await this.shot.balanceOf(this.barkeeper.address)).toString(),
      '80'
    );

    await time.advanceBlockTo('400');
    assert.equal(
      (await this.barkeeper.pendingReward(bob, { from: bob })).toString(),
      '568'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(alice, { from: alice })).toString(),
      '1516'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(carol, { from: alice })).toString(),
      '1915'
    );

    await time.advanceBlockTo('420');
    assert.equal(
      (await this.barkeeper.pendingReward(bob, { from: bob })).toString(),
      '568'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(alice, { from: alice })).toString(),
      '1516'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(carol, { from: alice })).toString(),
      '1915'
    );

    await this.barkeeper.withdraw('10', { from: bob });
    await this.barkeeper.withdraw('30', { from: alice });
    await expectRevert(this.barkeeper.withdraw('50', { from: carol }), 'not enough');
    await this.barkeeper.deposit('30', { from: carol });
    await time.advanceBlockTo('450');
    assert.equal(
      (await this.barkeeper.pendingReward(bob, { from: bob })).toString(),
      '568'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(alice, { from: alice })).toString(),
      '1516'
    );
    assert.equal(
      (await this.barkeeper.pendingReward(carol, { from: alice })).toString(),
      '1915'
    );
    await this.barkeeper.withdraw('70', { from: carol });
    assert.equal((await this.barkeeper.addressLength()).toString(), '3');
  });

  it('try shot', async () => {
    this.cybar = await CybarToken.new({ from: minter });
    this.shot = await ShotBar.new(this.cybar.address, { from: minter });
    this.lp1 = await MockBEP20.new('LPToken', 'LP1', '1000000', {
      from: minter,
    });
    this.barkeeper = await MasterBarkeeper.new(
      this.cybar.address,
      this.shot.address,
      dev,
      '1000',
      '300',
      { from: minter }
    );
    await this.cybar.transferOwnership(this.barkeeper.address, { from: minter });
    await this.shot.transferOwnership(this.barkeeper.address, { from: minter });
    await this.lp1.transfer(bob, '2000', { from: minter });
    await this.lp1.transfer(alice, '2000', { from: minter });

    await this.lp1.approve(this.barkeeper.address, '1000', { from: alice });
    await this.cybar.approve(this.barkeeper.address, '1000', { from: alice });

    await this.barkeeper.add('1000', this.lp1.address, true, { from: minter });
    await this.barkeeper.deposit(1, '20', { from: alice });
    await time.advanceBlockTo('500');
    await this.barkeeper.deposit(1, '0', { from: alice });
    await this.barkeeper.add('1000', this.lp1.address, true, { from: minter });

    await this.barkeeper.enterStaking('10', { from: alice });
    await time.advanceBlockTo('510');
    await this.barkeeper.enterStaking('10', { from: alice });

    this.barkeeper2 = await AssistentBarkeeper.new(this.shot.address, '40', '600', '800', {
      from: minter,
    });
    await this.shot.approve(this.barkeeper2.address, '10', { from: alice });
    await time.advanceBlockTo('590');
    this.barkeeper2.deposit('10', { from: alice }); //520
    await time.advanceBlockTo('610');
    assert.equal(
      (await this.shot.balanceOf(this.barkeeper2.address)).toString(),
      '10'
    );
    assert.equal(
      (await this.barkeeper2.pendingReward(alice, { from: alice })).toString(),
      '400'
    );
  });

  it('emergencyWithdraw', async () => {
    await this.shot.transfer(alice, '1000', { from: minter });
    assert.equal((await this.shot.balanceOf(alice)).toString(), '1000');

    await this.shot.approve(this.barkeeper.address, '1000', { from: alice });
    await this.barkeeper.deposit('10', { from: alice });
    assert.equal((await this.shot.balanceOf(alice)).toString(), '990');
    await this.barkeeper.emergencyWithdraw({ from: alice });
    assert.equal((await this.shot.balanceOf(alice)).toString(), '1000');
    assert.equal(
      (await this.barkeeper.pendingReward(alice, { from: alice })).toString(),
      '0'
    );
  });
});
