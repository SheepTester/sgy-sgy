// node explorer/docs-app.js

const express = require('express')
const app = express()
const port = 10068

const nodePath = require('path')

app.set('view engine', 'ejs')
app.set('view options', {
  rmWhitespace: true
})
app.set('views', nodePath.resolve(__dirname, './views'))

function dashify (str = '') {
  return str.toLowerCase().replace(/\s+/g, '-')
}

const docs = require('yaml').parse(
  require('fs').readFileSync(
    nodePath.resolve(__dirname, './sgy-api.yml'),
    'utf-8'
  )
)

app.get('/', (req, res) => {
  res.render('docs', { ...docs, dashify })
})

app.listen(port, () => {
  console.log(`See documentation at http://localhost:${port}`)
})
