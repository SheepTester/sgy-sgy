/// deno run --allow-read --allow-write irrelevant-scripts-maybe/sort-grades.ts <path to json>

const [fileName] = Deno.args

interface Grades {
  section: Section[]
  links: {
    self: string
  }
}

interface Section {
  section_id: string
  period: Period[]
  final_grade: FinalGrade[]
  grading_category: GradingCategory[]
}

interface Period {
  period_id: string
  period_title: string
  assignment: Assignment[]
}

interface Assignment {
  enrollment_id: number
  assignment_id: number
  grade: number | string | null
  exception: 0 | 1 | 2
  max_points: number | null
  is_final: 0 | 1 // Only has been 0 for me
  timestamp: number
  comment: string | null
  comment_status: 0 | 1 | null
  override: 0 | 1 | null
  pending: null // idk
  type: 'assignment' | 'discussion'
  location: string
  scale_id: number
  scale_type: number
  category_id: number
}

interface FinalGrade {
  period_id: string
  grade: number | string | null
  weight?: number
  comment: string
  comment_status?: 0 | 1 | null
  scale_id: number
  grading_category?: GradingCategory[]
}

interface GradingCategory {
  category_id: number
  grade: number | string | null
}

const grades: Grades = JSON.parse(await Deno.readTextFile(fileName))

const { section: sections } = grades

sections.sort((a, b) => a.section_id.localeCompare(b.section_id))
for (const {
  period: periods,
  final_grade: finalGrades,
  grading_category: gradingCategories,
} of sections) {
  periods.sort((a, b) => a.period_id.localeCompare(b.period_id))
  for (const { assignment: assignments } of periods) {
    assignments.sort((a, b) => a.assignment_id - b.assignment_id)
  }

  finalGrades.sort((a, b) => a.period_id.localeCompare(b.period_id))
  for (const { grading_category: gradingCategories } of finalGrades) {
    if (gradingCategories) {
      gradingCategories.sort((a, b) => a.category_id - b.category_id)
    }
  }

  gradingCategories.sort((a, b) => a.category_id - b.category_id)
}

await Deno.writeTextFile(fileName, JSON.stringify(grades, null, '\t'))
