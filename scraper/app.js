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

const transformFile = ({
  title,
  filesize,
  timestamp,
  filemime,
  download_path,
}) => ({
  title,
  filesize,
  timestamp: new Date(timestamp * 1000),
  filemime,
  downloadLink: download_path.replace('api.', '').replace('/v1', ''),
})

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
  const { section: sections } = await fs.readFile('./private/sections.json', 'utf8')
    .then(JSON.parse)
  const { course_title, section_title } = sections.find(section => section.id === courseId)
  const parent = await fs.readFile(`./private/courses/${courseId}/${path.map(name => name + '/').join('')}items.json`, 'utf8')
    .then(JSON.parse)
  const parentEntry = last
    ? parent['folder-item'].find(item => item.id === +last)
    : parent.self
  if (parentEntry.type !== 'folder') {
    const {
      title,
      body,
      type: itemType,
    } = parentEntry
    const material = await fs.readFile(`./private/courses/${courseId}/${last ? path.join('/') + '/' + last : ''}.json`, 'utf8')
      .then(JSON.parse)
    const {
      attachments: {
        links: { link: links = [] } = {},
        files: { file: files = [] } = {},
      } = {},
      due,
      max_points,
      factor,
      type,
      grade_item_id,
      grading_period,
      last_updated,
      content,
      web_url,
    } = material
    let submissions, submissionComments, gradingPeriod, gradeData
    if (grade_item_id) {
      submissions = await fs.readFile(`./private/courses/${courseId}/${last ? path.join('/') + '/' + last : ''}_submissions.json`, 'utf8')
        .then(JSON.parse)
      submissionComments = await fs.readFile(`./private/courses/${courseId}/${last ? path.join('/') + '/' + last : ''}_submission_comments.json`, 'utf8')
        .then(JSON.parse)
      gradeData = await fs.readFile(`./private/courses/${courseId}/${last ? path.join('/') + '/' + last : ''}_grade.json`, 'utf8')
        .then(JSON.parse)
      // const grades = sectionGrades.find(section => section.section_id === courseId)
      // const period = grades && grades.period.find(period => period.period_id === 'p' + grading_period)
      // if (period) {
      //   gradingPeriod = period.period_title
      //   gradeData = period.assignment.find(assignment => assignment.assignment_id === grade_item_id)
      // }
    }
    let page, pageHtml, pageFiles
    if (itemType === 'page') {
      page = await fs.readFile(`./private/courses/${courseId}/${last ? path.join('/') + '/' + last : ''}_page.json`, 'utf8')
        .then(JSON.parse)
      pageHtml = page.body.replace('<base href="https://app.schoology.com"/>', '')
      pageFiles = page.attachments && page.attachments.files.file.map(transformFile)
    }
    let discussionComments, replies
    if (itemType === 'discussion') {
      discussionComments = await fs.readFile(`./private/courses/${courseId}/${last ? path.join('/') + '/' + last : ''}_comments.json`, 'utf8')
        .then(JSON.parse)
      const repliesById = new Map()
      replies = []
      for (const { id, uid, comment, created, parent_id, likes, user_like_action } of discussionComments.comment) {
        const obj = {
          authorId: uid,
          comment,
          created: new Date(created * 1000),
          isReply: !!parent_id,
          replies: [],
          likes,
          likedByMe: user_like_action,
        }
        repliesById.set(id, obj)
        if (parent_id) {
          repliesById.get(parent_id).replies.push(obj)
        } else {
          replies.push(obj)
        }
      }
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
      files: files.map(transformFile),
      appUrl: web_url && web_url.replace('app.', 'pausd.'),
      submissions: submissions && submissions.revision.map(({
        created,
        late,
        draft,
        attachments: { files: { file: files } },
      }) => ({
        created: new Date(created * 1000),
        late,
        draft,
        files: files.map(transformFile),
      })),
      submissionComments: submissionComments && submissionComments.comment.map(({
        comment,
        created,
      }) => ({
        comment,
        created: new Date(created * 1000),
      })),
      gradingPeriod,
      grade: gradeData,
      albumImages: content && content.map(({
        caption,
        created,
        content_url,
        content_filesize,
        thumbnail_url,
        attachments: { files: { file: files } },
      }) => ({
        caption,
        created:new Date(created * 1000),
        image: content_url,
        fileSize: content_filesize,
        thumbnail: thumbnail_url,
        files: files.map(transformFile),
      })),
      replies,
      pageHtml,
      pageFiles,
      parentEntryJson: JSON.stringify(parentEntry, null, '\t'),
      json: JSON.stringify(material, null, '\t'),
      discussionCommentsJson: JSON.stringify(discussionComments, null, '\t'),
      pageJson: JSON.stringify(page, null, '\t'),
      submissionsJson: submissions && JSON.stringify(submissions, null, '\t'),
      submissionCommentsJson: submissionComments && JSON.stringify(submissionComments, null, '\t'),
      gradesJson: gradeData && JSON.stringify(gradeData, null, '\t'),
    })
    return
  }
  const folder = await fs.readFile(`./private/courses/${courseId}/${last ? path.join('/') + '/' + last : ''}/items.json`, 'utf8')
    .then(JSON.parse)
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
