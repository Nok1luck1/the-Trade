import { ethers, waffle } from "hardhat";
import LimitOrdersControllerArtifacts from "../../artifacts/contracts/Controller.sol/LimitOrdersController.json";
import ISwapRouterArtifacts from "../../artifacts/contracts/interfaces/IUniSwapV3Router.sol/ISwapRouter.json";
import IWETH9Artifacts from "../../artifacts/contracts/interfaces/IWETH9.sol/IWETH9.json";
import MockTokenArtifacts from "../../artifacts/contracts/mocks/MockToken.sol/MockToken.json";
import IERC20Artifacts from "../../artifacts/contracts/interfaces/IERC20.sol/IERC20.json";
import IUniswapV3FactoryArtifacts from "../../artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json";
import MinterArtifacts from "../../artifacts/contracts/mocks/Minter.sol/Minter.json";
import { nearestUsableTick } from "@uniswap/v3-sdk";                            
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { LimitOrdersController, ISwapRouter, IWETH9, IERC20, IUniswapV3Pool, IUniswapV3Factory, Minter, MockToken} from "../../typechain";
import { Address } from "cluster";
import { BigNumber } from "bignumber.js";
import timeMachine from "ganache-time-traveler";
require("dotenv").config();

const { deployContract } = waffle;
import { BigNumberish } from 'ethers'
import bn from 'bignumber.js'

function encodePriceSqrt(reserve1: BigNumberish, reserve0: BigNumberish): BigNumber {
    return new BigNumber(
      new bn(reserve1.toString())
        .div(reserve0.toString())
        .sqrt()
        .multipliedBy(new bn(2).pow(96).toFixed())
        .integerValue(3)
        .toFixed()
    )
  }
describe("Pool management", async() => {
    let fee: number = 3000;
    const swapStep = 50;
    let rocketDexInstance: LimitOrdersController
    let uniV3Factory: IUniswapV3Factory;
    let contractDeployer: SignerWithAddress; 
    let weth: IWETH9;
    let usdc: IERC20;
    let token0: MockToken;
    let token1: MockToken;
    let dai: IERC20;
    let btc: IERC20;
    let user1: SignerWithAddress; 
    let router: ISwapRouter;
    const executionFee: BigNumber = new BigNumber((ethers.utils.parseEther("0")).toString());
    const uniV3FactoryAddress: Address["address"] = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const uniV3NftAddress: Address["address"] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    const nftPositionManagerAddress: Address["address"] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    const daiAddress: Address["address"] = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    const usdcAddress: Address["address"] = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const wethAddress: Address["address"] = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const btcAddress: Address["address"] = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    let minter: Minter; 
    let pool: IUniswapV3Pool;
    let snapshot : string;
    before(async () => {
        let snapshotRaw = await timeMachine.takeSnapshot()
        snapshot = snapshotRaw.id.toString();
        const signers = await ethers.getSigners()
        contractDeployer = signers[0];
        user1 = signers[1]
        
        minter = (await deployContract(signers[0], MinterArtifacts)) as Minter;  
        token0 = (await deployContract(signers[0], MockTokenArtifacts, ["Wrapped BTC", "BTC", 8])) as MockToken;  
        token1 = (await deployContract(signers[0], MockTokenArtifacts, ["USD COIN", "USDC", 6])) as MockToken;  

        // Swap ETH for WETH.
        weth = (await ethers.getContractAt(IWETH9Artifacts.abi, wethAddress)) as IWETH9;
        usdc = (await ethers.getContractAt(IERC20Artifacts.abi, usdcAddress)) as IERC20;
        dai = (await ethers.getContractAt(IERC20Artifacts.abi, daiAddress)) as IERC20;
        btc = (await ethers.getContractAt(IERC20Artifacts.abi, btcAddress)) as IERC20;
        router = (await ethers.getContractAt(ISwapRouterArtifacts.abi, "0xE592427A0AEce92De3Edee1F18E0157C05861564")) as ISwapRouter;
        uniV3Factory = (await ethers.getContractAt(IUniswapV3FactoryArtifacts.abi, uniV3FactoryAddress)) as IUniswapV3Factory;
        let createPoolTx = await uniV3Factory.createPool(token0.address, token1.address, fee);
        await createPoolTx.wait();
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0.address,
            token1.address,
            fee
        );
        pool = await ethers.getContractAt('IUniswapV3Pool', poolAddress) as IUniswapV3Pool;
        if((await pool.token0()).toLowerCase() != token0.address.toLowerCase()){
            let tk = token0;
            token0 = token1;
            token1 = tk;
        }
        
        rocketDexInstance = (await deployContract(signers[0], LimitOrdersControllerArtifacts)) as LimitOrdersController; 
        if(await token0.decimals() == 8)
            await (await pool.initialize(encodePriceSqrt(296972787829, 1496858848).toFixed())).wait(); 
        else 
            await (await pool.initialize(encodePriceSqrt(1496858848, 296972787829).toFixed())).wait(); 
         
        await (await token0.mintFor(user1.address, ethers.utils.parseEther("100000"))).wait();
        await (await token1.mintFor(user1.address, ethers.utils.parseEther("100000"))).wait();
    });
    after(async () => {
        await timeMachine.revertToSnapshot(snapshot)
    })
    describe("Liquidity manipulations", async() => {
        it("Liquidity manipulations", async() => {
            ["0x101c6dCE02ABe4AaF6dD26021881BE1D2f702394", "0x400c206db9325509a183eba192fd2228bc3eb1fa", "0x9beb54320420da7e3346ba6b7c49b0131cfc1eab", 3000, "0x2ca935e866AC764F563344D7be6f0D0c9253d796", -23160, 23160, "123123000000000000000"]
            await (await token0.mint(ethers.utils.parseEther("100000"))).wait();
            await (await token1.mint(ethers.utils.parseEther("100000"))).wait();
            await (await token0.approve(minter.address, ethers.utils.parseEther("100000"))).wait();
            await (await token1.approve(minter.address, ethers.utils.parseEther("100000"))).wait();

            let testTx = await minter.mint(
                {
                    pool: pool.address,
                    token0: await pool.token0(),
                    token1: await pool.token1(),
                    fee: fee,
                    recipient: contractDeployer.address,
                            //  887272
                    tickLower: -887220,
                    tickUpper: 887220,
                    amount: "2078382864657567014"
                }
            )
            await testTx.wait();
            
            let tx = await rocketDexInstance.initialize(
                nftPositionManagerAddress, 
                uniV3FactoryAddress,
                wethAddress,
                uniV3NftAddress,
                executionFee.toFixed()
            );
            await tx.wait();
            const slot0 = await pool.slot0(); 
            let tickSpacing: number = await pool.tickSpacing();
            const tick: number = slot0.tick + tickSpacing;
            let usableTick = nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber());
            await (await token0.connect(user1).approve(rocketDexInstance.address, ethers.utils.parseEther("1"))).wait();
            let createTradeTx = await rocketDexInstance.connect(user1).createOrder(
                {
                    fee: 3000,
                    token0: await pool.token0(),
                    token1: await pool.token1(),
                    tickLower: nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()),
                    tickUpper: 0,
                    amountOfToken0: ethers.utils.parseEther("1"),
                    amountOfToken1: 0,
                    recievedAmountOfToken0: 0,
                    recievedAmountOfToken1: await rocketDexInstance.getAmount1FromAmount0(ethers.utils.parseEther("1"), usableTick, usableTick + tickSpacing),
                    deadline: 1e10,
                    orderType: 0
                },
                {
                    value: executionFee.toFixed()
                }
            );
            await createTradeTx.wait();
            let filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let tokenId = (await rocketDexInstance.queryFilter(filter))[0].args.tokenId.toNumber();
            
            let checkResult = await rocketDexInstance.checkOrder(tokenId, pool.address);
            let i = 0;
            while(!checkResult.isClosable){
                i++;
                let toSwap: string = new BigNumber(checkResult.baseAmount.toString()).multipliedBy(swapStep).toFixed();
                await (await token1.connect(contractDeployer).mintFor(user1.address, toSwap)).wait();
                await (await token1.connect(user1).approve(router.address, toSwap)).wait();
                let swapTx1 = await router.connect(user1).exactInputSingle(
                    {
                        tokenIn: token1.address, 
                        tokenOut: token0.address, 
                        fee: fee, 
                        recipient: user1.address, 
                        deadline: 1e10, 
                        amountIn: toSwap, 
                        amountOutMinimum: 0, 
                        sqrtPriceLimitX96: 0
                    },
                );
                await swapTx1.wait();
                await timeMachine.advanceBlock()
                checkResult = await rocketDexInstance.checkOrder(tokenId, pool.address);
            }
            await timeMachine.advanceBlock()
            let closeTx = await rocketDexInstance.executeOrder(tokenId, pool.address)
            await closeTx.wait(); 

            const slot02 = await pool.slot0(); 
            tickSpacing = await pool.tickSpacing();
            const tick2: number = slot02.tick - tickSpacing;


            usableTick = nearestUsableTick(tick2, new BigNumber(tickSpacing).toNumber());

            const filter2 = rocketDexInstance.filters.CreateOrder(user1.address);
            await (await token1.connect(user1).approve(rocketDexInstance.address, ethers.utils.parseEther("100"))).wait();
            let createTradeTx2 = await rocketDexInstance.connect(user1).createOrder(
                {
                    fee: fee,
                    token0: await pool.token0(),
                    token1: await pool.token1(),
                    tickLower: 0,
                    tickUpper: usableTick,
                    amountOfToken0: 0,
                    amountOfToken1: ethers.utils.parseEther("100"),
                    recievedAmountOfToken0: (await rocketDexInstance.getAmount0FromAmount1(ethers.utils.parseEther("1"), usableTick - tickSpacing, usableTick)).mul(100).div(95),
                    recievedAmountOfToken1: 0,
                    deadline: 2e10,
                    orderType: 1
                },
                {
                    value: executionFee.toFixed()
                }
            );
            await createTradeTx2.wait();
            // Get order id.
            await timeMachine.advanceBlock();
            let tokenId2 = (await rocketDexInstance.queryFilter(filter2))[1].args.tokenId.toNumber();
            
            let checkResult2 = await rocketDexInstance.checkOrder(tokenId2, pool.address);
            i = 0;
            while(!checkResult2.isClosable){
                i++;
                let toSwap: string = new BigNumber(checkResult2.baseAmount.toString()).multipliedBy(swapStep).toFixed();
                await (await token0.connect(contractDeployer).mintFor(user1.address, toSwap)).wait();
                await (await token0.connect(user1).approve(router.address, toSwap)).wait();
                let swapTx1 = await router.connect(user1).exactInputSingle(
                    {
                        tokenIn: token0.address, 
                        tokenOut: token1.address, 
                        fee: fee, 
                        recipient: user1.address, 
                        deadline: 1e10, 
                        amountIn: toSwap, 
                        amountOutMinimum: 0, 
                        sqrtPriceLimitX96: 0
                    },
                );
                await swapTx1.wait();
                await timeMachine.advanceBlock()
                checkResult2 = await rocketDexInstance.checkOrder(tokenId2, pool.address);
            }
            await timeMachine.advanceBlock()
            let closeTx2 = await rocketDexInstance.executeOrder(tokenId2, pool.address)
            await closeTx2.wait(); 
        });
    });
});