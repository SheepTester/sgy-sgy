// node oauth-3leg/app.js

const express = require('express')
const app = express()
const port = 3000

const fetch = require('node-fetch')
const crypto = require('crypto')
const OAuth = require('oauth-1.0a')

const apiBase = 'https://api.schoology.com/v1'
const sgyDomain = 'https://pausd.schoology.com'

const requestTokens = new Map()
const accessTokens = new Map()

const jsonHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json'
}

const { key, secret } = require('../api-creds.json')
function makeConsumer () {
  return OAuth({
    consumer: { key, secret },
    // nonce_length: 16,
    signature_method: 'HMAC-SHA1',
    hash_function (base_string, key) {
      return crypto
        .createHmac('sha1', key)
        .update(base_string)
        .digest('base64')
    },
    realm: 'Schoology API'
  })
}
const consumer = makeConsumer()
function oauth (url, { method = 'GET', token, auth = consumer } = {}) {
  const headers = auth.toHeader(
    auth.authorize(
      { url, method },
      token && { key: token.tokenKey, secret: token.tokenSecret }
    )
  )
  console.log(headers)
  return headers
}

app.get('/', async (req, res) => {
  if (req.query.whomst) {
    const userId = req.query.whomst
    let token = accessTokens.get(userId)
    if (token) {
      const url = `${apiBase}/users/me`
      const response = await fetch(url, {
        headers: {
          ...jsonHeaders,
          ...oauth(url, { token })
        }
      })
      if (!response.ok) {
        accessTokens.delete(userId)
        return res.status(401).send('token no longer valid :(\n\n' + await response.text())
      }
    } else {
      if (req.query.oauth_token) {
        const requestToken = requestTokens.get(userId)
        if (requestToken.tokenKey !== req.query.oauth_token) {
          return res.status(401).send('"someone\'s tampering with requests" -sgy')
        }
        const url = `${apiBase}/oauth/access_token`
        const apiResult = await fetch(url, {
          headers: {
            ...jsonHeaders,
            ...oauth(url, { token: requestToken })
          }
        })
          .then(r => r.text())
          .then(text => new URLSearchParams(text))
        token = {
          tokenKey: apiResult.get('oauth_token'),
          tokenSecret: apiResult.get('oauth_token_secret')
        }
        accessTokens.set(userId, token)
      } else {
        const url = `${apiBase}/oauth/request_token`
        const result = await fetch(url, {
          headers: { ...jsonHeaders, ...oauth(url) }
        })
          .then(r => r.text())
          .then(text => new URLSearchParams(text))
        const oauthToken = result.get('oauth_token')
        const oauthTokenSecret = result.get('oauth_token_secret')
        requestTokens.set(userId, {
          tokenKey: oauthToken,
          tokenSecret: oauthTokenSecret
        })

        return res.redirect(`${sgyDomain}/oauth/authorize?${new URLSearchParams({
          oauth_callback: `http://localhost:${port}${req.originalUrl}`,
          oauth_token: oauthToken
        })}`)
      }
    }

    const url = `${apiBase}/users/me`
    const json = await fetch(url, {
      headers: {
        ...jsonHeaders,
        ...oauth(url, { token })
      }
    })
      .then(r => r.text())
    res.send(json)
  } else {
    res.sendFile('whomst.html', { root: __dirname })
  }
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
