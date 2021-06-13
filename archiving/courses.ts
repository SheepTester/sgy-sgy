import { cachePath } from './cache.ts'
import { options, root } from './init.ts'
import { me } from './me.ts'

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

const sections: SgyUserSections = await cachePath(`/v1/users/${me.id}/sections`)
// console.log(sections.section.map(({ id, course_title, weight, course_code }) => ({ id, course_title, weight, course_code })))
const courseIds = sections.section
  .sort((a, b) => +b.weight - +a.weight)
  .map(section => section.id)

await cachePath(`/course/${courseIds[0]}/materials?ajax=1`)
