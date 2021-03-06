'use strict'

require('babel-register')
require("babel-polyfill")
const Eos = require('eosjs')
const math = require('mathjs')
const CHAIN_ID = process.env.CHAIN_ID
const PRIVATE_KEY = process.env.PRIVATE_KEY
const HTTP_ENDPOINT = process.env.HTTP_ENDPOINT
const BP_ACCOUNT = process.env.BP_ACCOUNT


var config = {
  chainId: CHAIN_ID, // 32 byte (64 char) hex string
  keyProvider: [PRIVATE_KEY], // WIF string or array of keys..
  httpEndpoint: HTTP_ENDPOINT,
  expireInSeconds: 60,
  broadcast: true,
  verbose: false, // API activity
  sign: true
}

var eos = Eos(config)

function eosGetTableRows(params) {
  return new Promise(function (resolve, reject) {
    eos.getTableRows(params, (err, res) => {
      if(err) {
        reject(new Error('get Table rows error: ' + err))
      } else {
        resolve(res)
      }
    })
  })
}

const claimrewardsFunc = async function () {
  let lastClaimTime = undefined
  let pervoteBucket = undefined
  let totalProducerVoteWeight = undefined
  let totalVotes = undefined
  let producerPerVotePay = undefined
  let interval = undefined
  const USECONDS_PER_DAY = math.chain(24).multiply(3600).multiply(1000).multiply(1000).done()

  try {
    let producerOfBP = await eosGetTableRows({
      json: true,
      code: 'eosio',
      scope: 'eosio',
      table: 'producers',
      lower_bound: BP_ACCOUNT,
      limit: 1
    })
    totalVotes = producerOfBP.rows[0].total_votes
    lastClaimTime = producerOfBP.rows[0].last_claim_time

    let globalTable = await eosGetTableRows({
      json: true,
      code: 'eosio',
      scope: 'eosio',
      table: 'global',
      limit: 1,
    })
    pervoteBucket = globalTable.rows[0].pervote_bucket
    totalProducerVoteWeight = globalTable.rows[0].total_producer_vote_weight
    producerPerVotePay = math.chain(pervoteBucket).multiply(totalVotes).divide(totalProducerVoteWeight).divide(10000).done()
    interval = math.chain(Date.now()).multiply(1000).subtract(lastClaimTime).subtract(USECONDS_PER_DAY).done()
    // console.log("producerPerVotePay:", producerPerVotePay)
    // console.log("interval:", interval)
    if(interval > 0 && producerPerVotePay > 100) {
      //claimrewards
      eos.transaction({
        actions: [
          {
            account: 'eosio',
            name: 'claimrewards',
            authorization: [{
              actor: BP_ACCOUNT,
              permission: 'owner'
            }],
            data: {
              owner: BP_ACCOUNT,
            }
          }
        ]
      })
    }
  } catch(err) {
    console.log(err)
  }

}

setInterval(claimrewardsFunc, 1000 * 30 ) //10分钟执行一次
