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

function fetch (url, method = 'GET') {
  return new Promise((resolve, reject) => {
    request({
      url,
      method,
      headers: {
        'Accept': 'application/json',
        ...oauth.toHeader(oauth.authorize({ url, method }))
      }
    }, (err, response) => {
      if (err) {
        reject(err)
      } else if (response.statusCode !== 200) {
        reject(new Error(`${colours.red(response.statusCode)}\n\n${response.body}`))
      } else {
        resolve(response)
      }
    })
  })
}

fetch(base + '/schools')
  .then(({ body }) => console.log(body))
