// Requires students.json from
// https://github.com/SheepTester/hello-world/blob/master/test/schoology-get-seniors.js

import { cachePath, AnticipatedHttpError } from './cache.ts'
import * as html from './html-maker.ts'
import { expect, parseHtml, shouldBeElement } from './utilts.ts'

// `null` if plain text, a string prefix for links
const infoTypes: Record<string, string | null> = {
  Bio: null,
  Activities: null,
  Interests: null,
  Email: 'mailto:',
  Phone: 'tel:',
  Website: '',
  // Staff only
  'Subjects taught': null,
  'Levels Taught': null,
  Position: null,
}

type Student = {
  /** As in https://pausd.schoology.com/user/{} */
  id: number
  name: string
  /**
   * Get big profile picture at
   * https://asset-cdn.schoology.com/system/files/imagecache/profile_big/pictures/picture-{}
   */
  pfp: string
}

export type StudentInfo = {
  name: string
  pfpUrl: string
  schools: string[]
  info: Record<string, string | { url: string; text: string }[]>
}

export async function getStudentInfo (id: number): Promise<StudentInfo | null> {
  const profile = await cachePath(`/user/${id}/info`, 'html', {
    allow403: true,
  })
    .then(parseHtml)
    .catch(err =>
      err instanceof AnticipatedHttpError ? null : Promise.reject(err),
    )
  if (profile) {
    const data: Record<string, string | { url: string; text: string }[]> = {}
    for (const rowNode of profile.querySelectorAll('.info-tab tr')) {
      const row = shouldBeElement(rowNode)
      if (row.querySelector('.profile-header')) {
        // Ignore headers
        continue
      }
      const [infoTypeTh, infoBody] = row.children
      const infoType = infoTypeTh.textContent
      if (infoType in infoTypes) {
        const protocol = infoTypes[infoType]
        if (protocol === null) {
          data[infoType] = infoBody.textContent
        } else {
          const links = []
          for (const a of infoBody.querySelectorAll('a')) {
            const link = shouldBeElement(a).textContent
            links.push({ url: protocol + link, text: link })
          }
          data[infoType] = links
        }
      } else {
        console.warn(`What is ${infoType}?`)
      }
    }
    return {
      name: expect(profile.querySelector('.page-title')).textContent,
      pfpUrl: expect(
        profile.querySelector('.profile-picture img')?.getAttribute('src'),
      ),
      schools: Array.from(
        profile.querySelectorAll('.school-name'),
        name => name.textContent,
      ),
      info: data,
    }
  } else {
    return null
  }
}

if (import.meta.main) {
  const students: Student[] = await Deno.readTextFile(
    new URL('./students.json', import.meta.url),
  ).then(JSON.parse)

  if (Deno.args[0] === 'sort') {
    console.log(
      students
        .sort((a, b) => a.id - b.id)
        .map(({ id, name }) => `${id.toString().padStart(9, ' ')} ${name}`)
        .join('\n'),
    )
    Deno.exit()
  }

  const rows: html.Html[] = []

  for (const { id, name, pfp } of students) {
    const info = await getStudentInfo(id)
    const data: html.Html[] = info
      ? Object.entries(info.info).flatMap(([infoType, datum]) => [
          html.dt(infoType),
          ...(Array.isArray(datum)
            ? datum.map(({ url, text }) => html.dd(html.a({ href: url }, text)))
            : [html.dd(datum)]),
        ])
      : []
    rows.push(
      html.tr(
        html.th(
          { scope: 'row' },
          html.h2(
            html.a(
              { href: `https://pausd.schoology.com/user/${id}/info` },
              name,
            ),
          ),
          pfp
            ? html.img({
                src: `https://asset-cdn.schoology.com/system/files/imagecache/profile_big/pictures/picture-${pfp.replace(
                  '_sq',
                  '',
                )}`,
              })
            : html.div({ class: 'square' }),
        ),
        html.td(
          data.length === 0
            ? html.dl(data)
            : html.p(html.em('Profile is private. Cringe.')),
        ),
      ),
    )
  }

  await Deno.writeTextFile(
    './output/students.html',
    html
      .body(
        html.style(
          html.raw(
            [
              'table {',
              'border-collapse: collapse;',
              'white-space: pre-wrap;',
              'word-break: break-word;',
              '}',
              'th, td {',
              'border: 1px solid black;',
              'padding: 5px;',
              '}',
              'th h2 {',
              'margin: 0;',
              '}',
              'th a {',
              'color: black;',
              'text-decoration: none;',
              '}',
              'dt {',
              'font-weight: bold;',
              '}',
              'dd {',
              'margin-left: 40px;',
              '}',
              'img {',
              'height: 100px;',
              '}',
              '.square {',
              'width: 100px;',
              'height: 100px;',
              'background-color: #0677ba;',
              'margin: 0 auto;',
              '}',
            ].join(''),
          ),
        ),
        html.h1('Seniors'),
        html.p(
          'Students obtained from the “Awaiting Reply” list on ',
          html.a(
            { href: 'https://pausd.schoology.com/user/1568031' },
            'Rachael Kaci',
          ),
          '’s ',
          html.a(
            { href: 'https://pausd.schoology.com/event/5116716079/profile' },
            'Summer Career Speaker: Jasmine Wong: The Art and Science of Nursing',
          ),
          '.',
        ),
        html.table(rows),
        html.script(
          html.raw(
            [
              "window.addEventListener('load', () => {",
              'const promise = new Promise(window.requestAnimationFrame)',
              "for (const img of document.querySelectorAll('img')) {",
              'const rect = img.getBoundingClientRect()',
              'promise.then(() => {',
              "img.style.width = rect.width + 'px'",
              '})',
              '}',
              '})',
            ].join(';'),
          ),
        ),
      )
      .html.replace(/&nbsp;/g, ' '),
  )
}
