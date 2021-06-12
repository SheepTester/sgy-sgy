import { config } from 'https://deno.land/x/dotenv@v2.0.0/mod.ts'
import { DOMParser, HTMLDocument } from 'https://deno.land/x/deno_dom@v0.1.12-alpha/deno-dom-wasm.ts'

const env = config({ safe: true })

// '61db7d00d28d332758e01dd6ef4e88e9' is the md5 hash of 'pausd.schoology.com'
const cookie = `SESS61db7d00d28d332758e01dd6ef4e88e9=${env['SESS']}`

const options = { headers: { cookie } }

function parseHtml (html: string): HTMLDocument {
  const document = new DOMParser().parseFromString(html, 'text/xml')
  if (!document) {
    throw new Error('document from parsed HTML is null')
  }
  return document
}

fetch('https://pausd.schoology.com/course/2772299201/materials?ajax=1', options)
  .then(r => r.json())
  .then(parseHtml)
  .then(document => {
    console.log(document)
  })
