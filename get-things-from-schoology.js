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

askSgy(base + '/group/553683519/updates', {
  body: 'Epic<h1>EPIC</h1><trans>.lol',
  "attachments": [
    {
      "type": "link",
      "title": "<h1>epic</h1>",
      "url": "https:\/\/www.example.com"
    }
  ]
})
  .then(async body => {
    const { id } = JSON.parse(body)
    for (let i = 0; i < 10; i++) {
      await askSgy(base + '/group/553683519/updates/' + id + '/comments', {
        comment: `ok ${i}er`,
        uid: '2017219'
      })
    }
  })
