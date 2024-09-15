// tsx explore/police/parse.ts

import { getDocument, VerbosityLevel } from 'pdfjs-dist'

type TextObject = {
  content: string
  // probably not very useful
  hasEol: boolean
  x: number
  /** +y is up */
  y: number
}

type Report = {
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

async function getReports (date: Date): Promise<Report[]> {
  const reports: Report[] = []
  const pdf = await getDocument({
    url: `${BASE_URL}/${date.toLocaleString('en-US', {
      dateStyle: 'long',
      timeZone: 'UTC'
    })}.pdf`,
    useSystemFonts: true,
    verbosity: VerbosityLevel.ERRORS
  }).promise
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const { items } = await page.getTextContent()
    const pageText = items
      .filter(item => 'transform' in item)
      .map(
        (item): TextObject => ({
          content: item.str,
          hasEol: item.hasEOL,
          x: item.transform[4],
          y: item.transform[5]
        })
      )
      .sort(
        // Sort from top to bottom, then left to right
        (a, b) => (Math.abs(a.y - b.y) > 0.1 ? b.y - a.y : a.x - b.x)
      )
      .map(t => t.content)
      .filter(content => content.trim().length > 0)

    if (
      pageText[0] !== 'UCSD POLICE DEPARTMENT' &&
      pageText[1] !== 'CRIME AND FIRE LOG/MEDIA BULLETIN'
    ) {
      throw new Error('page does not start with UCPD header')
    }
    pageText.splice(0, 3)

    const indices: number[] = []
    for (const [i, content] of pageText.entries()) {
      if (content === 'Date Reported') {
        indices.push(i - 2)
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
  return reports
}

console.log(await getReports(new Date(Date.UTC(2024, 7, 13))))
