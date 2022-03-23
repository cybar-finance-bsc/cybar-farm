import pytest

import brownie
from brownie import accounts, MasterBarkeeper, CybarToken, ShotBar, MockERC20
from brownie.network.contract import ProjectContract
from brownie.network.state import Chain
from brownie import web3

@pytest.fixture
def prepare_contracts():
    alice, bob, carol, dev, minter, treasury = [accounts[i] for i in range(6)]
    cybar = minter.deploy(CybarToken)
    shot = minter.deploy(ShotBar, cybar.address)
    cybar.mint(minter.address, 1000000, {'from': minter})
    lp1 = minter.deploy(MockERC20, 'LPtoken', 'LP1', 1000000)
    lp2 = minter.deploy(MockERC20, 'LPtoken', 'LP2', 1000000)
    lp3 = minter.deploy(MockERC20, 'LPtoken', 'LP3', 1000000)
    barkeeper = minter.deploy(MasterBarkeeper, cybar.address, shot.address, dev, treasury, 1000, 0)
    cybar.transferOwnership(barkeeper, {'from': minter})
    shot.transferOwnership(barkeeper, {'from': minter})

    lp1.transfer(bob, 2000, {'from': minter})
    lp2.transfer(bob, 2000, {'from': minter})
    lp3.transfer(bob, 2000, {'from': minter})

    lp1.transfer(alice, 2000, {'from': minter})
    lp2.transfer(alice, 2000, {'from': minter})
    lp3.transfer(alice, 2000, {'from': minter})

    return cybar, shot, barkeeper, lp1, lp2, lp3
    

def test_deploy(prepare_contracts):
    alice, bob, carol, dev, minter, treasury = [accounts[i] for i in range(6)]
    cybar, shot, barkeeper, lp1, lp2, lp3= prepare_contracts
    assert(barkeeper.cybar()==cybar.address)
    assert(barkeeper.shot()==shot.address)
    assert(barkeeper.devaddr()==dev)
    assert(barkeeper.treasury()==treasury)

def test_addding_pools(prepare_contracts):
    alice, bob, carol, dev, minter, treasury = [accounts[i] for i in range(6)]
    cybar, shot, barkeeper, lp1, lp2, lp3= prepare_contracts
    lp4 = minter.deploy(MockERC20, 'lptoken', 'lp4', 1000000)
    lp5 = minter.deploy(MockERC20, 'lptoken', 'lp5', 1000000)
    lp6 = minter.deploy(MockERC20, 'lptoken', 'lp6', 1000000)
    lp7 = minter.deploy(MockERC20, 'lptoken', 'lp7', 1000000)
    lp8 = minter.deploy(MockERC20, 'lptoken', 'lp8', 1000000)
    lp9 = minter.deploy(MockERC20, 'lptoken', 'lp9', 1000000)

    barkeeper.add(2000, lp1.address, True, {'from': minter})
    barkeeper.add(1000, lp2.address, True, {'from': minter})
    barkeeper.add(500, lp3.address, True, {'from': minter})
    barkeeper.add(500, lp4.address, True, {'from': minter})
    barkeeper.add(500, lp5.address, True, {'from': minter})
    barkeeper.add(500, lp6.address, True, {'from': minter})
    barkeeper.add(500, lp7.address, True, {'from': minter})
    barkeeper.add(100, lp8.address, True, {'from': minter})
    barkeeper.add(100, lp9.address, True, {'from': minter})
    assert(barkeeper.poolLength()==10)

def test_farming_correct_amount(prepare_contracts):
    chain = Chain()
    alice, bob, carol, dev, minter, treasury = [accounts[i] for i in range(6)]
    cybar, shot, barkeeper, lp1, lp2, lp3= prepare_contracts
    barkeeper.add(2000, lp1.address, True, {'from': minter})
    barkeeper.add(3700, lp2.address, True, {'from': minter})
    chain.mine(40)

    lp1.approve(barkeeper.address, 1000, {'from': alice})
    assert(cybar.balanceOf(alice)==0)
    barkeeper.deposit(1, 20, {'from': alice})
    barkeeper.withdraw(1, 20, {'from': alice})
    assert(cybar.balanceOf(alice)==263)

def test_staking_correct_amount(prepare_contracts):
    alice, bob, carol, dev, minter, treasury = [accounts[i] for i in range(6)]
    cybar, shot, barkeeper, lp1, lp2, lp3= prepare_contracts
    cybar.transfer(alice.address, 1000, {'from': minter})
    barkeeper.add(5700, lp1.address, True, {'from': minter})
    cybar.approve(barkeeper.address, 1000, {'from': alice})

    barkeeper.enterStaking(20, {'from': alice})
    barkeeper.enterStaking(0, {'from': alice})
    barkeeper.enterStaking(0, {'from': alice})
    barkeeper.enterStaking(0, {'from': alice})
    barkeeper.leaveStaking(20, {'from': alice})
    assert(cybar.balanceOf(alice.address)-1000==1000)

def test_deposit_withdraw(prepare_contracts):
    chain = Chain()
    alice, bob, carol, dev, minter, treasury = [accounts[i] for i in range(6)]
    cybar, shot, barkeeper, lp1, lp2, lp3= prepare_contracts
    barkeeper.add(1000, lp1.address, True, {'from': minter})
    barkeeper.add(1000, lp2.address, True, {'from': minter})
    barkeeper.add(1000, lp3.address, True, {'from': minter})

    lp1.approve(barkeeper.address, 100, {'from': alice})
    assert(cybar.balanceOf(alice.address)==0)
    barkeeper.deposit(1, 20, {'from': alice})
    assert(cybar.balanceOf(alice.address)==0)
    barkeeper.deposit(1, 0, {'from': alice})
    assert(cybar.balanceOf(alice.address)==250)
    barkeeper.deposit(1, 40, {'from': alice})
    assert(cybar.balanceOf(alice.address)==500)
    barkeeper.deposit(1, 0, {'from': alice})
    assert(cybar.balanceOf(alice.address)==749) # Due to the added 40 LP token a rounding error occurs
    barkeeper.withdraw(1, 10, {'from': alice})
    assert(cybar.balanceOf(alice.address)==999)

    lp1.approve(barkeeper.address, 100, {'from': bob})
    barkeeper.deposit(1, 50, {'from': bob})
    barkeeper.deposit(1, 0, {'from': bob})
    assert(cybar.balanceOf(bob.address)==125)

def test_emergency_withdrawal(prepare_contracts):
    chain = Chain()
    alice, bob, carol, dev, minter, treasury = [accounts[i] for i in range(6)]
    cybar, shot, barkeeper, lp1, lp2, lp3= prepare_contracts
    barkeeper.add(1000, lp1.address, True, {'from': minter})
    lp1.approve(barkeeper.address, 1000, {'from': bob})
    barkeeper.deposit(1, 50, {'from': bob})
    assert(lp1.balanceOf(bob.address)==1950)
    assert(cybar.balanceOf(bob.address)==0)
    barkeeper.emergencyWithdraw(1, {'from': bob})
    assert(lp1.balanceOf(bob.address)==2000)
    assert(cybar.balanceOf(bob.address)==0)

def test_staking_unstaking(prepare_contracts):
    alice, bob, carol, dev, minter, treasury = [accounts[i] for i in range(6)]
    cybar, shot, barkeeper, lp1, lp2, lp3= prepare_contracts

    barkeeper.add(1000, lp1.address, True, {'from': minter})
    barkeeper.add(1000, lp2.address, True, {'from': minter})
    barkeeper.add(1000, lp3.address, True, {'from': minter})

    cybar.transfer(alice.address, 250, {'from': minter})
    cybar.approve(barkeeper.address, 1000, {'from': alice})
    barkeeper.enterStaking(240, {'from': alice})
    assert(shot.balanceOf(alice.address)==240)
    assert(cybar.balanceOf(alice.address)==10)
    barkeeper.enterStaking(10, {'from': alice})
    assert(shot.balanceOf(alice.address)==250)
    assert(cybar.balanceOf(alice.address)==249)
    barkeeper.leaveStaking(250, {'from': alice})
    assert(shot.balanceOf(alice.address)==0)
    assert(cybar.balanceOf(alice.address)==749)

def test_update_multiplier(prepare_contracts):
    chain = Chain()
    alice, bob, carol, dev, minter, treasury = [accounts[i] for i in range(6)]
    cybar, shot, barkeeper, lp1, lp2, lp3= prepare_contracts

    barkeeper.add(1000, lp1.address, True, {'from': minter})
    barkeeper.add(1000, lp2.address, True, {'from': minter})
    barkeeper.add(1000, lp3.address, True, {'from': minter})

    lp1.approve(barkeeper.address, 100, {'from': alice})
    lp1.approve(barkeeper.address, 100, {'from': bob})
    barkeeper.deposit(1, 100, {'from': alice})
    barkeeper.deposit(1, 100, {'from': bob})
    barkeeper.deposit(1, 0, {'from': alice})
    barkeeper.deposit(1, 0, {'from': bob})

    cybar.approve(barkeeper.address, 100, {'from': alice})
    cybar.approve(barkeeper.address, 100, {'from': bob})
    barkeeper.enterStaking(50, {'from': alice})
    barkeeper.enterStaking(100, {'from': bob})

    barkeeper.updateMultiplier(0, {'from': minter})

    barkeeper.enterStaking(0, {'from': alice})
    barkeeper.enterStaking(0, {'from': bob})
    barkeeper.deposit(1, 0, {'from': alice})
    barkeeper.deposit(1, 0, {'from': bob})

    assert(cybar.balanceOf(alice.address)==700)
    assert(cybar.balanceOf(bob.address)==150)

    chain.mine(128)

    barkeeper.enterStaking(0, {'from': alice})
    barkeeper.enterStaking(0, {'from': bob})
    barkeeper.deposit(1, 0, {'from': alice})
    barkeeper.deposit(1, 0, {'from': bob})

    assert(cybar.balanceOf(alice.address)==700)
    assert(cybar.balanceOf(bob.address)==150)

    barkeeper.leaveStaking(50, {'from': alice})
    barkeeper.leaveStaking(100, {'from': bob})
    barkeeper.withdraw(1, 100, {'from': alice})
    barkeeper.withdraw(1, 100, {'from': bob})

    assert(cybar.balanceOf(alice.address)==750)
    assert(cybar.balanceOf(bob.address)==250)

    assert(shot.balanceOf(alice.address)==0)
    assert(shot.balanceOf(bob.address)==0)

    assert(lp1.balanceOf(alice.address)==2000)
    assert(lp1.balanceOf(bob.address)==2000)

def test_withdrawal_fees(prepare_contracts):
    chain = Chain()
    alice, bob, carol, dev, minter, treasury = [accounts[i] for i in range(6)]
    cybar, shot, barkeeper, lp1, lp2, lp3= prepare_contracts
    barkeeper.add(1000, lp1.address, True, {'from': minter})
    barkeeper.add(1000, lp2.address, True, {'from': minter})
    barkeeper.setWithdrawal(1, 100, 72*60*60, {'from': minter})
    barkeeper.setWithdrawal(2, 100, 60, {'from': minter})

    lp1.approve(barkeeper.address, 100, {'from': alice})
    barkeeper.deposit(1, 100, {'from': alice})
    barkeeper.withdraw(1, 100, {'from': alice})

    assert(lp1.balanceOf(alice.address)==1999)
    assert(lp1.balanceOf(treasury.address)==1)

    lp2.approve(barkeeper.address, 100, {'from': bob})
    barkeeper.deposit(2, 100, {'from': bob})
    chain.sleep(60)
    barkeeper.withdraw(2, 100, {'from': bob})
    assert(lp2.balanceOf(bob.address)==2000)
    assert(lp2.balanceOf(treasury.address)==0)

def test_safety_checks_withdrawal(prepare_contracts):
    chain = Chain()
    alice, bob, carol, dev, minter, treasury = [accounts[i] for i in range(6)]
    cybar, shot, barkeeper, lp1, lp2, lp3= prepare_contracts
    barkeeper.add(1000, lp1.address, True, {'from': minter})

    with brownie.reverts("Withdrawal fee is too large"):
        barkeeper.setWithdrawal(1, 201, 72*60*60, {'from': minter})

    with brownie.reverts("Withdrawal fee time period is too large"):
        barkeeper.setWithdrawal(1, 200, 72*60*60+1, {'from': minter})

def test_safety_checks_barkeeper(prepare_contracts):
    alice, bob, carol, dev, minter, treasury = [accounts[i] for i in range(6)]
    cybar, shot, barkeeper, lp1, lp2, lp3= prepare_contracts

    with brownie.reverts("dev: wut?"):
        barkeeper.dev(bob, {'from': bob})
     



















