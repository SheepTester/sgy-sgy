// tsx explore/police/display.ts
import { readFile } from 'fs/promises'
import { Report } from './parse.mjs'

const colors = process.stdout.isTTY && !process.env.NO_COLOR
const bold = (str: string) => (colors ? `\x1b[1;97m${str}\x1b[0m` : str)
const grey = (str: string) => (colors ? `\x1b[2m${str}\x1b[0m` : str)

const REPORTS_PATH = new URL('./reports.json', import.meta.url)

const reports: Report[] = await readFile(REPORTS_PATH, 'utf-8').then(JSON.parse)

for (const {
  type,
  location,
  dateOccurred,
  timeOccurred,
  summary,
  disposition
} of reports) {
  console.log(`${bold(type)}${summary ? ': ' : ''}${summary}`)
  if (disposition) {
    console.log(`Result: ${disposition}`)
  }
  console.log(grey(`${dateOccurred} ${timeOccurred} · ${location}`))
  console.log()
}
