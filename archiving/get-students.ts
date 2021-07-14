// Requires students.json from
// https://github.com/SheepTester/hello-world/blob/master/test/schoology-get-seniors.js

import { cachePath } from './cache.ts'
import * as html from './html-maker.ts'
import { parseHtml, shouldBeElement } from './utilts.ts'

const infoTypes: Record<string, string | null> = {
  Bio: null,
  Activities: null,
  Interests: null,
  Email: 'mailto:',
  Phone: 'tel:',
  Website: '',
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

const students: Student[] = await Deno.readTextFile(
  new URL('./students.json', import.meta.url),
).then(JSON.parse)

const rows: html.Html[] = []

for (const { id, name, pfp } of students.slice(0, 10)) {
  const profile = await cachePath(`/user/${id}/info`, 'html').then(parseHtml)
  const data: html.Html[] = []
  for (const rowNode of profile.querySelectorAll('.info-tab tr')) {
    const row = shouldBeElement(rowNode)
    if (row.querySelector('.profile-header')) {
      // Ignore headers
      continue
    }
    const [infoType, infoBody] = Array.from(row.children, td =>
      td.textContent.trim(),
    )
    data.push(html.dt(infoType))
    if (infoType in infoTypes) {
      if (infoTypes[infoType] === null) {
        data.push(html.dd(infoBody))
      } else {
        data.push(
          html.dd(html.a({ href: infoTypes[infoType] + infoBody }, infoBody)),
        )
      }
    } else {
      console.warn(`What is ${infoType}?`)
    }
  }
  rows.push(
    html.tr(
      html.th(
        { scope: 'row' },
        html.h2(
          html.a({ href: `https://pausd.schoology.com/user/${id}/info` }, name),
        ),
        html.img({
          src: pfp
            ? `https://asset-cdn.schoology.com/system/files/imagecache/profile_big/pictures/picture-${pfp.replace(
                '_sq',
                '',
              )}`
            : 'https://asset-cdn.schoology.com/sites/all/themes/schoology_theme/images/user-default.svg',
        }),
      ),
      html.td(html.dl(data)),
    ),
  )
}

await Deno.writeTextFile(
  './output/students.html',
  html.body(
    html.style(
      html.raw(
        [
          'table {',
          'border-collapse: collapse;',
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
          'img {',
          'height: 100px;',
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
  ).html,
)
