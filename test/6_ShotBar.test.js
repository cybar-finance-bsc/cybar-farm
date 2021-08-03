const { assert } = require('chai');
const CybarToken = artifacts.require('CybarToken');
const ShotBar = artifacts.require('ShotBar');

contract('ShotBar', ([alice, bob, carol, dev, minter]) => {
  beforeEach(async () => {
    this.cybar = await CybarToken.new({ from: minter });
    this.shot = await ShotBar.new(this.cybar.address, { from: minter });
  });

  it('mint', async () => {
    await this.shot.mint(alice, 1000, { from: minter });
    assert.equal((await this.shot.balanceOf(alice)).toString(), '1000');
  });

  it('burn', async () => {
    await this.shot.mint(alice, 1000, { from: minter });
    await this.shot.mint(bob, 1000, { from: minter });
    assert.equal((await this.shot.totalSupply()).toString(), '2000');
    await this.shot.burn(alice, 200, { from: minter });

    assert.equal((await this.shot.balanceOf(alice)).toString(), '800');
    assert.equal((await this.shot.totalSupply()).toString(), '1800');
  });

  it('safeCybarTransfer', async () => {
    assert.equal(
      (await this.cybar.balanceOf(this.shot.address)).toString(),
      '0'
    );
    await this.cybar.mint(this.shot.address, 1000, { from: minter });
    await this.shot.safeCybarTransfer(bob, 200, { from: minter });
    assert.equal((await this.cybar.balanceOf(bob)).toString(), '200');
    assert.equal(
      (await this.cybar.balanceOf(this.shot.address)).toString(),
      '800'
    );
    await this.shot.safeCybarTransfer(bob, 2000, { from: minter });
    assert.equal((await this.cybar.balanceOf(bob)).toString(), '1000');
  });
});
