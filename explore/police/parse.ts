// tsx explore/police/parse.ts

import { readFile } from 'fs/promises'
import { getDocument } from 'pdfjs-dist'

const pdf = await getDocument({
  // idk why pdf.js doesn't allow Buffer
  data: new Uint8Array(
    await readFile('/mnt/c/Users/seant/Downloads/OVERWRITE ME.pdf')
  )
}).promise
const page = await pdf.getPage(1)
const { items } = await page.getTextContent()
type TextObject = {
  content: string
  // probably not very useful
  hasEol: boolean
  x: number
  /** +y is up */
  y: number
}
const text = items
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
console.log(text.map(t => t.content))
