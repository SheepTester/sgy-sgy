import { readFile, writeFile } from 'fs/promises'
import { getReports, Report } from './parse'

const fileNames = await fetch(
  'https://www.police.ucsd.edu/docs/reports/CallsandArrests/Calls_and_Arrests.asp'
)
  .then(r => r.text())
  .then(html =>
    Array.from(
      html.matchAll(/<option value="CallsForService\/([^.]+.pdf)">/g),
      ([, fileName]) => fileName
    )
  )

const SCRAPED_PATH = new URL('./scraped.json', import.meta.url)
const REPORTS_PATH = new URL('./reports.json', import.meta.url)

const scraped: string[] = await readFile(SCRAPED_PATH, 'utf-8')
  .catch(error => (error.code === 'ENOENT' ? '[]' : Promise.reject(error)))
  .then(JSON.parse)
const reports: Report[] = await readFile(REPORTS_PATH, 'utf-8')
  .catch(error => (error.code === 'ENOENT' ? '[]' : Promise.reject(error)))
  .then(JSON.parse)

for (const fileName of fileNames) {
  if (scraped.includes(fileName)) {
    continue
  }
  reports.push(...(await getReports(fileName)))
  scraped.push(fileName)
  await writeFile(REPORTS_PATH, JSON.stringify(reports, null, 2) + '\n')
  await writeFile(SCRAPED_PATH, JSON.stringify(scraped, null, 2) + '\n')
}
