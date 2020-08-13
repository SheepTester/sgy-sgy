// node zoom/get-me.js

const { refreshToken, withToken } = require('./utils.js')

async function main () {
  const token = await refreshToken()
  console.log(await withToken('/users/me', {}, token))
}
main()
