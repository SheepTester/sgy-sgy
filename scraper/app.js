const fs = require('fs/promises')
const nodePath = require('path')

const express = require('express')

async function dirsInDir (path) {
  // https://stackoverflow.com/a/24594123
  const items = await fs.readdir(path, { withFileTypes: true })
  return items
    .filter(item => item.isDirectory())
    .map(dir => dir.name)
}

function asyncHandler (handler) {
  return (req, res, next) => {
    handler(req, res, next).catch(next)
  }
}

const app = express()
const port = 10068

app.set('views', nodePath.resolve(__dirname, './views'))
app.set('view options', {
  rmWhitespace: true,
})
app.set('view engine', 'ejs')

app.get('/', (req, res) => {
  res.sendFile(nodePath.resolve(__dirname, './views/index.html'))
})

app.get('/courses', asyncHandler(async (req, res) => {
  const { section: sections } = JSON.parse(await fs.readFile('./private/sections.json', 'utf8'))
  res.render('courses', {
    courses: sections.map(({ id, course_title, section_title }) => ({
      id,
      title: `${course_title}: ${section_title}`,
    }))
  })
}))

app.get('/courses/*', asyncHandler(async (req, res) => {
  const [courseId, ...path] = req.path
    .split(/\/+/)
    .filter(part => /\d+/.test(part))
  const last = path.pop()
  const { section: sections } = JSON.parse(await fs.readFile('./private/sections.json', 'utf8'))
  const { course_title, section_title } = sections.find(section => section.id === courseId)
  const parent = JSON.parse(
    await fs.readFile(`./private/courses/${courseId}/${path.map(name => name + '/')}items.json`, 'utf8')
  )
  const parentEntry = last
    ? parent['folder-item'].find(item => item.id === +last)
    : parent.self
  if (parentEntry.type !== 'folder') {
    const {
      title,
      body,
    } = parentEntry
    const material = JSON.parse(
      await fs.readFile(`./private/courses/${courseId}/${last ? path.join('/') + '/' + last : ''}.json`, 'utf8')
    )
    const {
      attachments: { links: { link: links = [] } = {} } = {},
      due,
      max_points,
      factor,
      type,
      grade_item_id,
      last_updated,
    } = material
    let submissions
    if (grade_item_id) {
      submissions = JSON.parse(
        await fs.readFile(`./private/courses/${courseId}/${last ? path.join('/') + '/' + last : ''}_submissions.json`, 'utf8')
      )
    }
    res.render('material', {
      courseTitle: `${course_title}: ${section_title}`,
      parentFolder: parent.self.title || `${course_title}: ${section_title}`,
      title,
      description: body,
      links,
      dueDate: due,
      maxPoints: max_points,
      factor,
      type,
      lastUpdated: last_updated && new Date(+last_updated * 1000),
      submissions: submissions && submissions.revision.map(({
        created,
        late,
        draft,
        attachments: { files: { file: files } },
      }) => ({
        created: new Date(created * 1000),
        late,
        draft,
        files: files.map(({
          title,
          filesize,
          timestamp,
          filemime,
          download_path,
          converted_download_path,
        }) => ({
          title,
          filesize,
          timestamp: new Date(timestamp * 1000),
          filemime,
          download_path,
          converted_download_path,
        })),
      })),
      parentEntryJson: JSON.stringify(parentEntry, null, '\t'),
      json: JSON.stringify(material, null, '\t'),
      submissionsJson: submissions && JSON.stringify(submissions, null, '\t'),
    })
    return
  }
  const folder = JSON.parse(
    await fs.readFile(`./private/courses/${courseId}/${last ? path.join('/') + '/' + last : ''}/items.json`, 'utf8')
  )
  const {
    self: { title, body, publish_start, publish_end, color, completed, completion_status },
    'folder-item': items = [],
  } = folder
  res.render('folder', {
    courseTitle: `${course_title}: ${section_title}`,
    topLevel: !last,
    parentFolder: parent.self.title || `${course_title}: ${section_title}`,
    folderTitle: title,
    folderDesc: body,
    publishTimes: `${publish_start}–${publish_end}`,
    colour: color,
    completed: !!completed,
    completionStatus: completion_status,
    items,
    parentEntryJson: JSON.stringify(parentEntry, null, '\t'),
    json: JSON.stringify(folder, null, '\t'),
  })
}))

app.use((req, res, next) => {
  res.status(404).send('<h1>404.</h1>')
})

app.use((err, req, res, next) => {
  res.status(500).render('err', { err })
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
