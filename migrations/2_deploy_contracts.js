const CybarToken = artifacts.require("CybarToken");
const ShotBar = artifacts.require("ShotBar");
const MasterBarkeeper = artifacts.require("MasterBarkeeper");

const Web3 = require('Web3');

module.exports = async function(deployer, network, accounts) {
    let initialAmount, devAddress, treasuryAddress, startBlock, cybarPerBlock;
    if( network == "development") {
        initialAmount = 35*10**6;
        devAddress = accounts[1];
        treasuryAddress = accounts[2];
        startBlock = 100;
        cybarPerBlock = 40;
    } else if (network == "fantomTestnet"){
        initialAmount = 35*10**6;
        devAddress = "0xf469818b50D0d7aFC2dd29050a3d5dc87C645438";
        treasuryAddress = devAddress;
        startBlock = 5067914;
        cybarPerBlock = 40;
    }

    await deployer.deploy(CybarToken);
    const cybarToken = await CybarToken.deployed();
    await cybarToken.mint(initialAmount);
    const cybarAddress = cybarToken["address"];
    console.log(cybarAddress);

    await deployer.deploy(ShotBar, cybarAddress);
    const shotBar = await ShotBar.deployed();
    const shotBarAddress = shotBar["address"];
    console.log(shotBarAddress);

    await deployer.deploy(MasterBarkeeper, cybarAddress, shotBarAddress, devAddress, treasuryAddress, cybarPerBlock, startBlock);
    const masterBarkeeper = await MasterBarkeeper.deployed();
    await cybarToken.transferOwnership(masterBarkeeper.address);
    await shotBar.transferOwnership(masterBarkeeper.address);
};

