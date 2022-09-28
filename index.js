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
