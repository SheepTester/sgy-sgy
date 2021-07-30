// deno-lint-ignore-file camelcase
import { cachePath } from './cache.ts'
import * as html from './html-maker.ts'
import { me } from './me.ts'
import { getUpdates, updatesToHtml } from './updates.ts'

/**
 * Buildings have the same fields as schools.
 *
 * This is actually a building since it has `building_code`.
 */
type ApiSchool = {
  /**
   * The internal Schoology ID that identifies the school. This field cannot be
   * used in create operations; only update and read operations.
   */
  id: string

  /** The name of the school */
  title: string

  /** The first line of the school's street address */
  address1: string

  /**
   * The second line of the school's street address
   *
   * Can be empty.
   */
  address2: string

  /** The city where the school is located */
  city: string

  /** The state/province where the school is located */
  state: string

  /** The postal code where the school is located */
  postal_code: string

  /** The country where the school is located */
  country: string

  /** The school's website address */
  website: string

  /** The school's phone number */
  phone: string

  /** The school's fax number */
  fax: string

  /**
   * The configurable external ID of this building (used for imports and
   * synchronization)
   *
   * Can be an empty string.
   */
  building_code: string

  /** The full URL of the school's profile picture */
  picture_url: string
}

function schoolToHtml (school: ApiSchool): html.Child {
  return [
    html.h1(
      html.img({
        src: school.picture_url.replace('profile_reg', 'profile_big'),
        style: { height: '100px' },
      }),
      ' ',
      school.title,
    ),
    html.dl(
      html.dt('Address'),
      html.dd(
        school.address1,
        '\n',
        school.address2 ? school.address2 + '\n' : null,
        school.city,
        ' ',
        school.state,
        ' ',
        school.country,
      ),
      html.dt('Website'),
      html.dd(html.a({ href: school.website }, school.website)),
      html.dt('Phone'),
      html.dd(html.a({ href: `tel:${school.phone}` }, school.phone)),
      school.fax && [html.dt('Fax'), html.dd(school.fax)],
    ),
  ]
}

if (import.meta.main) {
  const { school: schools }: { school: ApiSchool[] } = await cachePath(
    '/v1/schools',
  )

  const mySchool = await cachePath(`/v1/schools/${me.building_id}`)

  await Deno.writeTextFile(
    './output/school-updates.html',
    html.page(
      schoolToHtml(mySchool),
      await getUpdates('school', me.building_id).then(updatesToHtml),
      schools.map(schoolToHtml),
    ),
  )
}
