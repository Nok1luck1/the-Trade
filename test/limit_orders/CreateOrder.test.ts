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
import { BigNumber } from "ethers";
import type { CreateOrderEvent } from "../../typechain/LimitOrdersController";
import { nearestUsableTick, TickMath } from "@uniswap/v3-sdk";

const { deployContract } = waffle

describe("#create order", async() => {
    const fee: number = 3000;
    const token0Address: Address["address"] = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599";
    let token0: IERC20;
    const token1Address: Address["address"] = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    let token1: IERC20;
    const wethAddress: Address["address"] = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
    let weth: IWETH9;
    let uniV3Factory: IUniswapV3Factory;
    let LimitOrdersControllerInstance: LimitOrdersController
    let contractDeployer: SignerWithAddress; 
    let nftPositionManager: INonfungiblePositionManager;
    let user1: SignerWithAddress; 
    let router: ISwapRouter;
    const executionFee: BigNumber = ethers.utils.parseEther("0.003");
    const uniV3FactoryAddress: Address["address"] = "0x1F98431c8aD98523631AE4a59f267346ea31F984";
    const uniV3NftAddress: Address["address"] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
    const nftPositionManagerAddress: Address["address"] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";  
    let snapshot : string;
    before(async () => {
        let snapshotRaw = await timeMachine.takeSnapshot()
        snapshot = snapshotRaw.id.toString();
        const signers = await ethers.getSigners()
        contractDeployer = signers[0];
        user1 = signers[1];
        LimitOrdersControllerInstance = (await deployContract(signers[0], LimitOrdersControllerArtifacts)) as LimitOrdersController; 
        uniV3Factory = (await ethers.getContractAt(IUniswapV3FactoryArtifacts.abi, uniV3FactoryAddress)) as IUniswapV3Factory;
        token0 = (await ethers.getContractAt(IERC20Artifacts.abi, token0Address)) as IERC20;
        token1 = (await ethers.getContractAt(IERC20Artifacts.abi, token1Address)) as IERC20;
        weth = (await ethers.getContractAt(IWETH9Artifacts.abi, wethAddress)) as IWETH9;
        nftPositionManager = (await ethers.getContractAt(INonfungiblePositionManagerArtifacts.abi, nftPositionManagerAddress)) as INonfungiblePositionManager;
        router = (await ethers.getContractAt(ISwapRouterArtifacts.abi, "0xE592427A0AEce92De3Edee1F18E0157C05861564")) as ISwapRouter;

        let swapTx1 = await router.connect(user1).exactInputSingle(
            {
                tokenIn: wethAddress, 
                tokenOut: token0Address, 
                fee: 3000, 
                recipient: user1.address, 
                deadline: 1e10, 
                amountIn: ethers.utils.parseEther("0.5"), 
                amountOutMinimum: 0, 
                sqrtPriceLimitX96: 0
            },
            {
                value: ethers.utils.parseEther("0.5")
            }
        );
        await swapTx1.wait();

        let swapTx2 = await router.connect(user1).exactInputSingle(
            {
                tokenIn: wethAddress, 
                tokenOut: token1Address, 
                fee: 3000, 
                recipient: user1.address, 
                deadline: 1e10, 
                amountIn: ethers.utils.parseEther("0.5"), 
                amountOutMinimum: 0, 
                sqrtPriceLimitX96: 0
            },
            {
                value: ethers.utils.parseEther("0.5")
            }
        );
        await swapTx2.wait();
    });
    after(async () => {
        await timeMachine.revertToSnapshot(snapshot)
    });
    beforeEach(async() => {
        let swapTx1 = await router.connect(user1).exactInputSingle(
            {
                tokenIn: wethAddress, 
                tokenOut: token0Address, 
                fee: 3000, 
                recipient: user1.address, 
                deadline: 1e10, 
                amountIn: ethers.utils.parseEther("0.5"), 
                amountOutMinimum: 0, 
                sqrtPriceLimitX96: 0
            },
            {
                value: ethers.utils.parseEther("0.5")
            }
        );
        await swapTx1.wait();

        let swapTx2 = await router.connect(user1).exactInputSingle(
            {
                tokenIn: wethAddress, 
                tokenOut: token1Address, 
                fee: 3000, 
                recipient: user1.address, 
                deadline: 1e10, 
                amountIn: ethers.utils.parseEther("0.5"), 
                amountOutMinimum: 0, 
                sqrtPriceLimitX96: 0
            },
            {
                value: ethers.utils.parseEther("0.5")
            }
        );
        await swapTx2.wait();
    });
   
    it("Should be initialized.", async() => {
        
        let tx = await LimitOrdersControllerInstance.initialize(
            nftPositionManagerAddress, 
            uniV3FactoryAddress,
            wethAddress,
            uniV3NftAddress,
            executionFee
            );
        await tx.wait();
        
        let actualPostionManager: Address["address"] = await LimitOrdersControllerInstance.nftPositionManager();
        expect(actualPostionManager.toLowerCase()).equal(nftPositionManagerAddress.toLowerCase());
        let actualUniV3Factory: Address["address"] = await LimitOrdersControllerInstance.uniswapV3Factory();
        expect(actualUniV3Factory.toLowerCase()).equal(uniV3FactoryAddress.toLowerCase());
        let actualWETH9Address: Address["address"] = await LimitOrdersControllerInstance.weth();
        expect(actualWETH9Address.toLowerCase()).equal(wethAddress.toLowerCase());
        let actualuniV3NftAddress: Address["address"] = await LimitOrdersControllerInstance.uniV3Nft();
        expect(actualuniV3NftAddress.toLowerCase()).equal(uniV3NftAddress.toLowerCase());
        let actualFee: BigNumber = await LimitOrdersControllerInstance.executionFee();
        expect(actualFee.eq(executionFee));
    });
    it("Should revert when order type not 0 or 1.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Balance, 
            usableTick, 
            usableTick + tickSpacing
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: token0Balance,
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: receivedAmount,
                deadline: 2e10,
                orderType: 3
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO2"); 
    });

    it("Should revert if token order is wrong", async() => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Balance, 
            usableTick, 
            usableTick + tickSpacing
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token1Address,
                token1: token0Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: token0Balance,
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: receivedAmount,
                deadline: 2e10,
                orderType: 0    
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO1"); 
    });

    it("Should revert if msg.value is less than LimitOrdersController.executionFee .", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Balance, 
            usableTick, 
            usableTick + tickSpacing
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: token0Balance,
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: receivedAmount,
                deadline: 2e10,
                orderType: 0    
            },
            {
                value: 1
            }
        )).to.be.revertedWith("CREO3"); 
    });
    it("Should revert if pool does not exist for this args.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Balance, 
            usableTick, 
            usableTick + tickSpacing
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: 13213,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: token0Balance,
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: receivedAmount,
                deadline: 2e10,
                orderType: 0    
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO4"); 
    });
    it("Should revert if tickLower less than current tick for TAKE_PROFIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick - tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Balance, 
            usableTick, 
            usableTick - tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: token0Balance,
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: receivedAmount,
                deadline: 2e10,
                orderType: 0
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO5"); 
    });
    it("Should revert if tickLower greater that TickMath - tickSpacing for TAKE_PROFIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = TickMath.MAX_TICK - tickSpacing + 1;
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Balance, 
            usableTick, 
            usableTick - tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: token0Balance,
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: receivedAmount,
                deadline: 2e10,
                orderType: 0
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO6"); 
    });
    it("Should revert if amountOfToken0 is equal to zero for TAKE_PROFIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Balance, 
            usableTick, 
            usableTick + tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: 0,
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: receivedAmount,
                deadline: 2e10,
                orderType: 0
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO7"); 
    });
    it("Should revert if amountOfToken1 is greater than zero for TAKE_PROFIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Balance, 
            usableTick, 
            usableTick + tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: token0Balance,
                amountOfToken1: 1,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: receivedAmount,
                deadline: 2e10,
                orderType: 0
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO8"); 
    });

    it("Should revert if recievedAmountOfToken0 is greater than zero for TAKE_PROFIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Balance, 
            usableTick, 
            usableTick + tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: token0Balance,
                amountOfToken1: 0,
                recievedAmountOfToken0: 1,
                recievedAmountOfToken1: 0,
                deadline: 2e10,
                orderType: 0
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO9"); 
    });

    it("Should revert if receivedAmountOfToken1 is equal than zero for TAKE_PROFIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Balance, 
            usableTick, 
            usableTick + tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: token0Balance,
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: 0,
                deadline: 2e10,
                orderType: 0
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO10"); 
    });
    it("Should revert if tickUpper is greater than zero for TAKE_PROFIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Balance, 
            usableTick, 
            usableTick + tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 1,
                amountOfToken0: token0Balance,
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: receivedAmount,
                deadline: 2e10,
                orderType: 0
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO11"); 
    });
    it("Should revert if tickUpper is greater than current tick for BUY_LIMIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token1Balance: BigNumber = await token1.balanceOf(user1.address);
        let approveTx = await token1.connect(user1).approve(
            LimitOrdersControllerInstance.address, token1Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount0FromAmount1(
            token1Balance, 
            usableTick, 
            usableTick + tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: 0,
                tickUpper: usableTick,
                amountOfToken0: 0,
                amountOfToken1: token1Balance,
                recievedAmountOfToken0: receivedAmount,
                recievedAmountOfToken1: 0,
                deadline: 2e10,
                orderType: 1
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO12"); 
    });
    it("Should revert if tickUpper < TickMath.MIN_TICK + tickSpacing for BUY_LIMIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token1Balance: BigNumber = await token1.balanceOf(user1.address);
        let approveTx = await token1.connect(user1).approve(
            LimitOrdersControllerInstance.address, token1Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount0FromAmount1(
            token1Balance, 
            usableTick, 
            usableTick + tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: 0,
                tickUpper: TickMath.MIN_TICK + 1,
                amountOfToken0: 0,
                amountOfToken1: token1Balance,
                recievedAmountOfToken0: receivedAmount,
                recievedAmountOfToken1: 0,
                deadline: 2e10,
                orderType: 1
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO13"); 
    });
    it("Should revert if amountOfToken0 is equal to zero for BUY_LIMIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token1Balance: BigNumber = await token1.balanceOf(user1.address);
        let approveTx = await token1.connect(user1).approve(
            LimitOrdersControllerInstance.address, token1Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick - tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount0FromAmount1(
            token1Balance, 
            usableTick, 
            usableTick - tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: 0,
                tickUpper: usableTick,
                amountOfToken0: 0,
                amountOfToken1: 0,
                recievedAmountOfToken0: receivedAmount,
                recievedAmountOfToken1: 0,
                deadline: 2e10,
                orderType: 1
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO14"); 
    });
    it("Should revert if amountOfToken0 is greater than zero for BUY_LIMIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token1Balance: BigNumber = await token1.balanceOf(user1.address);
        let approveTx = await token1.connect(user1).approve(
            LimitOrdersControllerInstance.address, token1Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick - tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount0FromAmount1(
            token1Balance, 
            usableTick, 
            usableTick - tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: 0,
                tickUpper: usableTick,
                amountOfToken0: 1,
                amountOfToken1: token1Balance,
                recievedAmountOfToken0: receivedAmount,
                recievedAmountOfToken1: 0,
                deadline: 2e10,
                orderType: 1
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO15"); 
    });
    it("Should revert if receivedAmountOfToken1 is greater than zero for BUY_LIMIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token1Balance: BigNumber = await token1.balanceOf(user1.address);
        let approveTx = await token1.connect(user1).approve(
            LimitOrdersControllerInstance.address, token1Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick - tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount0FromAmount1(
            token1Balance, 
            usableTick, 
            usableTick - tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: 0,
                tickUpper: usableTick,
                amountOfToken0: 0,
                amountOfToken1: token1Balance,
                recievedAmountOfToken0: receivedAmount,
                recievedAmountOfToken1: 1,
                deadline: 2e10,
                orderType: 1
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO16"); 
    });
    it("Should revert if receivedAmountOfToken0 is equal to zero for BUY_LIMIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token1Balance: BigNumber = await token1.balanceOf(user1.address);
        let approveTx = await token1.connect(user1).approve(
            LimitOrdersControllerInstance.address, token1Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick - tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount0FromAmount1(
            token1Balance, 
            usableTick, 
            usableTick - tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: 0,
                tickUpper: usableTick,
                amountOfToken0: 0,
                amountOfToken1: token1Balance,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: 0,
                deadline: 2e10,
                orderType: 1
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO17"); 
    });
    it("Should revert if tickLower is greater than zero for BUY_LIMIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token1Balance: BigNumber = await token1.balanceOf(user1.address);
        let approveTx = await token1.connect(user1).approve(
            LimitOrdersControllerInstance.address, token1Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick - tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount0FromAmount1(
            token1Balance, 
            usableTick, 
            usableTick - tickSpacing 
        );
        await expect(LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: 1,
                tickUpper: usableTick,
                amountOfToken0: 0,
                amountOfToken1: token1Balance,
                recievedAmountOfToken0: receivedAmount,
                recievedAmountOfToken1: 0,
                deadline: 2e10,
                orderType: 1
            },
            {
                value: executionFee
            }
        )).to.be.revertedWith("CREO18"); 
    });
    it("Should create BUY_LIMIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token1Balance: BigNumber = await token1.balanceOf(user1.address);
        let approveTx = await token1.connect(user1).approve(
            LimitOrdersControllerInstance.address, token1Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick - tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount0FromAmount1(
            token1Balance, 
            usableTick, 
            usableTick - tickSpacing 
        );
        // Create filter.
        const filter = LimitOrdersControllerInstance.filters.CreateOrder(user1.address);
        const balanceBefore: BigNumber = await token0.balanceOf(LimitOrdersControllerInstance.address);
        let createBuyLimitTx = await (LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: 0,
                tickUpper: usableTick,
                amountOfToken0: 0,
                amountOfToken1: token1Balance,
                recievedAmountOfToken0: receivedAmount,
                recievedAmountOfToken1: 0,
                deadline: 2e10,
                orderType: 1
            },
            {
                value: executionFee
            }
        )); 
        await createBuyLimitTx.wait();
        // Get tokenId.
        await timeMachine.advanceBlock();
        const balanceAfter: BigNumber = await token0.balanceOf(LimitOrdersControllerInstance.address);
        expect((balanceAfter.sub(balanceBefore)).eq(ethers.constants.Zero))
        let txs: Array<CreateOrderEvent> = await LimitOrdersControllerInstance.queryFilter(filter);
        let tokenId: BigNumber = txs[txs.length - 1].args.tokenId;
        // Get order.
        // Check stored data in our contract.
        let order = await LimitOrdersControllerInstance.orders(poolAddress, tokenId);
        expect(order.owner.toLowerCase()).equal(user1.address.toLowerCase());
        expect(order.token0.toLowerCase()).equal((await pool.token0()).toLowerCase());
        expect(order.token1.toLowerCase()).equal((await pool.token1()).toLowerCase());
        expect(order.tickLower).equal(usableTick - tickSpacing);
        expect(order.tickUpper).equal(usableTick);
        expect(order.amountOfToken0.toString()).equal(ethers.constants.Zero.toString());
        expect(order.amountOfToken1.toString()).equal(token1Balance.toString());
        expect(order.recievedAmount.toString()).equal(receivedAmount.toString());
        expect(order.orderType).equal(1);
        
        let position = await nftPositionManager.positions(tokenId);
        expect(position.operator.toLowerCase()).equal(ethers.constants.AddressZero);
        expect(position.token0.toLowerCase()).equal(order.token0.toLowerCase());
        expect(position.token1.toLowerCase()).equal(order.token1.toLowerCase());
        expect(position.fee).equal(order.fee);
        expect(position.tickLower).equal(order.tickLower);
        expect(position.tickUpper).equal(order.tickUpper);
        expect(position.liquidity.toString()).equal(order.liquidity.toString());
    });
    it("Should create TAKE_PROFIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Balance, 
            usableTick, 
            usableTick + tickSpacing 
        );
        // Create filter.
        const filter = LimitOrdersControllerInstance.filters.CreateOrder(user1.address);
        // Check that Uniswap take all.
        const balanceBefore: BigNumber = await token0.balanceOf(LimitOrdersControllerInstance.address);
        let createBuyLimitTx = await (LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: token0Balance,
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: receivedAmount,
                deadline: 2e10,
                orderType: 0
            },
            {
                value: executionFee
            }
        )); 
        await createBuyLimitTx.wait();
        // Get tokenId.
        await timeMachine.advanceBlock();
        const balanceAfter: BigNumber = await token0.balanceOf(LimitOrdersControllerInstance.address);
        expect((balanceAfter.sub(balanceBefore)).eq(ethers.constants.Zero))
        let txs: Array<CreateOrderEvent> = await LimitOrdersControllerInstance.queryFilter(filter);
        let tokenId: BigNumber = txs[txs.length - 1].args.tokenId;
        // Get order.
        // Check stored data in our contract.
        let order = await LimitOrdersControllerInstance.orders(poolAddress, tokenId);
        expect(order.owner.toLowerCase()).equal(user1.address.toLowerCase());
        expect(order.token0.toLowerCase()).equal((await pool.token0()).toLowerCase());
        expect(order.token1.toLowerCase()).equal((await pool.token1()).toLowerCase());
        expect(order.tickLower).equal(usableTick);
        expect(order.tickUpper).equal(usableTick + tickSpacing);
        expect(order.amountOfToken0.toString()).equal(token0Balance.toString());
        expect(order.amountOfToken1.toString()).equal(ethers.constants.Zero.toString());
        expect(order.recievedAmount.toString()).equal(receivedAmount.toString());
        expect(order.orderType).equal(0);
        
        let position = await nftPositionManager.positions(tokenId);
        expect(position.operator.toLowerCase()).equal(ethers.constants.AddressZero);
        expect(position.token0.toLowerCase()).equal(order.token0.toLowerCase());
        expect(position.token1.toLowerCase()).equal(order.token1.toLowerCase());
        expect(position.fee).equal(order.fee);
        expect(position.tickLower).equal(order.tickLower);
        expect(position.tickUpper).equal(order.tickUpper);
        expect(position.liquidity.toString()).equal(order.liquidity.toString());
    });
    it("Should create 2 TAKE_PROFIT order.", async () => {
        const poolAddress: Address["address"] = await uniV3Factory.getPool(
            token0Address,
            token1Address,
            fee
        );
        const pool = await ethers.getContractAt(
            'IUniswapV3Pool', 
            poolAddress
        ) as IUniswapV3Pool;
        // Get data.
        const slot0 = await pool.slot0();
        const tickSpacing: number = await pool.tickSpacing();
        // Approve tokens.
        let token0Balance: BigNumber = await token0.balanceOf(user1.address);
        let token0Trade1: BigNumber = token0Balance.div(2);
        let token0Trade2: BigNumber = token0Balance.sub(token0Trade1);
        let approveTx = await token0.connect(user1).approve(
            LimitOrdersControllerInstance.address, token0Balance
        );
        await approveTx.wait();
        // Calculate true tick.
        let usableTick: number = nearestUsableTick(
            slot0.tick + tickSpacing, 
            BigNumber.from(tickSpacing).toNumber()
        );
        // Calculate receivedAmount.
        const receivedAmount: BigNumber = await LimitOrdersControllerInstance.getAmount1FromAmount0(
            token0Trade1, 
            usableTick, 
            usableTick + tickSpacing 
        );
        // Create filter.
        const filter = LimitOrdersControllerInstance.filters.CreateOrder(user1.address);
        // Check that Uniswap take all.
        const balanceBefore1: BigNumber = await token0.balanceOf(LimitOrdersControllerInstance.address);
        let createBuyLimitTx1 = await (LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: token0Trade1,
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: receivedAmount,
                deadline: 2e10,
                orderType: 0
            },
            {
                value: executionFee
            }
        )); 
        await createBuyLimitTx1.wait();
        // Get tokenId.
        await timeMachine.advanceBlock();
        const balanceAfter1: BigNumber = await token0.balanceOf(LimitOrdersControllerInstance.address);
        expect((balanceAfter1.sub(balanceBefore1)).eq(ethers.constants.Zero))
        let txs1: Array<CreateOrderEvent> = await LimitOrdersControllerInstance.queryFilter(filter);
        let tokenId1: BigNumber = txs1[txs1.length - 1].args.tokenId;
        // Get order.
        // Check stored data in our contract.
        let order1 = await LimitOrdersControllerInstance.orders(poolAddress, tokenId1);
        expect(order1.owner.toLowerCase()).equal(user1.address.toLowerCase());
        expect(order1.token0.toLowerCase()).equal((await pool.token0()).toLowerCase());
        expect(order1.token1.toLowerCase()).equal((await pool.token1()).toLowerCase());
        expect(order1.tickLower).equal(usableTick);
        expect(order1.tickUpper).equal(usableTick + tickSpacing);
        expect(order1.amountOfToken0.toString()).equal(token0Trade1.toString());
        expect(order1.amountOfToken1.toString()).equal(ethers.constants.Zero.toString());
        expect(order1.recievedAmount.toString()).equal(receivedAmount.toString());
        expect(order1.orderType).equal(0);
        
        let position1 = await nftPositionManager.positions(tokenId1);
        expect(position1.operator.toLowerCase()).equal(ethers.constants.AddressZero);
        expect(position1.token0.toLowerCase()).equal(order1.token0.toLowerCase());
        expect(position1.token1.toLowerCase()).equal(order1.token1.toLowerCase());
        expect(position1.fee).equal(order1.fee);
        expect(position1.tickLower).equal(order1.tickLower);
        expect(position1.tickUpper).equal(order1.tickUpper);
        expect(position1.liquidity.toString()).equal(order1.liquidity.toString());

        const balanceBefore2: BigNumber = await token0.balanceOf(LimitOrdersControllerInstance.address);
        let createBuyLimitTx2 = await (LimitOrdersControllerInstance.connect(user1).createOrder(
            {
                fee: fee,
                token0: token0Address,
                token1: token1Address,
                tickLower: usableTick,
                tickUpper: 0,
                amountOfToken0: token0Trade2,
                amountOfToken1: 0,
                recievedAmountOfToken0: 0,
                recievedAmountOfToken1: receivedAmount,
                deadline: 2e10,
                orderType: 0
            },
            {
                value: executionFee
            }
        )); 
        await createBuyLimitTx2.wait();
        // Get tokenId.
        await timeMachine.advanceBlock();
        const balanceAfter2: BigNumber = await token0.balanceOf(LimitOrdersControllerInstance.address);
        expect((balanceAfter2.sub(balanceBefore2)).eq(ethers.constants.Zero))
        let txs2: Array<CreateOrderEvent> = await LimitOrdersControllerInstance.queryFilter(filter);
        let tokenId: BigNumber = txs2[txs2.length - 1].args.tokenId;
        // Get order.
        // Check stored data in our contract.
        let order2 = await LimitOrdersControllerInstance.orders(poolAddress, tokenId);
        expect(order2.owner.toLowerCase()).equal(user1.address.toLowerCase());
        expect(order2.token0.toLowerCase()).equal((await pool.token0()).toLowerCase());
        expect(order2.token1.toLowerCase()).equal((await pool.token1()).toLowerCase());
        expect(order2.tickLower).equal(usableTick);
        expect(order2.tickUpper).equal(usableTick + tickSpacing);
        expect(order2.amountOfToken0.toString()).equal(token0Trade2.toString());
        expect(order2.amountOfToken1.toString()).equal(ethers.constants.Zero.toString());
        expect(order2.recievedAmount.toString()).equal(receivedAmount.toString());
        expect(order2.orderType).equal(0);
        
        let position2 = await nftPositionManager.positions(tokenId);
        expect(position2.operator.toLowerCase()).equal(ethers.constants.AddressZero);
        expect(position2.token0.toLowerCase()).equal(order2.token0.toLowerCase());
        expect(position2.token1.toLowerCase()).equal(order2.token1.toLowerCase());
        expect(position2.fee).equal(order2.fee);
        expect(position2.tickLower).equal(order2.tickLower);
        expect(position2.tickUpper).equal(order2.tickUpper);
        expect(position2.liquidity.toString()).equal(order2.liquidity.toString());
    });
});
