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
