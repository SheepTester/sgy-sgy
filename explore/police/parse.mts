// node explore/police/parse.ts

import { getDocument, VerbosityLevel } from 'pdfjs-dist'

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

export type Report = {
  type: string
  location: string
  dateReported: string
  incidentCaseNum: string
  dateOccurred: string
  timeOccurred: string
  summary: string
  disposition: string
}

const FIELDS = [
  'Date Reported',
  'Incident/Case#',
  'Date Occurred',
  'Time Occurred',
  'Summary',
  'Disposition'
]

const BASE_URL =
  'https://www.police.ucsd.edu/docs/reports/CallsandArrests/CallsForService/'

export async function getReports (fileName: string): Promise<Report[]> {
  const reports: Report[] = []
  const pdf = await getDocument({
    url: `${BASE_URL}/${fileName}`,
    useSystemFonts: true,
    verbosity: VerbosityLevel.ERRORS
  }).promise
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

    let text = ''
    let lastObject: TextObject | null = null
    for (const object of textObjects) {
      if (object.content.trim().length === 0) {
        text += object.content
        continue
      }
      if (lastObject) {
        if (lastObject.y - object.y > 0.1) {
          // New line
          text += '\n'
        } else if (object.x - (lastObject.x + lastObject.width) > 3) {
          // Horizontal space
          text += '\t'
        }
      }
      text += object.content
      lastObject = object
    }

    const pageText = text
      .trim()
      .split(/\t|\n/)
      .map(content => content.trim())

    if (
      pageText[0] === 'UCSD POLICE DEPARTMENT' &&
      pageText[1] === 'CRIME AND FIRE LOG/MEDIA BULLETIN'
    ) {
      // pageText[2] is the date
      pageText.splice(0, 3)
    } else {
      console.error(pageText)
      throw new Error(`${fileName}: page ${i} does not start with UCPD header`)
    }

    const indices: number[] = []
    for (const [i, content] of pageText.entries()) {
      if (content === 'Date Reported') {
        indices.push(i - 2)
      }
    }

    if (indices[0] > 0) {
      // More text before first crime on page. This only happens for Sun God
      // (e.g. May 3, 2025)
      console.warn(
        `${fileName}: text before first crime on page:`,
        indices,
        'adding this text to last disposition'
      )
      if (reports.length > 0) {
        const lastReport = reports[reports.length - 1]
        lastReport.disposition += ' ' + pageText.slice(0, indices[0]).join(' ')
      } else {
        throw new Error(`${fileName}: text before first crime`)
      }
    }

    for (let i = 0; i < indices.length; i++) {
      const start = indices[i]
      const end = indices[i + 1] ?? pageText.length
      const parts: string[][] = []
      let j = start
      for (const field of FIELDS) {
        const fieldStart = j
        for (; j < end; j++) {
          // Sometimes they forget the colon after "Disposition"
          if (pageText[j] === field || pageText[j] === field + ':') {
            break
          }
        }
        parts.push(pageText.slice(fieldStart, j))
        j++
      }
      parts.push(pageText.slice(j, end))
      const [
        dateReported,
        incidentCaseNum,
        dateOccurred,
        timeOccurred,
        summary,
        disposition
      ] = parts.slice(1).map(segments => segments.join(' '))
      reports.push({
        type: pageText[start],
        location: pageText[start + 1],
        dateReported,
        incidentCaseNum,
        dateOccurred,
        timeOccurred,
        summary,
        disposition
      })
    }
  }
  if (reports.length === 0) {
    throw new Error(`No reports found in ${fileName}. Something went wrong.`)
  }
  return reports
}

// console.log(await getReports('July 25, 2024 UPDATED.pdf'))
