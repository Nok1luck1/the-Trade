// This is a script for deployment and automatically verification of the `contracts/Controller.sol`

const hre = require("hardhat");
const { ethers } = hre;
const { verify, getAddressSaver } = require("../utilities/helpers");
const path = require("path");

async function main() {
    /*
     * Hardhat always runs the compile task when running scripts with its command line interface.
     *
     * If this script is run directly using `node` you may want to call compile manually
     * to make sure everything is compiled.
     */
    // await hre.run("compile");

    const [deployer] = await ethers.getSigners();

    // Deployed contract address saving functionality
    const network = (await ethers.getDefaultProvider().getNetwork()).name; // Getting of the current network
    // Path for saving of addresses of deployed contracts
    const addressesPath = path.join(__dirname, "../deploymentAddresses.json");
    // The function to save an address of a deployed contract to the specified file and to output to console
    const saveAddress = getAddressSaver(addressesPath, network, true);

    // Get proxy address.
    // const data = require("../deploymentAddresses.json");
    // const ControllerProxyAddress = data["homestead"]["new"]["Controller"];
    const ControllerProxyAddress = "0xE440423A6a0e4C45d1665cAbCc4bFBbc75823654";
    // Deployment
    console.log("Upgarade ...");
    const ControllerInstance = (await ethers.getContractFactory("Controller")).connect(deployer);
    const ControllerImpl = await upgrades.upgradeProxy(ControllerProxyAddress, ControllerInstance);
    console.log("Upgrade is completed.");
    console.log(ControllerImpl, "- impl address");
    const currentImplAddress = await upgrades.erc1967.getImplementationAddress(ControllerProxy);

    // Saving of an address of the deployed contract to the file
    saveAddress("ControllerImpl", currentImplAddress);
    console.log("Verification...");
    // // Verification of the deployed contract
    await verify(currentImplAddress); // The contract address and constructor arguments used in the deployment
}

// This pattern is recommended to be able to use async/await everywhere and properly handle errors
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
