To change tick you have to use  
    $ npm run tickChange
and specify config

Config description

"desiredTick":
    This is desired tick to achive. In case to close order desired tick whould be "tickUpper" from orders() function for order type 0 (Buy Limit), and "tickLower" for order type 1 (Take Profit).

"poolFee": 
    Fee on Uniswap pool, can be found same as tickLower/Upper - in orders() function.

"token0":
    token0 in uniswap pool, can be found same as tickLower/Upper - in orders() function.

"token1":
    token1 in uniswap pool, can be found same as tickLower/Upper - in orders() function.