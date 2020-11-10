const { apiBase, sgyDomain } = require('./constants.js')
const oauth = require('./oauth.js')

const accessTokenKey = 'mcDonalds'
const accessSecretKey = 'wendys'
const requestTokenKey = 'burgerKing'
const userIdKey = 'inNOut'

// request token -> request secret
const requestTokens = new Map()

module.exports = async (req, res, next) => {
  if (req.method === 'GET') {
    const tokenKey = req.session[accessTokenKey]
    const oauthToken = req.query.oauth_token

    if (!tokenKey) {
      // Authenticate user
      if (oauthToken) {
        // The user has returned from Schoology with an OAuth token
        const requestToken = req.session[requestTokenKey]
        if (!requestToken) {
          return res
            .status(401)
            .send(
              "Your client seemed to have forgotten that you were signing into Schoology. (The cookies didn't save.)"
            )
        }
        if (requestToken.key !== oauthToken) {
          return res
            .status(401)
            .send('Are you tampering with requests? Schoology thinks you are.')
        }
        const [key, secret] = await oauth.getOAuthAccessToken(
          requestToken.key,
          requestToken.secret
        )
        req.session[accessTokenKey] = key
        req.session[accessSecretKey] = secret
        delete req.session[requestTokenKey]
        requestTokens.delete(requestToken)
        // The oauth_token URL parameter is removed below

        const { uid } = await oauth
          .get(`${apiBase}/users/me`, key, secret)
          .catch(oauth.follow303)
          .then(oauth.toJson)
          .catch(err => {
            if (err.statusCode === 401) {
              // Token expired
              return { uid: null }
            } else {
              return Promise.reject(err)
            }
          })
        if (uid) {
          delete req.session[accessTokenKey]
          delete req.session[accessSecretKey]
          return res
            .status(401)
            .send('The Schoology token it gave me for you has expired. :(')
        }
        req.session[userIdKey] = uid
      } else {
        // Redirect the user to Schoology to let them authorize me access to
        // their accounts
        const [requestKey, requestSecret] = await oauth.getOAuthRequestToken()
        requestTokens.set(requestKey, requestSecret)
        req.session[requestTokenKey] = requestKey
        // https://stackoverflow.com/a/10185427
        const fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl
        return res.redirect(
          `${sgyDomain}/oauth/authorize?${new URLSearchParams({
            oauth_callback: fullUrl,
            oauth_token: oauth.key
          })}`
        )
      }
    }

    // Regardless of whether the user has been authenticated, remove the
    // oauth_token parameter from the URL.
    if (oauthToken) {
      delete req.query.oauth_token
      return res.redirect('?' + new URLSearchParams(req.query))
    }
  }
  const {
    [accessTokenKey]: key,
    [accessSecretKey]: secret,
    [userIdKey]: uid
  } = req.session
  req.schoology = {
    userId: uid,
    get: path => oauth.get(apiBase + path, key, secret).then(oauth.toJson)
  }
  next()
}
