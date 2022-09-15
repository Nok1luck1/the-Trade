import hre from "hardhat";
import path from "path";
const { ethers } = hre;
const { getAddressSaver } = require("./deployment/utilities/helpers");
// to verify:
// $ truffle compile
// $ truffle run verify MockToken@0x8aE5dfb3577BDbd77aCC0ecAb5249Ac13FaE582e --forceConstructorArgs string:000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000855534420636f696e00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000045553444300000000000000000000000000000000000000000000000000000000 --network rinkeby 
const name: string = "Blaize Token";
const symbol: string = "BLZ";
const decimals: number = 8;
async function main() {
    const [deployer] = await ethers.getSigners();
    const network = (await ethers.getDefaultProvider().getNetwork()).name; // Getting of the current network
    const addressesPath = path.join(__dirname, "./deployment/deploymentAddresses.json");
    const saveAddress = getAddressSaver(addressesPath, network, true);

    const MockToken = (await ethers.getContractFactory("MockToken")).connect(deployer);
    const token = await MockToken.deploy(name, symbol, decimals);
    await token.deployed();

    saveAddress(await token.symbol(), token.address);

    console.log("Deployment is completed.");
    await token.grantRole(await token.DEFAULT_ADMIN_ROLE(), "0xdFD9ce31EA6E831304777dF4A0f759E7A30C2561")
    await token.grantRole(await token.DEFAULT_ADMIN_ROLE(), "0x6Ad3EE993836F4705a2A2e64c5Fa96Cac14D7E73")

}

main().catch((error) => {
 console.error(error);
 process.exitCode = 1;
});