//npx hardhat run scripts/deploy.js --network nameOfNetwork

const { ethers, upgrades } = require('hardhat')
const hre = require('hardhat');


//const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7' mainnet
//const Owner ='0x3f4F5d9971c265a7485540207023EA4B68Af6dc6'
const main = async () => {
    async function verify(address, args) {
    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        let retry = 20;
        console.log("Sleeping before verification...");
        while ((await ethers.provider.getCode(address).catch(() => "")).length <= 3 && retry >= 0) {
            --retry;
        }
        console.log(address, args);

        await hre
            .run("verify:verify", {
                address,
                constructorArguments: args
            })
            // .catch(console.error);
            .catch(() => console.log("Verification failed"));
         console.log("Verification is completed")
    }
}

    const [deployer] = await ethers.getSigners()
    console.log(`Deployer address: ${deployer.address}`)
    const Controller = await ethers.getContractFactory('Controller')
    const initValue = [
        "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
        "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
        ethers.utils.parseEther("0.003")
    ];
    const controller = await upgrades.deployProxy(Controller,initValue,{ initializer: "initialize", kind: "uups" })
    await controller.deployed();
    console.log(`Controller address : ${controller.address}`)
    await verify(controller.address)


 
}


   

// This pattern is recommended to be able to use async/await everywhere and properly handle errors
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

