// node explorer/app.js

const express = require('express')
const app = express()
const port = 3000

// app.set('views', __dirname + '/views');
// app.set('view engine', 'jsx');
// app.engine('jsx', require('express-react-views').createEngine())

const YAML = require('yaml')
const fs = require('fs/promises')
const path = require('path')
const checkSgyApiShape = require('./check-shape.js')
let apiData

const { apiBase, sgyDomain } = require('./constants.js')
const oauth = require('./oauth.js')

app.get('/', (req, res) => {
  res.send('hi')
})

async function main () {
  apiData = YAML.parse(
    await fs.readFile(path.resolve(__dirname, './sgy-api.yml'), 'utf8'),
    { prettyErrors: true }
  )
  const problems = checkSgyApiShape(apiData)
  console.log(problems || apiData)
  app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
  })
}
main()
