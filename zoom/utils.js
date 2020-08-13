const { clientId, clientSecret, redirect } = require('./credentials.json')
const fetch = require('node-fetch')
const fs = require('fs/promises')
const path = require('path')

function toBase64 (str) {
  return Buffer.from(str).toString('base64')
}

function api (path, paramObj, authType, method = 'GET') {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(paramObj)) {
    params.set(key, value)
  }
  return fetch(path + '?' + params, {
    method,
    headers: {
      Authorization: authType === 'basic'
        ? `Basic ${toBase64(clientId + ':' + clientSecret)}`
        : `Bearer ${authType}`
    }
  })
    .then(
      async r => r.ok
        ? r.text()
        : Promise.reject(new Error(r.status + ' ' + await r.text()))
    )
    .then(text => {
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    })
}

async function getTokens (code) {
  const json = await api('https://zoom.us/oauth/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirect
  }, 'basic', 'POST')
  return {
    token: json.access_token,
    refreshToken: json.refresh_token
  }
}

function revokeToken (accessToken) {
  return api('https://zoom.us/oauth/revoke', {
    token: accessToken
  }, 'basic', 'POST')
}

function withToken (path, params, token, method) {
  return api('https://api.zoom.us/v2' + path, params, token, method)
}

async function refreshTokens (refreshToken) {
  const json = await api('https://zoom.us/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  }, 'basic', 'POST')
  return {
    token: json.access_token,
    refreshToken: json.refresh_token
  }
}

const refreshTokenPath = path.resolve(__dirname, './refresh-token.txt')

async function getToken (code) {
  const { token, refreshToken } = await getTokens(code)
  await fs.writeFile(refreshTokenPath, refreshToken)
  return token
}

async function refreshToken () {
  const oldRefreshToken = await fs.readFile(refreshTokenPath, 'utf-8')
  const { token, refreshToken: newRefreshToken } = await refreshTokens(oldRefreshToken)
  await fs.writeFile(refreshTokenPath, newRefreshToken)
  return token
}

module.exports = {
  getToken,
  refreshToken,
  revokeToken,
  withToken
}
