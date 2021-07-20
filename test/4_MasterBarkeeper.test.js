const { expectRevert, time } = require('@openzeppelin/test-helpers');
const CybarToken = artifacts.require('CybarToken');
const ShotBar = artifacts.require('ShotBar');
const MasterBarkeeper = artifacts.require('MasterBarkeeper');
const MockBEP20 = artifacts.require('libs/MockBEP20');

contract('MasterBarkeeper', ([alice, bob, carol, dev, minter, treasury]) => {
  beforeEach(async () => {
    this.cybar = await CybarToken.new({ from: minter });
    this.shot = await ShotBar.new(this.cybar.address, { from: minter });
    this.lp1 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
    this.lp2 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: minter });
    this.lp3 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: minter });
      this.barkeeper = await MasterBarkeeper.new(this.cybar.address, this.shot.address, dev, treasury, '1000', '100', { from: minter });
    await this.cybar.transferOwnership(this.barkeeper.address, { from: minter });
    await this.shot.transferOwnership(this.barkeeper.address, { from: minter });

    await this.lp1.transfer(bob, '2000', { from: minter });
    await this.lp2.transfer(bob, '2000', { from: minter });
    await this.lp3.transfer(bob, '2000', { from: minter });

    await this.lp1.transfer(alice, '2000', { from: minter });
    await this.lp2.transfer(alice, '2000', { from: minter });
    await this.lp3.transfer(alice, '2000', { from: minter });
  });
  it('real case', async () => {
    this.lp4 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
    this.lp5 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: minter });
    this.lp6 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: minter });
    this.lp7 = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
    this.lp8 = await MockBEP20.new('LPToken', 'LP2', '1000000', { from: minter });
    this.lp9 = await MockBEP20.new('LPToken', 'LP3', '1000000', { from: minter });
    await this.barkeeper.add('2000', this.lp1.address, true, { from: minter });
    await this.barkeeper.add('1000', this.lp2.address, true, { from: minter });
    await this.barkeeper.add('500', this.lp3.address, true, { from: minter });
    await this.barkeeper.add('500', this.lp3.address, true, { from: minter });
    await this.barkeeper.add('500', this.lp3.address, true, { from: minter });
    await this.barkeeper.add('500', this.lp3.address, true, { from: minter });
    await this.barkeeper.add('500', this.lp3.address, true, { from: minter });
    await this.barkeeper.add('100', this.lp3.address, true, { from: minter });
    await this.barkeeper.add('100', this.lp3.address, true, { from: minter });
    assert.equal((await this.barkeeper.poolLength()).toString(), "10");

    await time.advanceBlockTo('170');
    await this.lp1.approve(this.barkeeper.address, '1000', { from: alice });
    assert.equal((await this.cybar.balanceOf(alice)).toString(), '0');
    await this.barkeeper.deposit(1, '20', { from: alice });
    await this.barkeeper.withdraw(1, '20', { from: alice });
    assert.equal((await this.cybar.balanceOf(alice)).toString(), '263');

    await this.cybar.approve(this.barkeeper.address, '1000', { from: alice });
    await this.barkeeper.enterStaking('20', { from: alice });
    await this.barkeeper.enterStaking('0', { from: alice });
    await this.barkeeper.enterStaking('0', { from: alice });
    await this.barkeeper.enterStaking('0', { from: alice });
    assert.equal((await this.cybar.balanceOf(alice)).toString(), '993');
    // assert.equal((await this.barkeeper.getPoolPoint(0, { from: minter })).toString(), '1900');
  })


  it('deposit/withdraw', async () => {
    await this.barkeeper.add('1000', this.lp1.address, true, { from: minter });
    await this.barkeeper.add('1000', this.lp2.address, true, { from: minter });
    await this.barkeeper.add('1000', this.lp3.address, true, { from: minter });

    await this.lp1.approve(this.barkeeper.address, '100', { from: alice });
    await this.barkeeper.deposit(1, '20', { from: alice });
    await this.barkeeper.deposit(1, '0', { from: alice });
    await this.barkeeper.deposit(1, '40', { from: alice });
    await this.barkeeper.deposit(1, '0', { from: alice });
    assert.equal((await this.lp1.balanceOf(alice)).toString(), '1940');
    await this.barkeeper.withdraw(1, '10', { from: alice });
    assert.equal((await this.lp1.balanceOf(alice)).toString(), '1950');
    assert.equal((await this.cybar.balanceOf(alice)).toString(), '999');
    assert.equal((await this.cybar.balanceOf(dev)).toString(), '100');

    await this.lp1.approve(this.barkeeper.address, '100', { from: bob });
    assert.equal((await this.lp1.balanceOf(bob)).toString(), '2000');
    await this.barkeeper.deposit(1, '50', { from: bob });
    assert.equal((await this.lp1.balanceOf(bob)).toString(), '1950');
    await this.barkeeper.deposit(1, '0', { from: bob });
    assert.equal((await this.cybar.balanceOf(bob)).toString(), '125');
    await this.barkeeper.emergencyWithdraw(1, { from: bob });
    assert.equal((await this.lp1.balanceOf(bob)).toString(), '2000');
  })

  it('staking/unstaking', async () => {
    await this.barkeeper.add('1000', this.lp1.address, true, { from: minter });
    await this.barkeeper.add('1000', this.lp2.address, true, { from: minter });
    await this.barkeeper.add('1000', this.lp3.address, true, { from: minter });

    await this.lp1.approve(this.barkeeper.address, '10', { from: alice });
    await this.barkeeper.deposit(1, '2', { from: alice }); //0
    await this.barkeeper.withdraw(1, '2', { from: alice }); //1

    await this.cybar.approve(this.barkeeper.address, '250', { from: alice });
    await this.barkeeper.enterStaking('240', { from: alice }); //3
    assert.equal((await this.shot.balanceOf(alice)).toString(), '240');
    assert.equal((await this.cybar.balanceOf(alice)).toString(), '10');
    await this.barkeeper.enterStaking('10', { from: alice }); //4
    assert.equal((await this.shot.balanceOf(alice)).toString(), '250');
    assert.equal((await this.cybar.balanceOf(alice)).toString(), '249');
    await this.barkeeper.leaveStaking(250);
    assert.equal((await this.shot.balanceOf(alice)).toString(), '0');
    assert.equal((await this.cybar.balanceOf(alice)).toString(), '749');

  });


  it('update multiplier', async () => {
    await this.barkeeper.add('1000', this.lp1.address, true, { from: minter });
    await this.barkeeper.add('1000', this.lp2.address, true, { from: minter });
    await this.barkeeper.add('1000', this.lp3.address, true, { from: minter });

    await this.lp1.approve(this.barkeeper.address, '100', { from: alice });
    await this.lp1.approve(this.barkeeper.address, '100', { from: bob });
    await this.barkeeper.deposit(1, '100', { from: alice });
    await this.barkeeper.deposit(1, '100', { from: bob });
    await this.barkeeper.deposit(1, '0', { from: alice });
    await this.barkeeper.deposit(1, '0', { from: bob });

    await this.cybar.approve(this.barkeeper.address, '100', { from: alice });
    await this.cybar.approve(this.barkeeper.address, '100', { from: bob });
    await this.barkeeper.enterStaking('50', { from: alice });
    await this.barkeeper.enterStaking('100', { from: bob });

    await this.barkeeper.updateMultiplier('0', { from: minter });

    await this.barkeeper.enterStaking('0', { from: alice });
    await this.barkeeper.enterStaking('0', { from: bob });
    await this.barkeeper.deposit(1, '0', { from: alice });
    await this.barkeeper.deposit(1, '0', { from: bob });

    assert.equal((await this.cybar.balanceOf(alice)).toString(), '700');
    assert.equal((await this.cybar.balanceOf(bob)).toString(), '150');

    await time.advanceBlockTo('265');

    await this.barkeeper.enterStaking('0', { from: alice });
    await this.barkeeper.enterStaking('0', { from: bob });
    await this.barkeeper.deposit(1, '0', { from: alice });
    await this.barkeeper.deposit(1, '0', { from: bob });

    assert.equal((await this.cybar.balanceOf(alice)).toString(), '700');
    assert.equal((await this.cybar.balanceOf(bob)).toString(), '150');

    await this.barkeeper.leaveStaking('50', { from: alice });
    await this.barkeeper.leaveStaking('100', { from: bob });
    await this.barkeeper.withdraw(1, '100', { from: alice });
    await this.barkeeper.withdraw(1, '100', { from: bob });

  });

    it('withdrawal fees', async () => {
        await this.barkeeper.add('1000', this.lp1.address, true, { from: minter });
        await this.barkeeper.add('1000', this.lp2.address, true, { from: minter });
        await this.barkeeper.setWithdrawal(1, 100, 72*60*60, { from: minter });
        await this.barkeeper.setWithdrawal(2, 100, 60, { from: minter });

        await this.lp1.approve(this.barkeeper.address, '100', { from: alice });
        await this.barkeeper.deposit(1, '100', { from: alice });
        await this.barkeeper.withdraw(1, '100', { from: alice });
        assert.equal((await this.lp1.balanceOf(alice)).toString(), '1999');
        assert.equal((await this.lp1.balanceOf(treasury)).toString(), '1');

        await this.lp2.approve(this.barkeeper.address, '100', { from: bob });
        await this.barkeeper.deposit(2, '100', { from: bob });
        await time.increase(60);
        await this.barkeeper.withdraw(2, '100', { from: bob });
        assert.equal((await this.lp2.balanceOf(bob)).toString(), '2000');
        assert.equal((await this.lp2.balanceOf(treasury)).toString(), '0');
        
        await expectRevert(this.barkeeper.setWithdrawal(1, 201, 72*60*60, { from: minter}), 'Withdrawal fee is too large');
        await expectRevert(this.barkeeper.setWithdrawal(1, 200, 72*60*60+1, {from: minter}), 'Withdrawal fee time period is too large');
    });

  it('should allow dev and only dev to update dev', async () => {
    assert.equal((await this.barkeeper.devaddr()).valueOf(), dev);
    await expectRevert(this.barkeeper.dev(bob, { from: bob }), 'dev: wut?');
    await this.barkeeper.dev(bob, { from: dev });
    assert.equal((await this.barkeeper.devaddr()).valueOf(), bob);
    await this.barkeeper.dev(alice, { from: bob });
    assert.equal((await this.barkeeper.devaddr()).valueOf(), alice);
  })
});
