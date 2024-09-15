// tsx explore/police/parse.ts

import { readFile } from 'fs/promises'
import { getDocument, VerbosityLevel } from 'pdfjs-dist'
import { arrayEqual } from '../../lib/comp'

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

const fields = [
  'Date Reported',
  'Incident/Case#',
  'Date Occurred',
  'Time Occurred',
  'Summary',
  'Disposition'
]

const reports: Report[] = []

const pdf = await getDocument({
  // idk why pdf.js doesn't allow Buffer
  data: new Uint8Array(
    await readFile('/mnt/c/Users/seant/Downloads/OVERWRITE ME.pdf')
  ),
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
    !arrayEqual(pageText.splice(0, 3), [
      'UCSD POLICE DEPARTMENT',
      'CRIME AND FIRE LOG/MEDIA BULLETIN',
      'SEPTEMBER 9, 2024'
    ])
  ) {
    throw new Error('page does not start with UCPD header')
  }

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
    for (const field of fields) {
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

console.log(reports)
