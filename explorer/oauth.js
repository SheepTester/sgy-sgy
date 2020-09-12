const { OAuth } = require('oauth')
const { key, secret } = require('../api-creds.json')
const { apiBase, sgyDomain } = require('./constants.js')

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

// node-oauth uses callbacks >:(
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

module.exports = {
  toJson,
  getOAuthRequestToken: promiseify(oauth.getOAuthRequestToken.bind(oauth)),
  getOAuthAccessToken: promiseify(oauth.getOAuthAccessToken.bind(oauth)),
  get: promiseify(oauth.get.bind(oauth)),
  post: promiseify(oauth.post.bind(oauth)),
  put: promiseify(oauth.put.bind(oauth)),
  delete: promiseify(oauth.delete.bind(oauth))
}
