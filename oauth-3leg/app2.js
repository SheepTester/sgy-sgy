// node oauth-3leg/app2.js

const express = require('express')
const app = express()
const port = 3000

const nodeUtil = require('util')

const apiBase = 'https://api.schoology.com/v1'
const sgyDomain = 'https://pausd.schoology.com'

const { key, secret } = require('../api-creds.json')
const { OAuth } = require('oauth')
const oauth = new OAuth(
  `${apiBase}/oauth/request_token`,
  `${apiBase}/oauth/access_token`,
  key,
  secret,
  '1.0',
  null,
  'HMAC-SHA1'
)

// node-oauth uses callbacks òAó
function promiseify (fn) {
  return (...args) => new Promise((resolve, reject) => {
    fn(...args, (err, ...out) => {
      if (err) {
        reject(nodeUtil.inspect(err))
      } else {
        resolve(out)
      }
    })
  })
}

oauth.getOAuthRequestToken = promiseify(oauth.getOAuthRequestToken.bind(oauth))
oauth.getOAuthAccessToken = promiseify(oauth.getOAuthAccessToken.bind(oauth))
oauth.get = promiseify(oauth.get.bind(oauth))

function toJson ([data]) {
  return JSON.parse(data)
}

const requestTokens = new Map()
const accessTokens = new Map()

app.get('/', async (req, res) => {
  const userId = req.query.whomst
  if (!userId) {
    return res.sendFile('whomst.html', { root: __dirname })
  }

  const token = accessTokens.get(userId)
  const oauthToken = req.query.oauth_token
  if (!token) {
    if (oauthToken) {
      const requestToken = requestTokens.get(userId)
      if (!requestToken) {
        return res.status(401).send('"someone\'s tampering with requests" -sgy')
      }
      if (requestToken.key !== oauthToken) {
        return res.status(401).send('"someone\'s tampering with requests" -sgy')
      }
      const [key, secret] = await oauth.getOAuthAccessToken(
        requestToken.key,
        requestToken.secret
      )
      accessTokens.set(userId, { key, secret })
      requestTokens.delete(userId)
      // Remove the oauth_token parameter (see below)
    } else {
      const [key, secret] = await oauth.getOAuthRequestToken()
      requestTokens.set(userId, { key, secret })
      // https://stackoverflow.com/a/10185427
      const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl
      return res.redirect(`${sgyDomain}/oauth/authorize?${new URLSearchParams({
        oauth_callback: fullUrl,
        oauth_token: key
      })}`)
    }
  }

  // Regardless of whether the user has been authenticated, remove the
  // oauth_token parameter from the URL.
  if (oauthToken) {
    delete req.query.oauth_token
    return res.redirect('?' + new URLSearchParams(req.query))
  }

  const { key, secret } = token
  return res.send(await oauth.get(`${apiBase}/users/me`, key, secret))
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
