import timeMachine from "ganache-time-traveler";
import { ethers, waffle } from "hardhat"
import chai, { expect } from "chai"
import LimitOrdersControllerArtifacts from "../../artifacts/contracts/Controller.sol/LimitOrdersController.json";
import ISwapRouterArtifacts from "../../artifacts/contracts/interfaces/IUniSwapV3Router.sol/ISwapRouter.json";
import INonfungiblePositionManagerArtifacts from "../../artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json";
import IWETH9Artifacts from "../../artifacts/contracts/interfaces/IWETH9.sol/IWETH9.json";
import IERC20Artifacts from "../../artifacts/contracts/interfaces/IERC20.sol/IERC20.json";                            
import IUniswapV3FactoryArtifacts from "../../artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { LimitOrdersController, ISwapRouter, IWETH9, IERC20, IUniswapV3Pool, IUniswapV3Factory, INonfungiblePositionManager} from "../../typechain";
import { Address } from "cluster";
import { BigNumber } from "bignumber.js";
import { nearestUsableTick, TickMath } from "@uniswap/v3-sdk";

const { deployContract } = waffle

describe("Edit order", () => {
    let uniV3Factory: IUniswapV3Factory;
    let controllerInstance: LimitOrdersController
    let contractDeployer: SignerWithAddress; 
    let nftPositionManager: INonfungiblePositionManager;
    let weth: IWETH9;
    let btc: IERC20;
    let usdc: IERC20;
    let dai: IERC20;
    let user1: SignerWithAddress; 
    let router: ISwapRouter;
    const executionFee: string = (ethers.utils.parseEther("0.03")).toString();
    const uniV3FactoryAddress: Address["address"] = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const uniV3NftAddress: Address["address"] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    const nftPositionManagerAddress: Address["address"] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    const wbtcAddress: Address["address"] = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    const daiAddress: Address["address"] = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
    const btcAddress: Address["address"] = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    const usdcAddress: Address["address"] = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    const wethAddress: Address["address"] = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    const dai_weth_poolAddress: Address["address"] = "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8";
    const btc_weth_poolAddress: Address["address"] = "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD";
    let snapshot:string;
    before(async () => {
        let snapshotRaw = await timeMachine.takeSnapshot()
        snapshot = snapshotRaw.id.toString();
        const signers = await ethers.getSigners()
        contractDeployer = signers[0];
        user1 = signers[1];
        controllerInstance = (await deployContract(signers[0], LimitOrdersControllerArtifacts)) as LimitOrdersController; 
        // Swap ETH for USDC.
        
        // Swap ETH for WETH.
        weth = (await ethers.getContractAt(IWETH9Artifacts.abi, wethAddress)) as IWETH9;
        usdc = (await ethers.getContractAt(IERC20Artifacts.abi, usdcAddress)) as IERC20;
        dai = (await ethers.getContractAt(IERC20Artifacts.abi, daiAddress)) as IERC20;
        btc = (await ethers.getContractAt(IERC20Artifacts.abi, btcAddress)) as IERC20;

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
        await timeMachine.revertToSnapshot(snapshot)
    })
   
    it("initialization", async() => {
        
        let tx = await controllerInstance.initialize(
            nftPositionManagerAddress, 
            uniV3FactoryAddress,
            wethAddress,
            uniV3NftAddress,
            executionFee
            );
        await tx.wait();
        
        let actualPostionManager: Address["address"] = await controllerInstance.nftPositionManager();
        expect(actualPostionManager.toLowerCase()).equal(nftPositionManagerAddress.toLowerCase());
        let actualUniV3Factory: Address["address"] = await controllerInstance.uniswapV3Factory();
        expect(actualUniV3Factory.toLowerCase()).equal(uniV3FactoryAddress.toLowerCase());
        let actualWETH9Address: Address["address"] = await controllerInstance.weth();
        expect(actualWETH9Address.toLowerCase()).equal(wethAddress.toLowerCase());
        let actualuniV3NftAddress: Address["address"] = await controllerInstance.uniV3Nft();
        expect(actualuniV3NftAddress.toLowerCase()).equal(uniV3NftAddress.toLowerCase());
        let actualFee = await controllerInstance.executionFee();
        expect(actualFee.toString()).equal(executionFee);
    });

    it("create TAKE_PROFIT Order", async () => {
        const fee: number = 3000;
        // Get pool.
        const pool = await ethers.getContractAt('IUniswapV3Pool', dai_weth_poolAddress) as IUniswapV3Pool;
        const slot0 = await pool.slot0(); 
        let tickSpacing: number = await pool.tickSpacing();
        const tick: number = slot0.tick + tickSpacing;

        let daiBalance: BigNumber = new BigNumber((await dai.balanceOf(user1.address))._hex);
        
        let approveTx = await dai.connect(user1).approve(controllerInstance.address, await dai.balanceOf(user1.address));
        await approveTx.wait();
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let usableTick = nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber())
        let createTradeTx = await controllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: daiAddress,
                token1: wethAddress,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: daiBalance.toFixed(),
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: await controllerInstance.getAmount1FromAmount0(
                    daiBalance.toFixed(), 
                    usableTick, 
                    usableTick + tickSpacing),
                deadline: 1e10,
                orderType: 0
            },
            {
                value: executionFee
            }
        );
        await createTradeTx.wait();
        // Get order id.
        await timeMachine.advanceBlock();
        let data = (await controllerInstance.queryFilter(filter))[0].args;
        
        let tokenId = data.tokenId;
        // Check stored data in our contract.
        let order = await controllerInstance.orders(dai_weth_poolAddress, tokenId);
        expect(order.owner.toLowerCase()).equal(user1.address.toLowerCase());
        expect(order.token0.toLowerCase()).equal((await pool.token0()).toLowerCase());
        expect(order.token1.toLowerCase()).equal((await pool.token1()).toLowerCase());
        expect(order.tickLower).equal(usableTick);
        expect(order.tickUpper).equal(usableTick + tickSpacing);
        expect(order.amountOfToken0.toString()).equal(daiBalance.toFixed().toString());
        expect(order.amountOfToken1.toString()).equal(ethers.constants.Zero.toString());
        expect(order.recievedAmount.toString()).equal((
            await controllerInstance.getAmount1FromAmount0(
                daiBalance.toFixed(), 
                usableTick, 
                usableTick + tickSpacing)
            ).toString());
        expect(order.orderType).equal(0);
        
        let position = await nftPositionManager.positions(tokenId);
        expect(position.operator.toLowerCase()).equal(ethers.constants.AddressZero.toLowerCase());
        expect(position.token0.toLowerCase()).equal(order.token0.toLowerCase());
        expect(position.token1.toLowerCase()).equal(order.token1.toLowerCase());
        expect(position.fee).equal(order.fee);
        expect(position.tickLower).equal(order.tickLower);
        expect(position.tickUpper).equal(order.tickUpper);
        expect(position.liquidity.toString()).equal(order.liquidity.toString());
    });

    it("increase amount in TAKE_PROFIT order", async () => {
        let swapTx = await router.connect(user1).exactInputSingle(
            {
                tokenIn: wethAddress, 
                tokenOut: daiAddress, 
                fee: 3000, 
                recipient: user1.address, 
                deadline: 1e10, 
                amountIn: ethers.utils.parseEther("0.01"), 
                amountOutMinimum: 0, 
                sqrtPriceLimitX96: 0
            },
            {
                value: ethers.utils.parseEther("0.01")
            }
        );
        await swapTx.wait();
        
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let tokenId = (await controllerInstance.queryFilter(filter))[0].args.tokenId.toNumber();
        let orderData = await controllerInstance.orders(dai_weth_poolAddress, tokenId);
        let approveTx = await dai.connect(user1).approve(controllerInstance.address, 100);
        await approveTx.wait(); 
        (await controllerInstance.connect(user1).editOrder({
            tokenId: tokenId,
            poolAddress: dai_weth_poolAddress,
            amountOfToken: (new BigNumber(orderData.amountOfToken0.toString()).plus(100)).toFixed()
        })).wait();
        expect(
            new BigNumber(
                (
                    await controllerInstance.orders(dai_weth_poolAddress, tokenId)
                ).amountOfToken0.toString()
            ).isEqualTo(new BigNumber(orderData.amountOfToken0.toString()).plus(100).toFixed())
        );
        expect(
            new BigNumber(
                (
                    await controllerInstance.orders(dai_weth_poolAddress, tokenId)
                ).liquidity.toString()
            ).isGreaterThan(new BigNumber(orderData.liquidity.toString()).toFixed())
        );
        expect(
            new BigNumber(
                (
                    await controllerInstance.orders(dai_weth_poolAddress, tokenId)
                ).recievedAmount.toString()
            ).isGreaterThan(new BigNumber(orderData.recievedAmount.toString()).toFixed())
        );
        expect(
            new BigNumber(
                (
                    await dai.balanceOf(controllerInstance.address)
                ).toString()
            ).isEqualTo(0)
        );
    });

    it("decrease amount in TAKE_PROFIT order", async () => {
        const amountToDecrease = 1e13;
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let tokenId = (await controllerInstance.queryFilter(filter))[0].args.tokenId.toNumber();
        let orderData = await controllerInstance.orders(dai_weth_poolAddress, tokenId); 
        let balanceBefore = await dai.balanceOf(user1.address); 
        const pool = await ethers.getContractAt('IUniswapV3Pool', dai_weth_poolAddress) as IUniswapV3Pool;
        (await controllerInstance.connect(user1).editOrder({
            tokenId: tokenId,
            poolAddress: dai_weth_poolAddress,
            amountOfToken: (new BigNumber(orderData.amountOfToken0.toString()).minus(amountToDecrease)).toFixed()
        })).wait();
        await timeMachine.advanceBlock();
        expect(
            new BigNumber(
                (
                    await controllerInstance.orders(dai_weth_poolAddress, tokenId)
                ).liquidity.toString()
            ).isLessThan(new BigNumber(orderData.liquidity.toString()).toFixed())
        );
        expect(
            new BigNumber(
                (
                    await controllerInstance.orders(dai_weth_poolAddress, tokenId)
                ).recievedAmount.toString()
            ).isLessThan(new BigNumber(orderData.recievedAmount.toString()).toFixed())
        );
        expect(
            new BigNumber(
                (
                    await weth.balanceOf(controllerInstance.address)
                ).toString()
            ).isEqualTo(0)
        );
        expect(
            new BigNumber(
                (
                    await weth.balanceOf(controllerInstance.address)
                ).toString()
            ).isEqualTo(0)
        );
        expect(
            new BigNumber(
                (
                    await dai.balanceOf(user1.address)
                ).toString()
            ).minus(
                balanceBefore.toString()
            ).toNumber()).closeTo(amountToDecrease, 1);
        expect(
            new BigNumber(
                (
                    await controllerInstance.orders(dai_weth_poolAddress, tokenId)
                ).amountOfToken0.toString()
            ).minus(
                orderData.amountOfToken0.toString()
            ).plus(amountToDecrease).toNumber()
        ).closeTo(0, 1);
    });

    it("edit with the same amount in TAKE_PROFIT order", async () => {
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let tokenId = (await controllerInstance.queryFilter(filter))[0].args.tokenId.toNumber();
        let orderData = await controllerInstance.orders(dai_weth_poolAddress, tokenId); 
        await expect(
            controllerInstance.connect(user1).editOrder(
                {
                    tokenId: tokenId,
                    poolAddress: dai_weth_poolAddress,
                    amountOfToken: (
                        new BigNumber(
                            orderData.amountOfToken0.toString()
                        ).toFixed()
                    )
                }
            )
        ).to.be.revertedWith("EDIT5");   
    });

    it("edit order with wrong token ID", async () => {
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let tokenId = (await controllerInstance.queryFilter(filter))[0].args.tokenId.toNumber();
        let orderData = await controllerInstance.orders(dai_weth_poolAddress, tokenId); 
        await expect(
            controllerInstance.connect(user1).editOrder(
                {
                    tokenId: 0,
                    poolAddress: dai_weth_poolAddress,
                    amountOfToken: (
                        new BigNumber(
                            orderData.amountOfToken0.toString()
                        ).toFixed()
                    )
                }
            )
        ).to.be.revertedWith("EDIT0");   
    });

    it("edit order with wrong pool address", async () => {
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let tokenId = (await controllerInstance.queryFilter(filter))[0].args.tokenId.toNumber();
        let orderData = await controllerInstance.orders(dai_weth_poolAddress, tokenId); 
        await expect(
            controllerInstance.connect(user1).editOrder(
                {
                    tokenId: tokenId,
                    poolAddress: ethers.constants.AddressZero,
                    amountOfToken: (
                        new BigNumber(
                            orderData.amountOfToken0.toString()
                        ).toFixed()
                    )
                }
            )
        ).to.be.revertedWith("EDIT1");   
    });

    it("edit order not from owner", async () => {
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let tokenId = (await controllerInstance.queryFilter(filter))[0].args.tokenId.toNumber();
        let orderData = await controllerInstance.orders(dai_weth_poolAddress, tokenId); 
        await expect(
            controllerInstance.connect(contractDeployer).editOrder(
                {
                    tokenId: tokenId,
                    poolAddress: dai_weth_poolAddress,
                    amountOfToken: (
                        new BigNumber(
                            orderData.amountOfToken0.toString()
                        ).toFixed()
                    )
                }
            )
        ).to.be.revertedWith("EDIT4");   
    });

    it("change current tick, so order cannot be edited", async() => {
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
        
        let approveTx = await btc.connect(user1).approve(controllerInstance.address, await btc.balanceOf(user1.address));
        await approveTx.wait();

        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let createTradeTx = await controllerInstance.connect(user1).createOrder(
            {
                fee: 3000,
                token0: btcAddress,
                token1: wethAddress,
                tickLower: nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()),
                tickUpper: 0,
                amountOfToken0: btcBalance.toFixed(),
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: await controllerInstance.getAmount1FromAmount0(
                    btcBalance.toFixed(), 
                    nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()), 
                    nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber()) + tickSpacing),
                deadline: 1e10,
                orderType: 0
            },
            {
                value: executionFee
            }
        );
        await createTradeTx.wait()
        let tokenId2 = (await controllerInstance.queryFilter(filter))[1].args.tokenId.toNumber();
        let checkResult = await controllerInstance.checkOrder(tokenId2, btc_weth_poolAddress);
        while(new BigNumber(checkResult.quoteAmount.toString()).isEqualTo(0)){
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
            checkResult = await controllerInstance.checkOrder(tokenId2, btc_weth_poolAddress);
        }
        let orderData = await controllerInstance.orders(btc_weth_poolAddress, tokenId2);
        await expect(
            controllerInstance.connect(user1).editOrder(
                {
                    tokenId: tokenId2,
                    poolAddress: btc_weth_poolAddress,
                    amountOfToken: (
                        new BigNumber(
                            orderData.amountOfToken0.toString()
                        ).toFixed()
                    )
                }
            )
        ).to.be.revertedWith("EDIT3"); 
    });

    it("fill order and try to edit it", async() => {
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let tokenId2 = (await controllerInstance.queryFilter(filter))[1].args.tokenId.toNumber();
        let checkResult = await controllerInstance.checkOrder(tokenId2, btc_weth_poolAddress);
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
            checkResult = await controllerInstance.checkOrder(tokenId2, btc_weth_poolAddress);
        }
        await (await controllerInstance.executeOrder(tokenId2, btc_weth_poolAddress)).wait();
        let orderData = await controllerInstance.orders(btc_weth_poolAddress, tokenId2);
        await expect(
            controllerInstance.connect(user1).editOrder(
                {
                    tokenId: tokenId2,
                    poolAddress: btc_weth_poolAddress,
                    amountOfToken: (
                        new BigNumber(
                            orderData.amountOfToken0.toString()
                        ).toFixed()
                    )
                }
            )
        ).to.be.revertedWith("OT"); 
    });

    it("create BUY_LIMIT Order", async () => {
        const fee: number = 3000;
        // Get pool.
        const pool = await ethers.getContractAt('IUniswapV3Pool', dai_weth_poolAddress) as IUniswapV3Pool;
        const slot0 = await pool.slot0(); 
        let tickSpacing: number = await pool.tickSpacing();
        const tick: number = slot0.tick - tickSpacing;
        let wrapEthTx = await weth.connect(user1).deposit({'value': ethers.utils.parseEther("2")});
        await wrapEthTx.wait();
        let wethBalance: BigNumber = new BigNumber((await weth.balanceOf(user1.address))._hex);
        let approveTx = await weth.connect(user1).approve(controllerInstance.address, await weth.balanceOf(user1.address));
        await approveTx.wait();
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let usableTick = nearestUsableTick(tick, ethers.BigNumber.from(tickSpacing).toNumber())
        let createTradeTx = await controllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: daiAddress,
                token1: wethAddress,
                tickLower: 0,
                tickUpper: usableTick,
                amountOfToken0: 0,
                amountOfToken1: wethBalance.toFixed(),
                recievedAmountOfToken0: await controllerInstance.getAmount1FromAmount0(
                    wethBalance.toFixed(), 
                    usableTick - tickSpacing, 
                    usableTick),
                recievedAmountOfToken1: 0,
                deadline: 1e10,
                orderType: 1
            },
            {
                value: executionFee
            }
        );
        await createTradeTx.wait();
        // Get order id.
        await timeMachine.advanceBlock();
        let data = (await controllerInstance.queryFilter(filter))[2].args;
        
        let tokenId = data.tokenId;
        // Check stored data in our contract.
        let order = await controllerInstance.orders(dai_weth_poolAddress, tokenId);
        expect(order.owner.toLowerCase()).equal(user1.address.toLowerCase());
        expect(order.token0.toLowerCase()).equal((await pool.token0()).toLowerCase());
        expect(order.token1.toLowerCase()).equal((await pool.token1()).toLowerCase());
        expect(order.tickLower).equal(usableTick - tickSpacing);
        expect(order.tickUpper).equal(usableTick);
        expect(order.amountOfToken1.toString()).equal(wethBalance.toFixed().toString());
        expect(order.amountOfToken0.toString()).equal(ethers.constants.Zero.toString());
        expect(order.recievedAmount.toString()).equal((
            await controllerInstance.getAmount1FromAmount0(
                wethBalance.toFixed(), 
                usableTick - tickSpacing, 
                usableTick)
            ).toString());
        expect(order.orderType).equal(1);
        
        let position = await nftPositionManager.positions(tokenId);
        expect(position.operator.toLowerCase()).equal(ethers.constants.AddressZero.toLowerCase());
        expect(position.token0.toLowerCase()).equal(order.token0.toLowerCase());
        expect(position.token1.toLowerCase()).equal(order.token1.toLowerCase());
        expect(position.fee).equal(order.fee);
        expect(position.tickLower).equal(order.tickLower);
        expect(position.tickUpper).equal(order.tickUpper);
        expect(position.liquidity.toString()).equal(order.liquidity.toString());
    });

    it("increase amount in BUY_LIMIT order", async () => {
        let wrapEthTx = await weth.connect(user1).deposit({'value': ethers.utils.parseEther("0.0002")});
        await wrapEthTx.wait();
        let wethBalance = (await weth.balanceOf(user1.address)).toString();
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let tokenId = (await controllerInstance.queryFilter(filter))[2].args.tokenId.toNumber();
        let orderData = await controllerInstance.orders(dai_weth_poolAddress, tokenId);
        let approveTx = await weth.connect(user1).approve(controllerInstance.address, wethBalance);
        await approveTx.wait(); 
        (await controllerInstance.connect(user1).editOrder({
            tokenId: tokenId,
            poolAddress: dai_weth_poolAddress,
            amountOfToken: (new BigNumber(orderData.amountOfToken1.toString()).plus(wethBalance)).toFixed()
        })).wait();
        expect
            (
            new BigNumber(
                (
                    await controllerInstance.orders(dai_weth_poolAddress, tokenId)
                ).amountOfToken1.toString()
            ).isEqualTo(new BigNumber(orderData.amountOfToken1.toString()).plus(wethBalance).toFixed())
        );
        expect(
            new BigNumber(
                (
                    await controllerInstance.orders(dai_weth_poolAddress, tokenId)
                ).liquidity.toString()
            ).isGreaterThan(new BigNumber(orderData.liquidity.toString()).toFixed())
        );
        expect(
            new BigNumber(
                (
                    await controllerInstance.orders(dai_weth_poolAddress, tokenId)
                ).recievedAmount.toString()
            ).isGreaterThan(new BigNumber(orderData.recievedAmount.toString()).toFixed())
        );
        expect
            (
            new BigNumber(
                (
                    await weth.balanceOf(controllerInstance.address)
                ).toString()
            ).isEqualTo(0)
        );
    });

    it("decrease amount in BUY_LIMIT order", async () => {
        const amountToDecrease = 1e13;
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let tokenId = (await controllerInstance.queryFilter(filter))[2].args.tokenId.toNumber();
        let orderData = await controllerInstance.orders(dai_weth_poolAddress, tokenId); 
        let balanceBefore = await weth.balanceOf(user1.address); 
        (await controllerInstance.connect(user1).editOrder({
            tokenId: tokenId,
            poolAddress: dai_weth_poolAddress,
            amountOfToken: (new BigNumber(orderData.amountOfToken1.toString()).minus(amountToDecrease)).toFixed()
        })).wait();
        await timeMachine.advanceBlock();
        expect
            (
            new BigNumber(
                (
                    await controllerInstance.orders(dai_weth_poolAddress, tokenId)
                ).liquidity.toString()
            ).isLessThan(new BigNumber(orderData.liquidity.toString()).toFixed())
        );
        expect(
            new BigNumber(
                (
                    await controllerInstance.orders(dai_weth_poolAddress, tokenId)
                ).recievedAmount.toString()
            ).isLessThan(new BigNumber(orderData.recievedAmount.toString()).toFixed())
        );
        expect(
            new BigNumber(
                (
                    await dai.balanceOf(controllerInstance.address)
                ).toString()
            ).isEqualTo(0)
        );
        expect(
            new BigNumber(
                (
                    await weth.balanceOf(controllerInstance.address)
                ).toString()
            ).isEqualTo(0)
        );
        expect(
            new BigNumber(
                (
                    await weth.balanceOf(user1.address)
                ).toString()
            ).minus(
                balanceBefore.toString()
            ).toNumber()).closeTo(amountToDecrease, 1);
        expect(
            new BigNumber(
                (
                    await controllerInstance.orders(dai_weth_poolAddress, tokenId)
                ).amountOfToken1.toString()
            ).minus(
                orderData.amountOfToken1.toString()
            ).plus(amountToDecrease).toNumber()
        ).closeTo(0, 1);
    });

    it("edit with the same amount in BUY_LIMIT order", async () => {
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let tokenId = (await controllerInstance.queryFilter(filter))[2].args.tokenId.toNumber();
        let orderData = await controllerInstance.orders(dai_weth_poolAddress, tokenId); 
        await expect(
            controllerInstance.connect(user1).editOrder(
                {
                    tokenId: tokenId,
                    poolAddress: dai_weth_poolAddress,
                    amountOfToken: (
                        new BigNumber(
                            orderData.amountOfToken1.toString()
                        ).toFixed()
                    )
                }
            )
        ).to.be.revertedWith("EDIT5");   
    });

    it("edit with 0 amount to cancel BUY_LIMIT order", async() => {
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let tokenId = (await controllerInstance.queryFilter(filter))[2].args.tokenId.toNumber();
        await expect(controllerInstance.connect(user1).editOrder(
                {
                    tokenId: tokenId,
                    poolAddress: dai_weth_poolAddress,
                    amountOfToken: 0
                }
            )
        ).to.emit(controllerInstance, "CancelOrder");  
    });

    it("edit cancelled BUY_LIMIT order", async() => {
        let filter = controllerInstance.filters.CreateOrder(user1.address);
        let tokenId = (await controllerInstance.queryFilter(filter))[2].args.tokenId.toNumber();
        await expect(
            controllerInstance.connect(user1).editOrder(
                {
                    tokenId: tokenId,
                    poolAddress: dai_weth_poolAddress,
                    amountOfToken: 0
                }
            )
        ).to.be.revertedWith("OT"); 
    });

    it("pause test", async() => {
        await (await controllerInstance.connect(contractDeployer).setPause(true)).wait();
        await expect(
            controllerInstance.connect(user1).editOrder(
                {
                    tokenId: 0,
                    poolAddress: dai_weth_poolAddress,
                    amountOfToken: 0
                }
            )
        ).to.be.revertedWith("Pausable: paused");
        expect(await controllerInstance.connect(contractDeployer).paused())
        await (await controllerInstance.connect(contractDeployer).setPause(false)).wait();
        expect(!await controllerInstance.connect(contractDeployer).paused())
    });

    it("slippage setter", async() => {
        await (await controllerInstance.connect(contractDeployer).setSlippage(99, 100)).wait();
        expect(new BigNumber((await controllerInstance.SLIPPAGE()).toString()).isEqualTo(99))
        expect(new BigNumber((await controllerInstance.SLIPPAGE_ACCURACY()).toString()).isEqualTo(100))
        await expect(
            controllerInstance.connect(contractDeployer).setSlippage(100, 100)
        ).to.be.revertedWith("STSL1");
    });
});
