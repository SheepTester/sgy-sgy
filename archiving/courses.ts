import { ensureDir } from 'https://deno.land/std@0.97.0/fs/ensure_dir.ts'
import {
  Element,
  HTMLDocument,
} from 'https://deno.land/x/deno_dom@v0.1.12-alpha/deno-dom-wasm.ts'
import { cachePath } from './cache.ts'
import * as html from './html-maker.ts'
import { root } from './init.ts'
import { me } from './me.ts'
import {
  expect,
  asyncMap,
  parseHtml,
  shouldBeElement,
  stringToPath,
} from './utilts.ts'

interface SgyUserSections {
  links: {
    self: string
  }
  section: {
    id: string
    course_title: string
    course_code: string
    course_id: string
    school_id: string
    building_id: string
    access_code: string
    section_title: string
    section_code: string
    section_school_code: string
    synced: '0' | '1'
    active: 0 | 1
    description: string
    subject_area: string
    grade_level_range_start: number
    grade_level_range_end: number
    parent_id: string
    grading_periods: number[]
    profile_url: string
    location: string
    meeting_days: string[]
    start_time: string
    end_time: string
    weight: string // Position of course; last one has 0
    options: {
      weighted_grading_categories: '0' | '1'
      upload_documents: '0' | '1'
      create_discussion: '0' | '1'
      member_post: '0' | '1'
      member_post_comment: '0' | '1'
      default_grading_scale_id: 0 | 1
      content_index_visibility: {
        topics: 0 | 1
        assignments: 0 | 1
        assessments: 0 | 1
        course_assessment: 0 | 1
        common_assessments: 0 | 1
        documents: 0 | 1
        discussion: 0 | 1
        album: 0 | 1
        pages: 0 | 1
      }
      hide_overall_grade: 0 | 1
      hide_grading_period_grade: 0 | 1
      allow_custom_overall_grade: 0 | 1
      allow_custom_overall_grade_text: 0 | 1
    }
    admin: 0 | 1
    links: {
      self: string
    }
  }[]
}

const colours: Record<string, { background: string; border: string }> = {
  red: { background: 'F1567B', border: 'C11E45' },
  orange: { background: 'F79060', border: 'C84E22' },
  yellow: { background: 'EFD962', border: 'BB9300' },
  green: { background: 'B5DB75', border: '5A9503' },
  blue: { background: '8EC4E3', border: '4198D2' },
  purple: { background: 'A487C3', border: '66519E' },
  pink: { background: 'EF8FC0', border: 'C24784' },
  black: { background: '6D6D6D', border: '333333' },
  gray: { background: 'F1F1F2', border: 'BBBDBF' },
}

const sections: SgyUserSections = await cachePath(`/v1/users/${me.id}/sections`)
// console.log(sections.section.map(({ id, course_title, weight, course_code }) => ({ id, course_title, weight, course_code })))
const courseIds = sections.section
  .sort((a, b) => +b.weight - +a.weight)
  .map(section => ({
    id: section.id,
    name: `${section.course_title}: ${section.section_title}`,
  }))

async function getFolderContents (document: HTMLDocument): Promise<html.Html> {
  const items = document.querySelectorAll('.item-info')
  if (items.length === 0) {
    return html.em('Empty.')
  }
  return html.div(
    await asyncMap(items, async elem => {
      if (!(elem instanceof Element)) {
        throw new TypeError(`elem is not an Element: ${Deno.inspect(elem)}`)
      }
      // Folders
      if (elem.classList.contains('materials-folder')) {
        const iconColour = [
          ...expect(elem.parentElement?.querySelector('.inline-icon'))
            .classList,
        ]
          .find(className => className.startsWith('folder-color-'))
          ?.replace('folder-color-', '')
        const { background, border } = colours[iconColour ?? '']
        const folderTitle = expect(elem.querySelector('.folder-title'))
        const folderDoc =
          folderTitle.children.length > 0
            ? await cachePath(
                folderTitle.children[0].getAttribute('href') ?? '',
                'html',
              ).then(parseHtml)
            : null
        return html.details(
          { open: true },
          html.summary(
            {
              style: {
                display: 'flex',
              },
            },
            html.div(
              html.p(
                html.strong(
                  html.span({
                    style: {
                      width: '1em',
                      height: '1em',
                      display: 'inline-block',
                      'background-color': `#${background}`,
                      border: `1px solid #${border}`,
                    },
                  }),
                  ' ',
                  folderTitle.textContent,
                ),
              ),
              html.raw(
                elem.querySelector('.folder-description')?.innerHTML ?? '',
              ),
            ),
          ),
          html.div(
            {
              style: {
                margin: '0 40px',
              },
            },
            folderDoc && (await getFolderContents(folderDoc)),
          ),
        )
      }
      // Links
      const docBodyTitle = elem.querySelector('.document-body-title')
      if (docBodyTitle) {
        const link = docBodyTitle.children[0].children[0]
        if (link.classList.contains('attachments-file-name')) {
          // Attachment
          return html.p(
            html.strong(
              '📄 ',
              link.querySelector('.infotip')
                ? link.children[0].children[0].childNodes[0].nodeValue
                : link.children[0].textContent,
            ),
          )
        }
        let sgyPath = link.getAttribute('href')
        if (sgyPath && !sgyPath.startsWith('/link')) {
          const document = await cachePath(sgyPath, 'html').then(parseHtml)
          const link = document.querySelector('.page-title a')
          if (link) {
            sgyPath = link.getAttribute('href')
          }
        }
        const url = sgyPath && new URL(sgyPath, root)
        return html.p(
          html.strong(
            {
              style: {
                color: !url && 'red',
              },
            },
            '🔗 ',
            url
              ? html.a({ href: url.searchParams.get('path') }, link.textContent)
              : link.textContent,
          ),
        )
      }
      // Assignments
      const itemTitleLink = elem.querySelector('.item-title a')
      if (itemTitleLink) {
        const url = expect(itemTitleLink.getAttribute('href'))
        if (
          url.includes('discussion') ||
          url.includes('common-assessment') ||
          itemTitleLink.parentElement?.parentElement?.parentElement?.children[0].classList.contains(
            'assessment-icon',
          )
        ) {
          const doc = await cachePath(url, 'html').then(parseHtml)
          if (url.includes('common-assessment')) {
            console.log(url)
            const fnName = 'window.initSgyUiApp'
            const script = expect(
              [...doc.querySelectorAll('script')].find(script =>
                script.textContent.includes(fnName),
              ),
            ).textContent
            const {
              initialization: { submissions },
            } = JSON.parse(
              `[${script.slice(
                script.indexOf(fnName) + fnName.length + 1,
                script.indexOf(');'),
              )}]`,
            )[5]
            for (const { id } of submissions) {
              // Ignore the 403 error
              await cachePath(
                `/iapi2/common-assessments/edit-submission/${id}`,
              ).catch(() => {})
            }
          } else if (url.includes('assignment')) {
            // console.log(doc.querySelectorAll('.sub-edit a').length, url)
            for (const link of doc.querySelectorAll('.sub-edit a')) {
              const url = expect(shouldBeElement(link).getAttribute('href'))
              await cachePath(url, 'html')
            }
          }
        }
        return html.div(
          html.p(html.strong('📝 ', itemTitleLink.textContent)),
          html.raw(elem.querySelector('.item-body')?.innerHTML ?? ''),
        )
      }
      throw new Error('idk how to deal with ' + elem.outerHTML)
    }),
  )
}

async function getCourseMaterials (courseId: string, courseName: string) {
  const document = await cachePath(
    `/course/${courseId}/materials`,
    'html',
  ).then(parseHtml)
  const outPath = `./output/courses/${stringToPath(courseName)}`
  await ensureDir(outPath)
  await Deno.writeTextFile(
    outPath + '/materials.html',
    html.body(
      html.base({
        href: root,
      }),
      html.style(
        html.raw(
          [
            'summary::before {',
            'content: "▶";',
            'display: block;',
            'width: 2.5ch;',
            'flex: none;',
            'margin-top: 1em;',
            '}',
            'details[open] > summary::before {',
            'content: "▼";',
            '}',
          ].join(''),
        ),
      ),
      await getFolderContents(document),
    ).html,
  )

  const gradesDoc = await cachePath(
    `/course/${courseId}/student_grades`,
    'html',
  ).then(parseHtml)
  for (const element of gradesDoc.querySelectorAll(
    '.expandable-icon-grading-report',
  )) {
    element.remove()
  }
  await Deno.writeTextFile(
    outPath + '/grades.html',
    html.body(
      html.base({ href: root }),
      html.style(
        html.raw(
          [
            'th, td { text-align: left; }',
            '.title-column .due-date{ font-weight: normal; font-size: 12px; color: #767676; padding-right: 15px; margin-left: 15px; }',
            '.title-column .reportSpacer-2 { padding-left: 20px; }',
            '.title-column .reportSpacer-3 { padding-left: 40px; }',
            '.title-column .reportSpacer-4 { padding-left: 60px; }',
            '.item-row .grade-column, .final-row .grade-column { color:#3aa406; font-size: 12px; font-weight: bold; }',
            '.grade-column .max-grade { color:#767676; font-size: 12px; font-weight: normal; }',
            '.visually-hidden { display: none; }',
          ].join(''),
        ),
      ),
      html.raw(
        expect(gradesDoc.querySelector('.gradebook-course-grades table'))
          .outerHTML,
      ),
    ).html,
  )

  let page = 0
  while (true) {
    const { output } = await cachePath(`/course/${courseId}/feed?page=${page}`)
    if (
      output ===
      '<div class="item-list"><ul class="s-edge-feed feed-no-realm"><li id="feed-empty-message" class="first last"><div class="small gray">There are no posts</div></li>\n</ul></div>'
    ) {
      break
    }
    page++
    if (page > 100) {
      throw new RangeError("That's a lot of pages! Uhh")
    }
  }
}

// await cachePath(`/home/notifications`, 'html')
// await cachePath(`/v1/users/${me.id}/grades`)
for (const { id, name } of courseIds) {
  await getCourseMaterials(id, name)
}
