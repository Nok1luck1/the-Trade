import { ethers, waffle } from "hardhat"
import { expect } from "chai";
import LimitOrdersControllerArtifacts from "../../artifacts/contracts/Controller.sol/LimitOrdersController.json";
import ISwapRouterArtifacts from "../../artifacts/contracts/interfaces/IUniSwapV3Router.sol/ISwapRouter.json";
import IWETH9Artifacts from "../../artifacts/contracts/interfaces/IWETH9.sol/IWETH9.json";
import IERC20Artifacts from "../../artifacts/contracts/interfaces/IERC20.sol/IERC20.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { LimitOrdersController, ISwapRouter, IWETH9, IERC20, IUniswapV3Pool} from "../../typechain";
import { Address } from "cluster";
import { BigNumber } from "bignumber.js";
import timeMachine from "ganache-time-traveler";

const { deployContract } = waffle;

describe("The Trade", async() => {
    let rocketDexInstance: LimitOrdersController
    let contractDeployer: SignerWithAddress; 
    let weth: IWETH9;
    let usdc: IERC20;
    let dai: IERC20;
    let btc: IERC20;
    let user1: SignerWithAddress; 
    let router: ISwapRouter;
    const executionFee: BigNumber = new BigNumber((ethers.utils.parseEther("0")).toString());
    const uniV3FactoryAddress: Address["address"] = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const uniV3NftAddress: Address["address"] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    const nftPositionManagerAddress: Address["address"] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    const wbtcAddress: Address["address"] = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    const daiAddress: Address["address"] = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    const usdcAddress: Address["address"] = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const wethAddress: Address["address"] = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const btcAddress: Address["address"] = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    const dai_weth_poolAddress: Address["address"] = "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8";
    const btc_weth_poolAddress: Address["address"] = "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD";
    let snapshot : string;
    before(async () => {
        let snapshotRaw = await timeMachine.takeSnapshot()
        snapshot = snapshotRaw.id.toString();
        const signers = await ethers.getSigners()
        contractDeployer = signers[0];
        user1 = signers[1];
        rocketDexInstance = (await deployContract(signers[0], LimitOrdersControllerArtifacts)) as LimitOrdersController; 
        weth = (await ethers.getContractAt(IWETH9Artifacts.abi, wethAddress)) as IWETH9;
        usdc = (await ethers.getContractAt(IERC20Artifacts.abi, usdcAddress)) as IERC20;
        dai = (await ethers.getContractAt(IERC20Artifacts.abi, daiAddress)) as IERC20;
        btc = (await ethers.getContractAt(IERC20Artifacts.abi, btcAddress)) as IERC20;
        let wrapEthTx = await weth.connect(user1).deposit({'value': ethers.utils.parseEther("2")});
        await wrapEthTx.wait();

        router = (await ethers.getContractAt(ISwapRouterArtifacts.abi, "0xE592427A0AEce92De3Edee1F18E0157C05861564")) as ISwapRouter;
        let swapTx = await router.connect(user1).exactInputSingle(
            {
                tokenIn: wethAddress, 
                tokenOut: usdcAddress, 
                fee: 3000, 
                recipient: user1.address, 
                deadline: 1e10, 
                amountIn: ethers.utils.parseEther("1"), 
                amountOutMinimum: 0, 
                sqrtPriceLimitX96: 0
            },
            {
                value: ethers.utils.parseEther("1")
            }
        );
        await swapTx.wait();
    });
    after(async () => {
        await timeMachine.revertToSnapshot(snapshot);
    });
    describe("Initialization", async() => {
        it("Initialize contract", async() => {
            let nftPositionManager: Address["address"] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
            let uniV3Factory: Address["address"] = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
            let tx = await rocketDexInstance.initialize(
                nftPositionManagerAddress, 
                uniV3FactoryAddress,
                wethAddress,
                uniV3NftAddress,
                executionFee.toFixed()
                );
            await tx.wait();
            
            let actualPostionManager: Address["address"] = await rocketDexInstance.nftPositionManager();
            expect(actualPostionManager.toLowerCase()).equal(nftPositionManager.toLowerCase());
            let actualUniV3Factory: Address["address"] = await rocketDexInstance.uniswapV3Factory();
            expect(actualUniV3Factory.toLowerCase()).equal(uniV3Factory.toLowerCase())
        });
    });

    describe("Sweep", async() => {
        it("Create position to genereate tokens for sweep, transfer if not", async () => {
            const pool = await ethers.getContractAt('IUniswapV3Pool', "0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168") as IUniswapV3Pool;
            const slot0 = await pool.slot0(); 
            let tickSpacing: number = await pool.tickSpacing();
            const tick: number = slot0.tick - tickSpacing;
            let balance: BigNumber = new BigNumber((await usdc.balanceOf(user1.address))._hex);
            
            let approveTx = await usdc.connect(user1).approve(rocketDexInstance.address, balance.toFixed());
            await approveTx.wait();
            let createTradeTx = await rocketDexInstance.connect(user1).createOrder(
                {
                    fee: 100,
                    token0: daiAddress,
                    token1: usdcAddress,
                    tickLower: 0,
                    tickUpper: tick,
                    amountOfToken0: 0,
                    amountOfToken1: new BigNumber(balance).minus(1e6).toFixed(),
                    recievedAmountOfToken0: 1,
                    recievedAmountOfToken1: 0, 
                    deadline: 1e10,
                    orderType: 1
                }
            );
            await createTradeTx.wait();
            await timeMachine.advanceBlock()
            if(new BigNumber((await usdc.balanceOf(rocketDexInstance.address)).toString()).isGreaterThan(0))
                expect(new BigNumber((await usdc.balanceOf(rocketDexInstance.address)).toString()).isGreaterThan(0));
            else
                await (await (usdc.connect(user1).transfer(rocketDexInstance.address, 1e6))).wait()
        });

        it("Sweep tokens", async () => {
            let balanceBefore: BigNumber = new BigNumber((await usdc.balanceOf(user1.address))._hex);
            let sweepTx = await rocketDexInstance.connect(contractDeployer).sweepTokens(usdc.address, user1.address, await usdc.balanceOf(rocketDexInstance.address))
            await sweepTx.wait();
            await timeMachine.advanceBlock()
            let balanceAfter: BigNumber = new BigNumber((await usdc.balanceOf(user1.address))._hex);
            expect(new BigNumber((balanceAfter).toString()).isGreaterThan(balanceBefore));
        });

        it("Sweep position nft", async() => {
            await expect(rocketDexInstance.connect(contractDeployer).sweepTokens("0xC36442b4a4522E871399CD717aBDD847Ab11FE88", user1.address, ethers.utils.parseEther("1"))
                ).to.be.revertedWith("SWET1"); 
        });
    });
});