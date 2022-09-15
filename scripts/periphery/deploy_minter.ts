import hre from "hardhat";
import path from "path";
const { ethers } = hre;
const { verify, getAddressSaver } = require("./deployment/utilities/helpers");

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = (await ethers.getDefaultProvider().getNetwork()).name; // Getting of the current network
    const addressesPath = path.join(__dirname, "./deployment/deploymentAddresses.json");
    const saveAddress = getAddressSaver(addressesPath, network, true);

    const Minter = (await ethers.getContractFactory("Minter")).connect(deployer);
    const minter = await Minter.deploy();
    await minter.deployed();

    saveAddress("Minter", minter.address);

    console.log("Deployment is completed.");
}

main().catch((error) => {
 console.error(error);
 process.exitCode = 1;
});