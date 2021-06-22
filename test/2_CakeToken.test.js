const { assert } = require("chai");

const CybarToken = artifacts.require('CybarToken');

contract('CybarToken', ([alice, bob, carol, dev, minter]) => {
    beforeEach(async () => {
        this.cybar = await CybarToken.new({ from: minter });
    });


    it('mint', async () => {
        await this.cybar.mint(alice, 1000, { from: minter });
        assert.equal((await this.cybar.balanceOf(alice)).toString(), '1000');
    })
});
