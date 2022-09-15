import { ethers, waffle } from "hardhat"
import { expect } from "chai";
import LimitOrdersControllerArtifacts from "../../artifacts/contracts/Controller.sol/LimitOrdersController.json";
import ISwapRouterArtifacts from "../../artifacts/contracts/interfaces/IUniSwapV3Router.sol/ISwapRouter.json";
import IWETH9Artifacts from "../../artifacts/contracts/interfaces/IWETH9.sol/IWETH9.json";
import IERC20Artifacts from "../../artifacts/contracts/interfaces/IERC20.sol/IERC20.json";
import IUniswapV3FactoryArtifacts from "../../artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json";
import INonfungiblePositionManagerArtifacts from "../../artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json";
import { nearestUsableTick, priceToClosestTick,  } from "@uniswap/v3-sdk";                            
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { LimitOrdersController, ISwapRouter, IWETH9, IERC20, IUniswapV3Pool, IUniswapV3Factory, INonfungiblePositionManager} from "../../typechain";
import { Address } from "cluster";
import { BigNumber } from "bignumber.js";
import timeMachine from "ganache-time-traveler";

/// Uniswap.
// import { Pool } from "@uniswap/sdk";

const { deployContract } = waffle;

describe("Execute order", async() => {
    let rocketDexInstance: LimitOrdersController
    let contractDeployer: SignerWithAddress; 
    let weth: IWETH9;
    let usdc: IERC20;
    let dai: IERC20;
    let btc: IERC20;
    let user1: SignerWithAddress; 
    let router: ISwapRouter;
    let uniV3Factory: IUniswapV3Factory;
    let nftPositionManager: INonfungiblePositionManager;
    let tokenId: number;  
    const executionFee: BigNumber = new BigNumber((ethers.utils.parseEther("1")).toString());
    const uniV3FactoryAddress: Address["address"] = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const uniV3NftAddress: Address["address"] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    const nftPositionManagerAddress: Address["address"] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    const daiAddress: Address["address"] = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    const btcAddress: Address["address"] = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    const usdcAddress: Address["address"] = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const wethAddress: Address["address"] = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const dai_weth_poolAddress: Address["address"] = "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8";
    const btc_weth_poolAddress: Address["address"] = "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD";
    let snapshot : string;
    before(async () => {
        let snapshotRaw = await timeMachine.takeSnapshot()
        snapshot = snapshotRaw.id.toString();
        const signers = await ethers.getSigners()
        contractDeployer = signers[0];
        user1 = signers[1];
        for(let i = 2; i <= 19; i++){
            if(i <= 10)await signers[i].call({to: user1.address, value: ethers.utils.parseEther("9999")});
            else await signers[i].call({to: contractDeployer.address, value: ethers.utils.parseEther("9999")});
        }
        rocketDexInstance = (await deployContract(signers[0], LimitOrdersControllerArtifacts)) as LimitOrdersController; 
        // Swap ETH for USDC.
        
        // Swap ETH for WETH.
        weth = (await ethers.getContractAt(IWETH9Artifacts.abi, wethAddress)) as IWETH9;
        usdc = (await ethers.getContractAt(IERC20Artifacts.abi, usdcAddress)) as IERC20;
        dai = (await ethers.getContractAt(IERC20Artifacts.abi, daiAddress)) as IERC20;
        btc = (await ethers.getContractAt(IERC20Artifacts.abi, btcAddress)) as IERC20;
        // let wrapEthTx = await weth.connect(user1).deposit({'value': ethers.utils.parseEther("2")});
        // await wrapEthTx.wait();

        uniV3Factory = (await ethers.getContractAt(IUniswapV3FactoryArtifacts.abi, uniV3FactoryAddress)) as IUniswapV3Factory;
        nftPositionManager = (await ethers.getContractAt(INonfungiblePositionManagerArtifacts.abi, nftPositionManagerAddress)) as INonfungiblePositionManager;
        router = (await ethers.getContractAt(ISwapRouterArtifacts.abi, "0xE592427A0AEce92De3Edee1F18E0157C05861564")) as ISwapRouter;
        let swapTx1 = await router.connect(user1).exactInputSingle(
            {
                tokenIn: wethAddress, 
                tokenOut: usdcAddress, 
                fee: 3000, 
                recipient: user1.address, 
                deadline: 1e10, 
                amountIn: ethers.utils.parseEther("20"), 
                amountOutMinimum: 0, 
                sqrtPriceLimitX96: 0
            },
            {
                value: ethers.utils.parseEther("20")
            }
        );
        await swapTx1.wait();

        let swapTx2 = await router.connect(user1).exactInputSingle(
            {
                tokenIn: wethAddress, 
                tokenOut: daiAddress, 
                fee: 3000, 
                recipient: user1.address, 
                deadline: 1e10, 
                amountIn: ethers.utils.parseEther("10"), 
                amountOutMinimum: 0, 
                sqrtPriceLimitX96: 0
            },
            {
                value: ethers.utils.parseEther("10")
            }
        );
        await swapTx2.wait();
    });

    after(async () => {
        await timeMachine.revertToSnapshot(snapshot);
    });

    describe("Initialization", async() => {
        it("Initialize contract", async() => {
            let tx = await rocketDexInstance.initialize(
                nftPositionManagerAddress, 
                uniV3FactoryAddress,
                wethAddress,
                uniV3NftAddress,
                executionFee.toFixed()
            );
            await tx.wait();
            
            let actualPostionManager: Address["address"] = await rocketDexInstance.nftPositionManager();
            expect(actualPostionManager.toLowerCase()).to.equal(nftPositionManagerAddress.toLowerCase());
            let actualUniV3Factory: Address["address"] = await rocketDexInstance.uniswapV3Factory();
            expect(actualUniV3Factory.toLowerCase()).to.equal(uniV3FactoryAddress.toLowerCase());
            let actualWETH9Address: Address["address"] = await rocketDexInstance.weth();
            expect(actualWETH9Address.toLowerCase()).to.equal(wethAddress.toLowerCase());
            let actualuniV3NftAddress: Address["address"] = await rocketDexInstance.uniV3Nft();
            expect(actualuniV3NftAddress.toLowerCase()).to.equal(uniV3NftAddress.toLowerCase());
            let actualFee: BigNumber = new BigNumber((await rocketDexInstance.executionFee()).toString());
            expect(actualFee.toFixed()).to.equal(executionFee.toString());
        });
    });

    describe("Check position", async() => {
        it("Check position", async () => {
            // Get pool price.
            const pool = await ethers.getContractAt('IUniswapV3Pool', dai_weth_poolAddress) as IUniswapV3Pool;
            const slot0 = await pool.slot0(); 
            let tickSpacing: number = await pool.tickSpacing();
            const tick: number = slot0.tick + tickSpacing;

            let daiBalance: BigNumber = new BigNumber((await dai.balanceOf(user1.address))._hex);
            
            let approveTx = await dai.connect(user1).approve(rocketDexInstance.address, await dai.balanceOf(user1.address));
            await approveTx.wait();
            let filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let createTradeTx = await rocketDexInstance.connect(user1).createOrder(
                {
                    fee: 3000,
                    token0: daiAddress,
                    token1: wethAddress,
                    tickLower: nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()),
                    tickUpper: 0,
                    amountOfToken0: daiBalance.toFixed(),
                    amountOfToken1: 0,
                    recievedAmountOfToken0: 0,
                    recievedAmountOfToken1: await rocketDexInstance.getAmount1FromAmount0(
                        daiBalance.toFixed(), 
                        nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()), 
                        nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()) + tickSpacing),
                    deadline: 1e10,
                    orderType: 0
                },
                {
                    value: executionFee.toFixed()
                }
            );
            await createTradeTx.wait();
            tokenId = (await rocketDexInstance.queryFilter(filter, -1, "latest"))[0].args.tokenId.toNumber();
            let checkResult = await rocketDexInstance.checkOrder(tokenId, dai_weth_poolAddress);

            expect(checkResult.isClosable);
            expect(checkResult.owner.toLowerCase()).to.equal(user1.address.toLowerCase());
            expect(checkResult.quoteToken.toLowerCase()).to.equal(wethAddress.toLowerCase());
            expect(checkResult.quoteAmount.toNumber()).to.equal(0);
            expect(checkResult.baseToken.toLowerCase()).to.equal(daiAddress.toLowerCase());
            expect(new BigNumber(daiBalance).minus(checkResult.baseAmount.toString()).toNumber()).lessThanOrEqual(1e5);
        })

        it("Check position with small swap after creating order", async () => {
            let checkResultBefore = await rocketDexInstance.checkOrder(tokenId, dai_weth_poolAddress);
            let checkResult = await rocketDexInstance.checkOrder(tokenId, dai_weth_poolAddress);
            while(new BigNumber(checkResult.quoteAmount.toString()).isEqualTo(0)){
                let swapTx1 = await router.connect(user1).exactInputSingle(
                    {
                        tokenIn: wethAddress, 
                        tokenOut: daiAddress, 
                        fee: 3000, 
                        recipient: user1.address, 
                        deadline: 1e10, 
                        amountIn: ethers.utils.parseEther("5"), 
                        amountOutMinimum: 0, 
                        sqrtPriceLimitX96: 0
                    },
                    {
                        value: ethers.utils.parseEther("5")
                    }
                );
                await swapTx1.wait();
                await timeMachine.advanceBlock()

                checkResult = await rocketDexInstance.checkOrder(tokenId, dai_weth_poolAddress);
            }
            expect(!checkResult.isClosable);
            expect(checkResult.owner.toLowerCase()).to.equal(user1.address.toLowerCase());
            expect(checkResult.quoteToken.toLowerCase()).to.equal(wethAddress.toLowerCase());
            expect(new BigNumber(checkResult.quoteAmount.toString()).toNumber()).greaterThan(0);
            expect(new BigNumber(checkResult.baseAmount.toString()).isLessThan(checkResultBefore.baseAmount.toString()));
        });
    });

    describe("Close position", async() => {
        it("Close position with wrong parameters", async() => {
            await expect(rocketDexInstance.executeOrder(tokenId, "0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168")
                ).to.be.revertedWith("EXEO1"); 
        });

        it("Close unclosed position", async() => {
            await expect(rocketDexInstance.executeOrder(tokenId, dai_weth_poolAddress)
                ).to.be.revertedWith("EXEO4"); 
        });

        it("Check closable position after huge swap", async () => {
            let checkResult = await rocketDexInstance.checkOrder(tokenId, dai_weth_poolAddress);
            while(!checkResult.isClosable){
                let swapTx1 = await router.connect(user1).exactInputSingle(
                    {
                        tokenIn: wethAddress, 
                        tokenOut: daiAddress, 
                        fee: 3000, 
                        recipient: user1.address, 
                        deadline: 1e10, 
                        amountIn: ethers.utils.parseEther("50"), 
                        amountOutMinimum: 0, 
                        sqrtPriceLimitX96: 0
                    },
                    {
                        value: ethers.utils.parseEther("50")
                    }
                );
                await swapTx1.wait();
                await timeMachine.advanceBlock()
                checkResult = await rocketDexInstance.checkOrder(tokenId, dai_weth_poolAddress);
            }
            expect(checkResult.isClosable);
            expect(checkResult.owner.toLowerCase()).to.equal(user1.address.toLowerCase());
            expect(checkResult.quoteToken.toLowerCase()).to.equal(wethAddress.toLowerCase());
            expect(new BigNumber(checkResult.quoteAmount.toString()).isGreaterThan("0"));
            expect(new BigNumber(checkResult.baseAmount.toString()).isEqualTo("0"));
        });

        it("Close position", async () => {
            let checkResult = await rocketDexInstance.checkOrder(tokenId, dai_weth_poolAddress);
            let balanceBefore = await weth.balanceOf(user1.address);
            let closeTx = await rocketDexInstance.executeOrder(tokenId, dai_weth_poolAddress)
            await closeTx.wait(); 
            await timeMachine.advanceBlock()
            let balanceAfter = await weth.balanceOf(user1.address);
            let orderData = await rocketDexInstance.orders(dai_weth_poolAddress, tokenId);
            expect(orderData.orderType).to.equal(2);
            expect(new BigNumber(balanceAfter.toString()).minus(balanceBefore.toString()).isGreaterThan(checkResult.quoteAmount.toString()));
            expect(new BigNumber(checkResult.quoteAmount.toString()).isEqualTo(orderData.recievedAmount.toString()));
            expect(new BigNumber(balanceAfter.toString()).minus(balanceBefore.toString()).isEqualTo(orderData.recievedAmount.toString()));
        });

        it("Close position second time", async () => {
            await timeMachine.advanceBlock();
            await expect(rocketDexInstance.executeOrder(tokenId, dai_weth_poolAddress)
                ).to.be.revertedWith("OT"); 
        });

        it("Close position with received amount less than requested", async () => {
            let balanceBefore = await btc.balanceOf(user1.address);
            let swapTx1 = await router.connect(user1).exactInputSingle(
                {
                    tokenIn: wethAddress, 
                    tokenOut: btcAddress, 
                    fee: 3000, 
                    recipient: user1.address, 
                    deadline: 1e10, 
                    amountIn: ethers.utils.parseEther("0.000001"), 
                    amountOutMinimum: 0, 
                    sqrtPriceLimitX96: 0
                },
                {
                    value: ethers.utils.parseEther("0.000001")
                }
            );
            await swapTx1.wait();
            await timeMachine.advanceBlock()

            const pool = await ethers.getContractAt('IUniswapV3Pool', btc_weth_poolAddress) as IUniswapV3Pool;
            const slot0 = await pool.slot0(); 
            let tickSpacing: number = await pool.tickSpacing();
            const tick: number = slot0.tick + tickSpacing;

            let btcBalance: BigNumber = new BigNumber((await btc.balanceOf(user1.address))._hex);
            
            let approveTx = await btc.connect(user1).approve(rocketDexInstance.address, await btc.balanceOf(user1.address));
            await approveTx.wait();

            let filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let createTradeTx = await rocketDexInstance.connect(user1).createOrder(
                {
                    fee: 3000,
                    token0: btcAddress,
                    token1: wethAddress,
                    tickLower: nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()),
                    tickUpper: 0,
                    amountOfToken0: btcBalance.minus(balanceBefore.toString()).toFixed(),
                    amountOfToken1: 0,
                    recievedAmountOfToken0: 0,
                    recievedAmountOfToken1: ethers.utils.parseEther("750"),
                    deadline: 1e10,
                    orderType: 0
                },
                {
                    value: executionFee.toFixed()
                }
            );
            await createTradeTx.wait();
            let tokenId2 = (await rocketDexInstance.queryFilter(filter))[1].args.tokenId.toNumber();
            let checkResult = await rocketDexInstance.checkOrder(tokenId2, btc_weth_poolAddress);
            while(!new BigNumber(checkResult.baseAmount.toString()).isEqualTo(0)){
                let swapTx2 = await router.connect(user1).exactInputSingle(
                    {
                        tokenIn: wethAddress, 
                        tokenOut: btcAddress, 
                        fee: 3000, 
                        recipient: user1.address, 
                        deadline: 1e10, 
                        amountIn: ethers.utils.parseEther("500"), 
                        amountOutMinimum: 0, 
                        sqrtPriceLimitX96: 0
                    },
                    {
                        value: ethers.utils.parseEther("500")
                    }
                );
                await swapTx2.wait();
                await timeMachine.advanceBlock()
                checkResult = await rocketDexInstance.checkOrder(tokenId2, btc_weth_poolAddress);
            }
            await timeMachine.advanceBlock();
            await expect(rocketDexInstance.executeOrder(tokenId2, btc_weth_poolAddress)
                ).to.be.revertedWith("EXEO5");
        });
    });

    describe("Cancel position", async() => {
        it("Cancel position from foreign user", async() => {
            await timeMachine.advanceBlock()
            let filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let tokenId2 = (await rocketDexInstance.queryFilter(filter))[1].args.tokenId.toNumber();
            await expect(rocketDexInstance.connect(contractDeployer).cancelOrder(tokenId2, btc_weth_poolAddress))
                .to.be.revertedWith("CANO2");
        });

        it("Cancel non existing position", async() => {
            await timeMachine.advanceBlock()
            let filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let tokenId2 = (await rocketDexInstance.queryFilter(filter))[0].args.tokenId.toNumber();
            await expect(rocketDexInstance.connect(user1).cancelOrder(tokenId2, btc_weth_poolAddress))
                .to.be.revertedWith("CANO1");
        });

        it("Cancel position of filled order", async() => {
            await timeMachine.advanceBlock()
            let filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let tokenId2 = (await rocketDexInstance.queryFilter(filter))[0].args.tokenId.toNumber();
            await expect(rocketDexInstance.connect(user1).cancelOrder(tokenId2, dai_weth_poolAddress))
                .to.be.revertedWith("OT");        
        });

        it("Cancel position with one token to receive", async() => {
            await timeMachine.advanceBlock()
            let filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let tokenId2 = (await rocketDexInstance.queryFilter(filter))[1].args.tokenId.toNumber();
            let checkResult = await rocketDexInstance.checkOrder(tokenId2, btc_weth_poolAddress);
            expect(checkResult.owner.toLowerCase()).to.equal(user1.address.toLowerCase());
            expect(checkResult.quoteToken.toLowerCase()).to.equal(wethAddress.toLowerCase());
            expect(new BigNumber(checkResult.quoteAmount.toString()).isGreaterThan(0));
            expect(new BigNumber(checkResult.baseAmount.toString()).isGreaterThan(0));
            
            let balanceBefore = await weth.balanceOf(user1.address);

            let cancelTx = await rocketDexInstance.connect(user1).cancelOrder(tokenId2, btc_weth_poolAddress);
            await cancelTx.wait();
            await timeMachine.advanceBlock()
            let balanceAfter = await weth.balanceOf(user1.address);

            let orderData = await rocketDexInstance.orders(btc_weth_poolAddress, tokenId2);
            expect(orderData.orderType).to.equal(4);
            expect(new BigNumber(balanceAfter.toString()).minus(balanceBefore.toString()).isGreaterThan(checkResult.quoteAmount.toString()));
        });

        it("Cancel position second time", async() => {
            await timeMachine.advanceBlock()
            let filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let tokenId2 = (await rocketDexInstance.queryFilter(filter))[1].args.tokenId.toNumber();
            await expect(rocketDexInstance.connect(user1).cancelOrder(tokenId2, btc_weth_poolAddress))
                .to.be.revertedWith("OT");               
        });

        it("Close cancelled position", async() => {
            await timeMachine.advanceBlock()
            let filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let tokenId2 = (await rocketDexInstance.queryFilter(filter))[1].args.tokenId.toNumber();
            await expect(rocketDexInstance.connect(user1).executeOrder(tokenId2, btc_weth_poolAddress))
                .to.be.revertedWith("OT");               
        });

        it("Cancel position with both tokens to receive", async() =>{
            let btcBalanceBefore: BigNumber = new BigNumber((await btc.balanceOf(user1.address))._hex);
            let swapTx1 = await router.connect(user1).exactInputSingle(
                {
                    tokenIn: wethAddress, 
                    tokenOut: btcAddress, 
                    fee: 3000, 
                    recipient: user1.address, 
                    deadline: 1e10, 
                    amountIn: ethers.utils.parseEther("0.0001"), 
                    amountOutMinimum: 0, 
                    sqrtPriceLimitX96: 0
                },
                {
                    value: ethers.utils.parseEther("0.0001")
                }
            );
            await swapTx1.wait();
            await timeMachine.advanceBlock()

            const pool = await ethers.getContractAt('IUniswapV3Pool', btc_weth_poolAddress) as IUniswapV3Pool;
            const slot0 = await pool.slot0(); 
            let tickSpacing: number = await pool.tickSpacing();
            const tick: number = slot0.tick + tickSpacing;

            let btcBalance: BigNumber = new BigNumber((await btc.balanceOf(user1.address))._hex);
            
            let approveTx = await btc.connect(user1).approve(rocketDexInstance.address, await btc.balanceOf(user1.address));
            await approveTx.wait();

            let filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let createTradeTx = await rocketDexInstance.connect(user1).createOrder(
                {
                    fee: 3000,
                    token0: btcAddress,
                    token1: wethAddress,
                    tickLower: nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()),
                    tickUpper: 0,
                    amountOfToken0: btcBalance.minus(btcBalanceBefore).toFixed(),
                    amountOfToken1: 0,
                    recievedAmountOfToken0: 0,
                    recievedAmountOfToken1: await rocketDexInstance.getAmount1FromAmount0(
                        btcBalance.toFixed(), 
                        nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()), 
                        nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()) + tickSpacing),
                    deadline: 1e10,
                    orderType: 0
                },
                {
                    value: executionFee.toFixed()
                }
            );
            await createTradeTx.wait()
            let tokenId2 = (await rocketDexInstance.queryFilter(filter))[2].args.tokenId.toNumber();
            let checkResult = await rocketDexInstance.checkOrder(tokenId2, btc_weth_poolAddress);
            while(new BigNumber(checkResult.quoteAmount.toString()).isEqualTo(0)){
                let swapTx2 = await router.connect(contractDeployer).exactInputSingle(
                    {
                        tokenIn: wethAddress, 
                        tokenOut: btcAddress, 
                        fee: 3000, 
                        recipient: user1.address, 
                        deadline: 1e10, 
                        amountIn: ethers.utils.parseEther("50"), 
                        amountOutMinimum: 0, 
                        sqrtPriceLimitX96: 0
                    },
                    {
                        value: ethers.utils.parseEther("50")
                    }
                );
                await swapTx2.wait();
                await timeMachine.advanceBlock()
                checkResult = await rocketDexInstance.checkOrder(tokenId2, btc_weth_poolAddress);
            }
            expect(checkResult.owner.toLowerCase()).to.equal(user1.address.toLowerCase());
            expect(checkResult.quoteToken.toLowerCase()).to.equal(wethAddress.toLowerCase());
            expect(checkResult.baseToken.toLowerCase()).to.equal(btcAddress.toLowerCase());
            expect(new BigNumber(checkResult.quoteAmount.toString()).isGreaterThan(0));
            expect(new BigNumber(checkResult.baseAmount.toString()).isGreaterThan(0));
            
            let balanceOfToken0Before = await btc.balanceOf(user1.address);
            let balanceOfToken1Before = await weth.balanceOf(user1.address);

            let cancelTx = await rocketDexInstance.connect(user1).cancelOrder(tokenId2, btc_weth_poolAddress);
            await cancelTx.wait();
            await timeMachine.advanceBlock()
            let balanceOfToken0After = await btc.balanceOf(user1.address);
            let balanceOfToken1After = await weth.balanceOf(user1.address);

            let orderData = await rocketDexInstance.orders(btc_weth_poolAddress, tokenId2);
            expect(orderData.orderType).to.equal(4);
            expect(new BigNumber(balanceOfToken0After.toString()).minus(balanceOfToken0Before.toString()).isGreaterThan(0));
            expect(new BigNumber(balanceOfToken0After.toString()).minus(balanceOfToken0Before.toString()).isGreaterThan(checkResult.baseAmount.toString()));
            expect(new BigNumber(balanceOfToken1After.toString()).minus(balanceOfToken1Before.toString()).isGreaterThan(checkResult.quoteAmount.toString()));
        });
    });

    describe("Buy limit tests", async() => {
        const fee: number = 3000;
        it("Create buy limit order", async() => {
            const amountOfEther: string = ethers.utils.parseEther("10").toString();
            // Get pool.
            const poolAddress: Address["address"] = await uniV3Factory.getPool(
                wethAddress,
                daiAddress,
                fee
            );
            const pool = await ethers.getContractAt('IUniswapV3Pool', poolAddress) as IUniswapV3Pool;
            const slot0 = await pool.slot0(); 
            let tickSpacing: number = await pool.tickSpacing();
            const tick: number = slot0.tick - tickSpacing;
            let approveTx = await weth.connect(user1).approve(
                rocketDexInstance.address, amountOfEther);
            await approveTx.wait();
            let usableTick: number = nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber());
            const filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let wrapEthTx = await weth.connect(user1).deposit({'value': amountOfEther});
            await wrapEthTx.wait();
    
            let createTradeTx = await rocketDexInstance.connect(user1).createOrder(
                {
                    fee: fee,
                    token0: await pool.token0(),
                    token1: await pool.token1(),
                    tickLower: 0,
                    tickUpper: usableTick,
                    amountOfToken0: 0,
                    amountOfToken1: amountOfEther,
                    recievedAmountOfToken0: await rocketDexInstance.getAmount0FromAmount1(amountOfEther, usableTick, usableTick + tickSpacing),
                    recievedAmountOfToken1: 0,
                    deadline: 2e10, 
                    orderType: 1
                },
                {
                    value: executionFee.toFixed()
                }
            );
            await createTradeTx.wait()
            // Get order id.
            await timeMachine.advanceBlock();
            let data = (await rocketDexInstance.queryFilter(filter))[3].args;
            tokenId = data.tokenId.toNumber();
            // Check stored data in our contract.
            let order = await rocketDexInstance.orders(poolAddress, tokenId.toString());
            expect(order.owner.toLowerCase()).to.equal(user1.address.toLowerCase());
            expect(order.token0.toLowerCase()).to.equal((await pool.token0()).toLowerCase());
            expect(order.token1.toLowerCase()).to.equal((await pool.token1()).toLowerCase());
            expect(order.tickLower).to.equal(usableTick - tickSpacing);
            expect(order.tickUpper).to.equal(usableTick);
            expect(order.amountOfToken0.toString()).to.equal(ethers.constants.Zero.toString());
            expect(order.amountOfToken1.toString()).to.equal(amountOfEther.toString());
            expect(order.recievedAmount.toString()).to.equal((await rocketDexInstance.getAmount0FromAmount1(amountOfEther, usableTick, usableTick + tickSpacing)).toString());
            expect(order.orderType).to.equal(1);
            
            let position = await nftPositionManager.positions(tokenId.toString());
            expect(position.operator.toLowerCase()).to.equal(ethers.constants.AddressZero);
            expect(position.token0.toLowerCase()).to.equal(order.token0.toLowerCase());
            expect(position.token1.toLowerCase()).to.equal(order.token1.toLowerCase());
            expect(position.fee).to.equal(order.fee);
            expect(position.tickLower).to.equal(order.tickLower);
            expect(position.tickUpper).to.equal(order.tickUpper);
            expect(position.liquidity.toString()).to.equal(order.liquidity.toString());
    
            expect((await rocketDexInstance.ethForExecute(tokenId)).toString()).to.equal(executionFee.toFixed());
        });

        it("Check closable position after huge swap", async () => {
            let checkResult = await rocketDexInstance.checkOrder(tokenId, dai_weth_poolAddress);
            
            let swapTx = await router.connect(contractDeployer).exactInputSingle(
                {
                    tokenIn: wethAddress, 
                    tokenOut: daiAddress, 
                    fee: 10000, 
                    recipient: user1.address, 
                    deadline: 1e10, 
                    amountIn: ethers.utils.parseEther("3000"), 
                    amountOutMinimum: 0, 
                    sqrtPriceLimitX96: 0
                },
                {value: ethers.utils.parseEther("3000")}
            );
            await swapTx.wait();
            let approveTx = await dai.connect(user1).approve(router.address, await dai.balanceOf(user1.address))
            await approveTx.wait();
            let swapTx1 = await router.connect(user1).exactInputSingle(
                {
                    tokenIn: daiAddress, 
                    tokenOut: wethAddress, 
                    fee: fee, 
                    recipient: user1.address, 
                    deadline: 1e10, 
                    amountIn: await dai.balanceOf(user1.address), 
                    amountOutMinimum: 0, 
                    sqrtPriceLimitX96: 0
                }
            );
            await swapTx1.wait();
            await timeMachine.advanceBlock()
            checkResult = await rocketDexInstance.checkOrder(tokenId, dai_weth_poolAddress);
            expect(checkResult.isClosable);
            expect(checkResult.owner.toLowerCase()).to.equal(user1.address.toLowerCase());
            expect(checkResult.quoteToken.toLowerCase()).to.equal(daiAddress.toLowerCase());
            expect(new BigNumber(checkResult.quoteAmount.toString()).isGreaterThan(0));
            expect(new BigNumber(checkResult.baseAmount.toString()).toFixed()).to.equal("0");
        });

        it("Close position", async () => {
            let checkResult = await rocketDexInstance.checkOrder(tokenId, dai_weth_poolAddress);
            let balanceBefore = await dai.balanceOf(user1.address);
            let closeTx = await rocketDexInstance.executeOrder(tokenId, dai_weth_poolAddress)
            await closeTx.wait(); 
            await timeMachine.advanceBlock()
            let balanceAfter = await dai.balanceOf(user1.address);
            let orderData = await rocketDexInstance.orders(dai_weth_poolAddress, tokenId);
            expect(orderData.orderType).to.equal(3);
            checkResult = await rocketDexInstance.checkOrder(tokenId, dai_weth_poolAddress);
            expect(new BigNumber(checkResult.quoteAmount.toString()).isLessThanOrEqualTo(orderData.recievedAmount.toString()));
            expect(new BigNumber(balanceAfter.toString()).minus(balanceBefore.toString()).isGreaterThan(checkResult.quoteAmount.toString()));
        });

        it("Create buy limit order and cancel it", async() => {
            const amountOfEther: string = ethers.utils.parseEther("0.5").toString();
            // Get pool.
            const poolAddress: Address["address"] = await uniV3Factory.getPool(
                wethAddress,
                daiAddress,
                fee
            );
            const pool = await ethers.getContractAt('IUniswapV3Pool', poolAddress) as IUniswapV3Pool;
            const slot0 = await pool.slot0(); 
            let tickSpacing: number = await pool.tickSpacing();
            const tick: number = slot0.tick - tickSpacing;
            let approveTx = await weth.connect(user1).approve(
                rocketDexInstance.address, amountOfEther);
            await approveTx.wait();
            let usableTick: number = nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber());
            const filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let wrapEthTx = await weth.connect(user1).deposit({'value': amountOfEther});
            await wrapEthTx.wait();
    
            let createTradeTx = await rocketDexInstance.connect(user1).createOrder(
                {
                    fee: fee,
                    token0: await pool.token0(),
                    token1: await pool.token1(),
                    tickLower: 0,
                    tickUpper: usableTick,
                    amountOfToken0: 0,
                    amountOfToken1: amountOfEther,
                    recievedAmountOfToken0: await rocketDexInstance.getAmount0FromAmount1(
                        amountOfEther, 
                        nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()) - tickSpacing, 
                        nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber())),
                    recievedAmountOfToken1: 0,
                    deadline: 2e10,
                    orderType: 1
                },
                {
                    value: executionFee.toFixed()
                }
            );
            await createTradeTx.wait()
            await timeMachine.advanceBlock();
            let data = (await rocketDexInstance.queryFilter(filter))[4].args;
            tokenId = data.tokenId.toNumber();
            await timeMachine.advanceBlock()
            let checkResult = await rocketDexInstance.checkOrder(tokenId, dai_weth_poolAddress);
            expect(checkResult.owner.toLowerCase()).to.equal(user1.address.toLowerCase());
            expect(checkResult.quoteToken.toLowerCase()).to.equal(daiAddress.toLowerCase());
            expect(new BigNumber(checkResult.quoteAmount.toString()).isGreaterThan(0));
            expect(new BigNumber(checkResult.baseAmount.toString()).isGreaterThan(0));
            
            let balanceBefore = await weth.balanceOf(user1.address);

            let cancelTx = await rocketDexInstance.connect(user1).cancelOrder(tokenId, dai_weth_poolAddress);
            await cancelTx.wait();
            await timeMachine.advanceBlock()
            let balanceAfter = await weth.balanceOf(user1.address);

            let orderData = await rocketDexInstance.orders(dai_weth_poolAddress, tokenId);
            expect(orderData.orderType).to.equal(5);
            expect(new BigNumber(balanceAfter.toString()).minus(balanceBefore.toString()).isGreaterThan(checkResult.quoteAmount.toString()));
        });
    });

    describe("Rapay for execution test", async() => {
        const fee: number = 3000;
        it("Set new fee for execution", async() => {
            let setterTx = await rocketDexInstance.connect(contractDeployer).setExecutionFee(ethers.utils.parseEther("100"));
            await setterTx.wait();
            expect(new BigNumber((await rocketDexInstance.executionFee()).toString()).toFixed()).to.equal((ethers.utils.parseEther("100")).toString())
        });

        it("Create order and execute it for reward", async() => {
            const pool = await ethers.getContractAt('IUniswapV3Pool', dai_weth_poolAddress) as IUniswapV3Pool;
            const slot0 = await pool.slot0(); 
            let tickSpacing: number = await pool.tickSpacing();
            const tick: number = slot0.tick + tickSpacing;
            let balanceBefore0 = await dai.balanceOf(user1.address);
            let swapTx1 = await router.connect(user1).exactInputSingle(
                {
                    tokenIn: wethAddress, 
                    tokenOut: daiAddress, 
                    fee: 3000, 
                    recipient: user1.address, 
                    deadline: 1e10, 
                    amountIn: ethers.utils.parseEther("0.001"), 
                    amountOutMinimum: 0, 
                    sqrtPriceLimitX96: 0
                },
                {
                    value: ethers.utils.parseEther("0.001")
                }
            );
            await swapTx1.wait();
            await timeMachine.advanceBlock()
            let daiBalance: BigNumber = new BigNumber((await dai.balanceOf(user1.address))._hex);
            
            let approveTx = await dai.connect(user1).approve(rocketDexInstance.address, await dai.balanceOf(user1.address));
            await approveTx.wait();
            let filter = rocketDexInstance.filters.CreateOrder(user1.address);
            let createTradeTx = await rocketDexInstance.connect(user1).createOrder(
                {
                    fee: fee,
                    token0: daiAddress,
                    token1: wethAddress,
                    tickLower: nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()),
                    tickUpper: 0,
                    amountOfToken0: daiBalance.minus(balanceBefore0.toString()).toFixed(),
                    amountOfToken1: 0,
                    recievedAmountOfToken0: 0,
                    recievedAmountOfToken1: await rocketDexInstance.getAmount1FromAmount0(daiBalance.minus(balanceBefore0.toString()).toFixed(), 
                        nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()), 
                        nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()) + tickSpacing),
                    deadline: 1e10,
                    orderType: 0
                },
                {
                    value: ethers.utils.parseEther("100")
                }
            );
            await createTradeTx.wait()
            await timeMachine.advanceBlock()
            let tokenId3 = (await rocketDexInstance.queryFilter(filter))[5].args.tokenId.toNumber(); 
            let checkResult = await rocketDexInstance.checkOrder(tokenId3, dai_weth_poolAddress);
            while(!checkResult.isClosable){
                let swapTx1 = await router.connect(contractDeployer).exactInputSingle(
                    {
                        tokenIn: wethAddress, 
                        tokenOut: daiAddress, 
                        fee: fee, 
                        recipient: user1.address, 
                        deadline: 1e10, 
                        amountIn: ethers.utils.parseEther("50"), 
                        amountOutMinimum: 0, 
                        sqrtPriceLimitX96: 0
                    },
                    {
                        value: ethers.utils.parseEther("50")
                    }
                );
                await swapTx1.wait();
                await timeMachine.advanceBlock()
                checkResult = await rocketDexInstance.checkOrder(tokenId3, dai_weth_poolAddress);
            }
            await timeMachine.advanceBlock()
            let balanceBefore = await contractDeployer.getBalance();
            let closeTx = await rocketDexInstance.executeOrder(tokenId3, dai_weth_poolAddress)
            let tx = await closeTx.wait(); 
            await timeMachine.advanceBlock()
            let balanceAfter = await contractDeployer.getBalance();
            let gasCost : string = "";
            if(closeTx.gasPrice?.toString() != undefined){
                gasCost = new BigNumber(tx.gasUsed.toString()).multipliedBy(closeTx.gasPrice?.toString()).toFixed();
            }
            let orderData = await rocketDexInstance.orders(dai_weth_poolAddress, tokenId3);
            expect(new BigNumber(checkResult.quoteAmount.toString()).toFixed()).to.equal(orderData.recievedAmount.toString());
            expect(new BigNumber(balanceAfter.toString())
                .plus(gasCost)
                .minus(balanceBefore.toString())
                .isEqualTo(ethers.utils.parseEther("100").toString()))
        });
    });
    
});
