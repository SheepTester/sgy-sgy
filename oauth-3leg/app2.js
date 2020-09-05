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
oauth.setClientOptions({
  requestTokenHttpMethod: 'GET',
  accessTokenHttpMethod: 'GET',
  followRedirects: true
})

// node-oauth uses callbacks òAó
function promiseify (fn) {
  return (...args) => new Promise((resolve, reject) => {
    fn(...args, (err, ...out) => {
      if (err) {
        err.args = args
        err.out = out
        console.error(err, out)
        reject(err)
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
// node-oauth only follows 301 and 302 HTTP statuses, but Schoology redirects
// /users/me with a 303 status >_<
function follow303 (err) {
  if (err.statusCode === 303) {
    const [, request] = err.out
    console.log(request.headers.location)
    return oauth.get(request.headers.location, ...err.args.slice(1))
  } else {
    return Promise.reject(err)
  }
}

const requestTokens = new Map()
const accessTokens = new Map()

app.get('/', async (req, res) => {
  // A primitive way of getting the user ID.
  const userId = req.query.whomst
  if (!userId) {
    return res.sendFile('whomst.html', { root: __dirname })
  }

  const token = accessTokens.get(userId)
  const oauthToken = req.query.oauth_token
  if (!token) {
    // Authenticate user
    if (oauthToken) {
      // The user has returned from Schoology with an OAuth token
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
      // Redirect the user to Schoology to let them authorize me access to their
      // accounts
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
  const { uid } = await oauth.get(`${apiBase}/users/me`, key, secret)
    .catch(follow303)
    .then(toJson)
    .catch(err => {
      if (err.statusCode === 401) {
        // Token expired
        accessTokens.delete(userId)
        res.status(401).send('token expired :(')
        return {}
      } else {
        return Promise.reject(err)
      }
    })
  if (!uid) return

  // At this point, I should now have access to the user's Schoology
  const apiResult = await oauth.get(`${apiBase}/users/${uid}/sections`, key, secret)
    .then(toJson)
  return res.send(`<h4>Courses</h4><ul>${
    apiResult.section.map(section => {
      return `<li>${section.course_title}: ${section.section_title}</li>`
    }).join('') || '<li>No courses were found for this user.</li>'
  }</ul>`)
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
