// node zoom/get-me.js [type]

const { refreshToken, withToken } = require('./utils.js')

const paths = {
  me: '/users/me',
  token: '/users/me/token',
  settings: '/users/me/settings',
  meetings: '/users/me/meetings',
  webinars: '/users/me/webinars',
  recordings: '/users/me/recordings',
  assistants: '/users/me/assistants'
}

async function main () {
  const [type] = process.argv.slice(2)
  const token = await refreshToken()
  if (paths[type]) {
    console.log(await withToken(paths[type], {}, token))
  } else {
    console.error('type should be one of', Object.keys(paths))
  }
}
main()
