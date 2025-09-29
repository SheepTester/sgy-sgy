// node explore/dei/index.mts

import { getDocument, VerbosityLevel } from 'pdfjs-dist'
import fs from 'fs/promises'

type TextObject = {
  content: string
  /** true when content is empty it seems? I wouldn't count on it though */
  hasEol: boolean
  x: number
  /** +y is up */
  y: number
  width: number
  /** sometimes zero, i think if there's no glyphs */
  height: number
}

const pdf = await getDocument({
  url: 'https://senate.ucsd.edu/media/513521/dei-list-of-courses.pdf',
  useSystemFonts: true,
  verbosity: VerbosityLevel.ERRORS
}).promise

const rawCourses: string[] = []

for (let i = 1; i <= pdf.numPages; i++) {
  const page = await pdf.getPage(i)
  const { items } = await page.getTextContent()
  const textObjects = items
    .filter(item => 'transform' in item)
    .map(
      (item): TextObject => ({
        content: item.str,
        hasEol: item.hasEOL,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height
      })
    )
    .sort(
      // Sort from top to bottom, then left to right
      (a, b) => (Math.abs(a.y - b.y) > 0.1 ? b.y - a.y : a.x - b.x)
    )

  const courseHeading = textObjects.find(o => o.content === 'Course')
  if (!courseHeading) {
    throw new Error('couldnt find course heading')
  }
  let shouldExtend = false
  for (const { content } of textObjects
    .filter(o => Math.abs(o.x - courseHeading.x) < 0.1)
    .slice(1)) {
    if (!content.trim()) {
      continue
    }
    if (shouldExtend || content.match(/^\d/)) {
      rawCourses[rawCourses.length - 1] += content
    } else {
      rawCourses.push(content)
    }
    shouldExtend = content.trimEnd().endsWith('/')
  }
}

const collator = new Intl.Collator('en-US', { numeric: true })

const courses = Object.groupBy(
  rawCourses
    .flatMap(course => course.split(/\s*\/\s*(?=[A-QS-Z])|\s*\(formerly\s*/g))
    .flatMap(course =>
      course.endsWith('/R')
        ? [course.replace('/R', ''), course.replace('/R', 'R')]
        : [course]
    )
    .map(c => c.replace(')', '').replace(/^([A-Z]+)(\d)/, '$1 $2'))
    .filter(c => c && !c.startsWith('(')),
  course => course.split(' ')[0]
)

await fs.writeFile(
  'explore/dei/courses.txt',
  Object.entries(courses)
    .map(
      ([k, v]) =>
        `${k} ${Array.from(
          new Set(v?.map(code => code.split(' ').slice(1).join(' ')))
        )
          .sort(collator.compare)
          .join(', ')}`
    )
    .sort(collator.compare)
    .join(' or\n') + '\n'
)
