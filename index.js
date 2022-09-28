require('dotenv').config()
const Web3 = require("web3")
const predictionsABI = require("./ABI/predictions.json")


const web3 = new Web3(new Web3.providers.HttpProvider('https://bsc-dataseed.binance.org'));
const contract = new web3.eth.Contract(predictionsABI, process.env.CONTRACT_ADDRESS)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const state = {
    stopBot: false,
    checked: []
}

async function start() {
    await setUpWeb3()
    await checker()
}
start()

async function setUpWeb3() {
    console.log(`[Init]: Setting up web3 account`)
    try {
        account = await web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY)
        account = await web3.eth.accounts.wallet.add(account);
        console.log(`[Init]: Finished setting up web3 account`, account)
    } catch (e) {
        console.log(`Error: Did you set the privated key in env file`)
        throw e
    }
}
async function checker() {
    console.log(`[Checker]: starting checker`)
    while (!state.stopBot) {
        let liveGame = await getLiveGame()
        //check if processed
        if (!state.checked.includes(liveGame.epoch)) {
            state.checked.push(liveGame.epoch)
            //not processed
            let lag = Math.round((Date.now() - liveGame.startTimestamp) / 1000)
            console.log(`[Checker]: epoch ${liveGame.epoch} Lag: ${lag} seconds`)
            console.log(`[Checker]: epoch ${liveGame.epoch} detection time: ${new Date().toISOString()} actual time: ${new Date(liveGame.startTimestamp).toISOString()}`)

            //then enter trade
            tradeEnter(liveGame)
        }
        await sleep(1000)

    }
    console.log(`[Checker]: Bot stopped`)

}
async function getDirection(liveGame) {
    //TODO IMPORTANT: change the direcion or use you own logic to instruct the bot to make call, you can use the liveGame variable to generate you own trading/betting logic
    console.log(`[Logic]: Please review code and add your trading logic on line:49, remember to remove the exit call`)
    console.log(`[Logic]: Program will now exit`)
    process.exit()

    let last10Games = await getLastGames(10)
    //use last 10 games to help predict next game 
    let direction = "up"
    return direction
}
async function tradeEnter(liveGame) {
    console.log(`[Trade Enter] Start:${new Date().toISOString()}`, liveGame)

    //get block game
    let game = await getBlockchainRound(liveGame.epoch)

    let direction = getDirection()
    let bet = { epoch: game.epoch, game, time: new Date() }

    if (direction == "up") {
        // direction up
        console.log(`[Trade Enter]: Epoch: ${game.epoch} bet bull`)
        await betBull(bet)
    } else {
        // direction down           
        console.log(`[Trade Enter]: Epoch: ${game.epoch} bet bear`)
        await betBear(bet)
    }

}

async function betBear(bet) {
    let stake = process.env.STAKE
    bet.stake = stake
    let secondsLeft = (bet.game.lockTimestamp - Date.now()) / 1000
    console.log(`[BetBear]:${bet.epoch}  BearTime ${new Date().toISOString()}  secondsLeft=${secondsLeft}`, bet)
    let txInfo = await contract.methods.betBear(Number(bet.epoch)).send({
        gas: 200_000,
        gasPrice: web3.utils.toWei(process.env.GAS_PRICE.toString(), "Gwei"),
        from: account.address,
        value: web3.utils.toWei(stake.toString(), "ether")
    })
    console.log(`[BetBear]:End ${bet.epoch} secondsLeft=${secondsLeft}  txInfo`, txInfo)

}

async function betBull(bet) {
    let stake = process.env.STAKE
    bet.stake = stake
    let secondsLeft = (bet.game.lockTimestamp - Date.now()) / 1000
    console.log(`[BetBull]:${bet.epoch} BullTime ${new Date().toISOString()} secondsLeft=${secondsLeft}`, bet)
    let txInfo = await contract.methods.betBull(Number(bet.epoch)).send({
        gas: 200_000,
        gasPrice: web3.utils.toWei(process.env.GAS_PRICE.toString(), "Gwei"),
        from: account.address,
        value: web3.utils.toWei(stake.toString(), "ether")
    })
    console.log(`[BetBull]:End ${bet.epoch} secondsLeft = ${secondsLeft}  txInfo`, txInfo)
}
async function getLiveGame(retries = 2) {
    try {
        let epoch = await contract.methods.currentEpoch().call()
        //get block round
        let round = await getBlockchainRound(epoch)
        return round
    } catch (ex) {
        retries++
        if (retries > 100) {
            throw ex
        } else {
            await sleep(1000 * retries)
            return await getLiveGame(retries)
        }
    }

}
async function getBlockchainRound(epoch) {
    const blockRound = await contract.methods.rounds(epoch).call()
    blockRound.bearAmount = Number(web3.utils.fromWei(blockRound[10], "ether"))
    blockRound.bullAmount = Number(web3.utils.fromWei(blockRound[9], "ether"))
    blockRound.lockPrice = Number(blockRound.lockPrice) / 1e8
    blockRound.closePrice = Number(blockRound.closePrice) / 1e8
    blockRound.total = blockRound.bearAmount + blockRound.bullAmount
    blockRound.bullOdds = blockRound.bearAmount / blockRound.bullAmount
    blockRound.bearOdds = blockRound.bullAmount / blockRound.bearAmount
    blockRound.startTimestamp = Number(blockRound.startTimestamp) * 1000
    blockRound.lockTimestamp = Number(blockRound.lockTimestamp) * 1000
    blockRound.closeTimestamp = Number(blockRound.closeTimestamp) * 1000
    blockRound.lockTime = new Date(blockRound.lockTimestamp)
    blockRound.startTime = new Date(blockRound.startTimestamp)
    return blockRound
}

async function getLastGames(numGames = 10, retries = 2) {
    var data = JSON.stringify({
        query: `query getMarketData{  rounds(orderBy: epoch, orderDirection: desc,first:10) {
                    id
                    epoch
                    position
                    failed
                    previous
                    startAt
                    startBlock
                    startHash
                    lockAt
                    lockBlock
                    lockHash
                    lockPrice
                    lockRoundId
                    closeAt
                    closeBlock
                    closeHash
                    closePrice
                    closeRoundId
                    totalBets
                    totalAmount
                    bullBets
                    bullAmount
                    bearBets
                    bearAmount
                    bets
                }}`,
        variables: {}
    });

    var config = {
        method: 'post',
        url: "https://api.thegraph.com/subgraphs/name/pancakeswap/prediction-v2",
        headers: {
            'accept-language': 'en-US,en;q=0.9',
            'content-type': 'application/json',
            'accept': '*/*',
            'cache-control': 'no-cache',
        },
        data: data
    };
    try {
        var res = await axios(config)
    } catch (ex) {
        console.log("[Subgraph]: Error", ex)
        retries++
        if (retries < 5) {
            await sleep(300)
            return await getLastGames(numGames, retries)
        } else {
            throw ex
        }
    }

    let results = res.data.data.rounds
    //append JS compatible time prototypes
    results.forEach(r => {
        r.startAtH = new Date(Number(r.startAt) * 1000)
        r.closeAtH = new Date(Number(r.closeAt) * 1000)
        r.lockAtH = new Date(Number(r.lockAt) * 1000)
    });

    return results
}
