const { advanceBlockTo } = require('@openzeppelin/test-helpers/src/time');
const { assert } = require('chai');
const CybarToken = artifacts.require('CybarToken');
const DyceBar = artifacts.require('DyceBar');

contract('DyceBar', ([alice, bob, carol, dev, minter]) => {
  beforeEach(async () => {
    this.cybar = await CybarToken.new({ from: minter });
    this.dyce = await DyceBar.new(this.cybar.address, { from: minter });
  });

  it('mint', async () => {
    await this.dyce.mint(alice, 1000, { from: minter });
    assert.equal((await this.dyce.balanceOf(alice)).toString(), '1000');
  });

  it('burn', async () => {
    await advanceBlockTo('60');
    await this.dyce.mint(alice, 1000, { from: minter });
    await this.dyce.mint(bob, 1000, { from: minter });
    assert.equal((await this.dyce.totalSupply()).toString(), '2000');
    await this.dyce.burn(alice, 200, { from: minter });

    assert.equal((await this.dyce.balanceOf(alice)).toString(), '800');
    assert.equal((await this.dyce.totalSupply()).toString(), '1800');
  });

  it('safeCybarTransfer', async () => {
    assert.equal(
      (await this.cybar.balanceOf(this.dyce.address)).toString(),
      '0'
    );
    await this.cybar.mint(this.dyce.address, 1000, { from: minter });
    await this.dyce.safeCybarTransfer(bob, 200, { from: minter });
    assert.equal((await this.cybar.balanceOf(bob)).toString(), '200');
    assert.equal(
      (await this.cybar.balanceOf(this.dyce.address)).toString(),
      '800'
    );
    await this.dyce.safeCybarTransfer(bob, 2000, { from: minter });
    assert.equal((await this.cybar.balanceOf(bob)).toString(), '1000');
  });
});
