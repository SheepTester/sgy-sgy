// node explorer/app.js

const express = require('express')
const app = express()
const port = 10068 // TODO: set from command line argument/envvar?

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

const docLink = '<a href="https://sheeptester.gitlab.io/test/schoology-rest-api.html">Schoology REST API documentation</a>'

app.get('/', async (req, res) => {
  const uid = req.schoology.userId
  const apiResult = await req.schoology.get(`/users/${uid}/sections`)
  if (!apiResult) return res.status(401).send('token expired')
  res.send(
    `${docLink}<h4>Courses</h4><ul>${apiResult.section
      .map(
        section => `<li>${section.course_title}: ${section.section_title}</li>`
      )
      .join('') || '<li>No courses were found for this user.</li>'}</ul>`
  )
})

app.use('/api', async (req, res, next) => {
  if (req.method === 'GET') {
    try {
      res.send(await req.schoology.get(req.url))
    } catch ({ statusCode, data }) {
      res.status(statusCode).send(data || statusCode)
    }
  } else {
    next()
  }
})

app.get('/test/discussions-and-albums', async (req, res) => {
  const { domain } = req.query
  if (!domain) return res.status(400).send('add ?domain=pausd or smth to the url')
  const uid = req.schoology.userId
  const { section: sections } = await req.schoology.get(`/users/${uid}/sections`)
  const links = []
  for (const { id: sectionId, course_title } of sections) {
    const { album: albums } = await req.schoology.get(`/sections/${sectionId}/albums`)
    links.push(...albums.map(({ id, title }) => [`https://${domain}.schoology.com/album/${id}`, `${course_title} (album): ${title}`]))
    const { discussion: discussions } = await req.schoology.get(`/sections/${sectionId}/discussions`)
    links.push(...discussions.map(({ id, title }) => [`https://${domain}.schoology.com/course/${sectionId}/materials/discussion/view/${id}`, `${course_title} (discussion): ${title}`]))
  }
  res.send(
    `<ul>${links.map(([url, text]) => `<li><a href="${url}">${text}</a></li>`).join('')}</ul>`
  )
})

app.use((err, req, res, next) => {
  res.status(500).send({ url: req.originalUrl, sad: 'brain hurt', problem: err.message, history: err.stack })
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
