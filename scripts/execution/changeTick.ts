const hre = require("hardhat");
const { ethers } = hre;
const path = require("path");
import {ISwapRouter, IUniswapV3Pool, IUniswapV3Factory, MockToken} from "../../typechain";
import ISwapRouterArtifacts from "../../artifacts/contracts/interfaces/IUniSwapV3Router.sol/ISwapRouter.json";
import IUniswapV3FactoryArtifacts from "../../artifacts/@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json";
import MockTokenArtifacts from "../../artifacts/contracts/mocks/MockToken.sol/MockToken.json";
import { Address } from "cluster";
import { BigNumber } from "ethers";
import fs from "fs";



async function main() {
    const configPath = path.join(__dirname, "./config.json")
    const config = require(configPath)
    const desiredTick: number = config.desiredTick;
    const fee: number = config.poolFee;
    let tokenToSwapAddress: Address["address"] = config.token0;
    let tokenToReceiveAddress: Address["address"] = config.token1;
    let tokenStepToSwap: BigNumber = BigNumber.from(1000).mul(18);

    const [deployer] = await ethers.getSigners();
    // Deployed contract address saving functionality
    // Path for saving of addresses of deployed contracts
    // The function to save an address of a deployed contract to the specified file and to output to console
    const router = (
        await ethers.getContractAt(
            ISwapRouterArtifacts.abi, 
            "0xE592427A0AEce92De3Edee1F18E0157C05861564")
    ) as ISwapRouter;
    const factory = await ethers.getContractAt(
        IUniswapV3FactoryArtifacts.abi, 
        "0x1F98431c8aD98523631AE4a59f267346ea31F984"
    ) as IUniswapV3Factory;
    const pool = await ethers.getContractAt(
        'IUniswapV3Pool', 
        await factory.getPool(
            tokenToSwapAddress, 
            tokenToReceiveAddress, 
            fee)
    ) as IUniswapV3Pool;
    console.log('begin swap')
    swap(tokenToSwapAddress, tokenToReceiveAddress);
    async function swap(tokenToSwapAddress: string, tokenToReceiveAddress: string) {
        const tokenToSwap = (
            await ethers.getContractAt(
                MockTokenArtifacts.abi, 
                tokenToSwapAddress
            )
        ) as MockToken;
        const tokenToReceive = (
            await ethers.getContractAt(
                MockTokenArtifacts.abi, 
                tokenToReceiveAddress
            )
        ) as MockToken;
        const maxUint256 = BigNumber.from(2).pow(256).sub(1);
        let currentTick = (await pool.slot0()).tick;
        if(!(await tokenToSwap.allowance(deployer.address, router.address)).eq(maxUint256)) {
            let approveTx = await tokenToSwap.connect(deployer).approve(router.address, maxUint256);
            await approveTx.wait()
        }
        const increseTick = desiredTick >= currentTick? true : false;
        let percentage = currentTick / desiredTick * 100;
        while(increseTick?
            currentTick <= desiredTick:
            currentTick >= desiredTick
        ){
            currentTick = (await pool.slot0()).tick;
            let new_percentage = currentTick / desiredTick * 100;
            if(new_percentage - percentage <= 0.1){
                tokenStepToSwap = tokenStepToSwap.mul(10000);
            } else if (new_percentage - percentage <= 4){
                tokenStepToSwap = tokenStepToSwap.mul(5000);
            }
            const amountToSwap = tokenStepToSwap;
            if((await tokenToSwap.connect(deployer).balanceOf(deployer.address)).lt(amountToSwap)){
                const mintTx = await tokenToSwap.mint(amountToSwap);
                await mintTx.wait();
            }
            console.log('swap')
            let swapTx1 = await router.connect(deployer).exactInputSingle(
                {
                    tokenIn: tokenToSwapAddress, 
                    tokenOut: tokenToReceiveAddress, 
                    fee: fee, 
                    recipient: deployer.address, 
                    deadline: 1e10, 
                    amountIn: tokenToSwapAddress.toLowerCase() == (await router.WETH9()).toLowerCase()? 
                    ethers.utils.parseEther(tokenStepToSwap)
                        :
                    amountToSwap, 
                    amountOutMinimum: 0, 
                    sqrtPriceLimitX96: 0
                },
                {
                    value: tokenToSwapAddress.toLowerCase() == (await router.WETH9()).toLowerCase()? 
                        ethers.utils.parseEther(tokenStepToSwap)
                            :
                        undefined
                }
            )
            await swapTx1.wait();
            console.log(
                "Current tick", 
                (await pool.slot0()).tick
            )
            // console.log("Tick progress", BigNumber.from(increseTick? (await pool.slot0()).tick / desiredTick * 100 : desiredTick / (await pool.slot0()).tick * 100), "%\n")
            if(
                increseTick? (await pool.slot0()).tick < currentTick
                : (await pool.slot0()).tick > currentTick){
                    tokenStepToSwap = BigNumber.from(1000).mul(18);
                    await swap(tokenToReceiveAddress, tokenToSwapAddress);
                    return;
            }
            currentTick = (await pool.slot0()).tick;
        }
    }
}

// This pattern is recommended to be able to use async/await everywhere and properly handle errors
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
