// node explorer/app.js

const express = require('express')
const app = express()
const port = 3000

const nodePath = require('path')
app.set('views', nodePath.resolve(__dirname, './views'))
// app.set('view engine', 'jsx');
// app.engine('jsx', require('express-react-views').createEngine())
app.set('view options', {
  rmWhitespace: true
})
app.set('view engine', 'ejs')

const cookieSession = require('cookie-session')
app.use(
  cookieSession({
    name: 'session',
    keys: ['key1', 'key2']
  })
)

app.use(require('./sgy-oauth-middleware.js'))

const YAML = require('yaml')
const fs = require('fs/promises')
const path = require('path')
const checkSgyApiShape = require('./check-shape.js')
let apiData

app.get('/', async (req, res) => {
  const uid = req.schoology.userId
  const apiResult = await req.schoology.get(`/users/${uid}/sections`)
  res.send(
    `<h4>Courses</h4><ul>${apiResult.section
      .map(
        section => `<li>${section.course_title}: ${section.section_title}</li>`
      )
      .join('') || '<li>No courses were found for this user.</li>'}</ul>`
  )
})

app.use('/api', async (req, res, next) => {
  if (req.method === 'GET') {
    try {
      res.send(await req.schoology.get(req.path))
    } catch ({ statusCode, data }) {
      res.status(statusCode).send(data)
    }
  } else {
    next()
  }
})

async function main () {
  apiData = YAML.parse(
    await fs.readFile(path.resolve(__dirname, './sgy-api.yml'), 'utf8'),
    { prettyErrors: true }
  )
  const problems = checkSgyApiShape(apiData)
  console.log(problems || 'Schoology API documentation looks good!')
  app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
  })
}
main()
