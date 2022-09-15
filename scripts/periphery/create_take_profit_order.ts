import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Controller, ISwapRouter, IWETH9, IERC20, IUniswapV3Pool, INonfungiblePositionManager} from "../typechain";
import { Address } from "cluster";
import { BigNumber } from "ethers";
import RocketDexArtifacts from "../artifacts/contracts/Controller.sol/Controller.json";
import ISwapRouterArtifacts from "../artifacts/contracts/interfaces/IUniSwapV3Router.sol/ISwapRouter.json";
import INonfungiblePositionManagerArtifacts from "../artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json";
import IWETH9Artifacts from "../artifacts/contracts/interfaces/IWETH9.sol/IWETH9.json";
import IERC20Artifacts from "../artifacts/contracts/interfaces/IERC20.sol/IERC20.json";                            
import { nearestUsableTick } from "@uniswap/v3-sdk";

async function main() {
    const rocketDexProxyAddress = '0x1EC5347B1eB0E6657BD2cf3250C483B9A22aDcD0';
    let rocketDexInstance = (await ethers.getContractAt(RocketDexArtifacts.abi, rocketDexProxyAddress)) as Controller; 
    let contractDeployer: SignerWithAddress; 
    let nftPositionManager: INonfungiblePositionManager;
    let weth: IWETH9;
    let wbtc: IERC20;
    let usdc: IERC20;
    let user1: SignerWithAddress; 
    let router: ISwapRouter;
    let uniV3Factory: Address["address"] = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const nftPositionManagerAddress: Address["address"] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    /// token1.
    const usdcAddress: Address["address"] = "0xd84afd9368fe8f7aa8df3ae47426001bbcd96de2";
    /// token0.
    const wbtcAddress: Address["address"] = "0x8b0375aa6f8dd47b7de3c18ad4f2e34efb198177";
    const wethAddress: Address["address"] = "0xc778417E063141139Fce010982780140Aa0cD5Ab";
    
    const network: string = (await ethers.provider.getNetwork()).name;
    
    if (network != "rinkeby") {
        console.log('Network must be rinkeby. Current network -', network);
        return 0;
    }
    
    const signers = await ethers.getSigners()
    contractDeployer = signers[0];
    user1 = signers[1];
    // Swap ETH for WETH.
    weth = (await ethers.getContractAt(IWETH9Artifacts.abi, wethAddress)) as IWETH9;
    wbtc = (await ethers.getContractAt(IERC20Artifacts.abi, wbtcAddress)) as IERC20;
    usdc = (await ethers.getContractAt(IERC20Artifacts.abi, usdcAddress)) as IERC20;
    nftPositionManager = (await ethers.getContractAt(INonfungiblePositionManagerArtifacts.abi, nftPositionManagerAddress)) as INonfungiblePositionManager;

    // Send ETH.
    // await contractDeployer.sendTransaction({
    //     to: user1.address,
    //     value: ethers.utils.parseEther("0.5")
    // });
    // console.log(await user1.getBalance());
    router = (
        await ethers.getContractAt(
            ISwapRouterArtifacts.abi, 
            "0xE592427A0AEce92De3Edee1F18E0157C05861564")
    ) as ISwapRouter;
    // console.log('swap')
    // let swapTx1 = await router.connect(user1).exactInputSingle(
    //     {
    //         tokenIn: wethAddress, 
    //         tokenOut: wbtcAddress, 
    //         fee: 3000, 
    //         recipient: user1.address, 
    //         deadline: 1e10, 
    //         amountIn: ethers.utils.parseEther("0.1"), 
    //         amountOutMinimum: 0, 
    //         sqrtPriceLimitX96: 0
    //     },
    //     {
    //         value: ethers.utils.parseEther("0.1") 
    //     }
    // );
    // await swapTx1.wait();
    
    const pool = await ethers.getContractAt(
        'IUniswapV3Pool', 
        '0x0d71Af363cEA4fE3E0b431F9b85F2C5255c29B87'
    ) as IUniswapV3Pool;
    const slot0 = await pool.slot0(); 
    let tikcSpacing: number = await pool.tickSpacing();
    let tick: number = slot0.tick + tikcSpacing * 2;

    let daiBalance: BigNumber = (await wbtc.balanceOf(user1.address)).div(2);

    let approveTx = await wbtc.connect(user1).approve(
        rocketDexInstance.address, daiBalance);
    await approveTx.wait();
    console.log(daiBalance, '- token0 balance');
    console.log('send tx')
    tick =  nearestUsableTick(tick, BigNumber.from(tikcSpacing).toNumber())
    console.log(slot0.tick, '- pool tick')
    console.log(tick, '- tick')
    let recievedAmountOfToken1 = await rocketDexInstance.connect(
        user1).getAmount1FromAmount0(daiBalance, tick, tick + tikcSpacing);
    let createTradeTx = await rocketDexInstance.connect(user1).createOrder(
        {
            fee: 500,
            token0: wbtcAddress,
            token1: usdcAddress,
            tickLower: tick,
            tickUpper: 0,
            amountOfToken0: daiBalance,
            amountOfToken1: 0,
            recievedAmountOfToken0: 0,
            recievedAmountOfToken1: recievedAmountOfToken1,
            deadline: 2e10,
            orderType: 0
        },
        {
            value: ethers.utils.parseEther("0.003")
        }
    );
    await createTradeTx.wait();

    console.log('create order complete!')
}

// This pattern is recommended to be able to use async/await everywhere and properly handle errors
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});