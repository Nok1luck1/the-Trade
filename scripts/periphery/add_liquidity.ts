import { ethers, waffle } from "hardhat"
import chai, { expect } from "chai";
import RocketDexArtifacts from "../artifacts/contracts/RocketDex.sol/RocketDex.json";
import ISwapRouterArtifacts from "../artifacts/contracts/interfaces/IUniSwapV3Router.sol/ISwapRouter.json";
import IWETH9Artifacts from "../artifacts/contracts/interfaces/IWETH9.sol/IWETH9.json";
import MockTokenArtifacts from "../artifacts/contracts/mocks/MockToken.sol/MockToken.json";
import IERC20Artifacts from "../artifacts/contracts/interfaces/IERC20.sol/IERC20.json";
import IUniswapV3FactoryArtifacts from "../artifacts/@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json";
import MinterArtifacts from "../artifacts/contracts/mocks/Minter.sol/Minter.json";
import { nearestUsableTick, Pool, priceToClosestTick,  } from "@uniswap/v3-sdk";                            
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { RocketDex, ISwapRouter, IWETH9, IERC20, IUniswapV3Pool, IUniswapV3Factory, Minter, MockToken} from "../typechain";
import { Address } from "cluster";
import timeMachine from "ganache-time-traveler";
import { JsonRpcSigner } from "@ethersproject/providers";
require("dotenv").config();
import { BigNumber } from "bignumber.js";


const minterAddress = "0x5712736Cda9753425176dE19b938E16F0019e546";
const poolAddress = "0x96874836c4ae8e5F1206c0a521DABf52140543Af";
const amountOfLiquidity = 2078382864014;
async function main() {
  const network: string = (await ethers.provider.getNetwork()).name;
  if (network != "rinkeby") {
      console.log('Network must be rinkeby. Current network -', network);
      return 0;
  }

  const pool = await ethers.getContractAt('IUniswapV3Pool', poolAddress) as IUniswapV3Pool;
  
  const fee = await pool.fee();

  const signers = await ethers.getSigners();
  const contractDeployer = signers[0];  
  const minter = (await ethers.getContractAt(MinterArtifacts.abi, minterAddress)) as Minter;

  const token0 = (await ethers.getContractAt(MockTokenArtifacts.abi, (await pool.token0()))) as MockToken;  
  const token1 = (await ethers.getContractAt(MockTokenArtifacts.abi, (await pool.token1()))) as MockToken;  
  
  // if(await token0.decimals() == 8)
  //   await (await pool.initialize(encodePriceSqrt(296972787829, 1496858848).toFixed())).wait(); 
  // else 
  //   await (await pool.initialize(encodePriceSqrt(1496858848, 296972787829).toFixed())).wait(); 

  // await (await token0.connect(contractDeployer).mint(new BigNumber(29274768).multipliedBy(new BigNumber(10).exponentiatedBy(await token0.decimals())).toFixed())).wait();
  // await (await token1.connect(contractDeployer).mint(new BigNumber(1476).multipliedBy(new BigNumber(10).exponentiatedBy(await token1.decimals())).toFixed())).wait();
  await (await token0.connect(contractDeployer).mint(new BigNumber(ethers.utils.parseEther("1000").toString()).toFixed())).wait();
  await (await token1.connect(contractDeployer).mint(new BigNumber(ethers.utils.parseEther("1000").toString()).toFixed())).wait();
  await (await token0.connect(contractDeployer).approve(minter.address, ethers.utils.parseEther("100000"))).wait();
  await (await token1.connect(contractDeployer).approve(minter.address, ethers.utils.parseEther("100000"))).wait();

  let mintTx = await minter.mint(
    {
        pool: pool.address,
        token0: await pool.token0(),
        token1: await pool.token1(),
        fee: fee,
        recipient: contractDeployer.address,
                //  887272
        tickLower: -887220,
        tickUpper: 887220,
        amount: amountOfLiquidity
    }
  );

  await mintTx.wait();
}

// This pattern is recommended to be able to use async/await everywhere and properly handle errors
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});