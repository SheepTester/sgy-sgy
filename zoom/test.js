// node zoom/test.js

const { clientId, clientSecret, redirect, code } = require('./credentials.json')
const fetch = require('node-fetch')

function toBase64 (str) {
  return Buffer.from(str).toString('base64')
}

async function getToken () {
  const params = new URLSearchParams()
  params.set('grant_type', 'authorization_code')
  params.set('code', code)
  params.set('redirect_uri', redirect)
  const json = await fetch('https://zoom.us/oauth/token?' + params, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${toBase64(clientId + ':' + clientSecret)}`
    }
  }).then(async r => r.ok ? r.json() : Promise.reject(new Error(await r.text())))
  console.log(json)
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token
  }
}

async function main () {
  console.log(process.argv.slice(2))
  const { accessToken } = await getToken()
  console.log(await fetch('https://api.zoom.us/v2/users/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  }).then(r => r.json()))
  {
    const params = new URLSearchParams()
    params.set('token', accessToken)
    console.log(await fetch('https://zoom.us/oauth/revoke?' + params, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${toBase64(clientId + ':' + clientSecret)}`
      }
    }).then(r => r.json()))
  }
}
main()
