// node zoom/start.js <authorization code>

const { getToken } = require('./utils.js')

async function main () {
  const [code] = process.argv.slice(2)
  await getToken(code)
  console.log('Done.')
}
main()
