const colours = require('colors/safe')
const request = require('request')
const crypto = require('crypto')
const OAuth = require('oauth-1.0a')

const { key, secret } = require('./api-creds.json')
const token = { key, secret }

const base = 'https://api.schoology.com/v1'

const oauth = OAuth({
  consumer: token,
  signature_method: 'HMAC-SHA1',
  hash_function (base_string, key) {
    return crypto
      .createHmac('sha1', key)
      .update(base_string)
      .digest('base64')
  }
})

function askSgy (url, body = null, method = body ? 'POST' : 'GET') {
  return new Promise((resolve, reject) => {
    request({
      url,
      method,
      body: body && JSON.stringify(body),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...oauth.toHeader(oauth.authorize({ url, method }))
      }
    }, (err, { statusCode }, body) => {
      if (err) {
        reject(err)
      } else if (Math.floor(statusCode / 100) !== 2) { // outside of 200s range
        reject(new Error(`${colours.red(statusCode)}\n\n${body}`))
      } else {
        resolve(body)
      }
    })
  })
}

askSgy(`${base}/users/2869367/updates`)
  .then(async body => {
    console.log(JSON.parse(body))
  })
