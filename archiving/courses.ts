import { ensureDir } from 'https://deno.land/std@0.97.0/fs/ensure_dir.ts'
import { Element } from 'https://deno.land/x/deno_dom@v0.1.12-alpha/deno-dom-wasm.ts'
import { cachePath } from './cache.ts'
import * as html from './html-maker.ts'
import { root } from './init.ts'
import { me } from './me.ts'
import { assert, parseHtml, shouldBeElement, stringToPath } from './utilts.ts'

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
  red: { background: 'F1567B', border: 'C11E45'},
  orange: { background: 'F79060', border: 'C84E22'},
  yellow: { background: 'EFD962', border: 'BB9300'},
  green: { background: 'B5DB75', border: '5A9503'},
  blue: { background: '8EC4E3', border: '4198D2'},
  purple: { background: 'A487C3', border: '66519E'},
  pink: { background: 'EF8FC0', border: 'C24784'},
  black: { background: '6D6D6D', border: '333333'},
  gray: { background: 'F1F1F2', border: 'BBBDBF'},
}

const sections: SgyUserSections = await cachePath(`/v1/users/${me.id}/sections`)
// console.log(sections.section.map(({ id, course_title, weight, course_code }) => ({ id, course_title, weight, course_code })))
const courseIds = sections.section
  .sort((a, b) => +b.weight - +a.weight)
  .map(section => ({
    id: section.id,
    name: `${section.course_title}: ${section.section_title}`,
  }))

async function getCourseMaterials (courseId: string, courseName: string) {
  const document = await cachePath(`/course/${courseId}/materials`, 'html').then(parseHtml)
  const outPath = `./output/courses/${stringToPath(courseName)}`
  await ensureDir(outPath)
  await Deno.writeTextFile(outPath + '/materials.html', html.div(
    html.base({
      href: root
    }),
    html.ul([...document.querySelectorAll('.item-info')].map(elem => {
      if (!(elem instanceof Element)) {
        throw new TypeError(`elem is not an Element: ${Deno.inspect(elem)}`)
      }
      // Folders
      if (elem.classList.contains('materials-folder')) {
        const iconColour = [...assert(elem.parentElement?.querySelector('.inline-icon')).classList]
          .find(className => className.startsWith('folder-color-'))
          ?.replace('folder-color-', '')
        const { background, border } = colours[iconColour ?? '']
        return html.li(
          html.h2(
            { style: { 'font-size': '1em' } },
            html.span({
              style: {
                width: '1em',
                height: '1em',
                display: 'inline-block',
                'background-color': `#${background}`,
                border: `1px solid #${border}`,
              }
            }),
            elem.querySelector('.folder-title')?.textContent ?? ''
          ),
          html.raw(elem.querySelector('.folder-description')?.innerHTML ?? ''),
        )
      }
      // Links
      const docBodyTitle = elem.querySelector('.document-body-title')
      if (docBodyTitle) {
        const link = docBodyTitle.children[0].children[0]
        const url = new URL(link.getAttribute('href') ?? '', root)
        return html.li(
          html.h3(
            { style: { 'font-size': '1em' } },
            html.a(
              { href: url.searchParams.get('path') },
              link.textContent,
            )
          )
        )
      }
      // Assignments
      const itemTitleLink = elem.querySelector('.item-title a')
      if (itemTitleLink) {
        return html.li(
          html.h3(
            { style: { 'font-size': '1em' } },
            itemTitleLink.textContent,
          ),
          html.raw(elem.querySelector('.item-body')?.innerHTML ?? ''),
        )
      }
      throw new Error('idk how to deal with ' + elem.outerHTML)
    })),
  ).html)
}

for (const { id, name } of courseIds.slice(0, 2)) {
  await getCourseMaterials(id, name)
}
