// deno-lint-ignore-file camelcase

import { ensureFile } from 'https://deno.land/std@0.97.0/fs/ensure_file.ts'
import { cachePath, Http403, multiGet } from './cache.ts'
import { getStudentInfo } from './get-students.ts'
import * as html from './html-maker.ts'
import { me } from './me.ts'
import { getUpdates, updatesToHtml } from './updates.ts'
import { expect, parseHtml, shouldBeElement, stringToPath } from './utilts.ts'

/**
 * Users objects are the accounts on the system.
 *
 * *Denotes fields are only displayed if the current API user has the
 * 'Administer users' permission enabled.
 */
export type User = {
  /** The internal Schoology ID of the user */
  uid?: string
  /** The internal Schoology ID of the school to which the user belongs */
  school_id?: number
  /**
   * The internal Schoology ID of the school building to which the user belongs
   */
  building_id?: number
  /** *The user's unique ID (e.g. student ID, SIS ID) */
  school_uid: string
  /**
   * The user's title, must be one of the following: Mr., Mrs., Ms., Miss, Dr.,
   * Professor
   */
  name_title?: 'Mr.' | 'Mrs.' | 'Ms.' | 'Miss' | 'Dr.' | 'Professor'
  /** Whether to show the user's title when displaying his/her full name */
  name_title_show?: 0 | 1
  /** The user's first name */
  name_first: string
  /**
   * The name by which the user goes
   * Note: Can be an empty string
   */
  name_first_preferred?: string
  /** The user's middle name */
  name_middle?: string
  /**
   * Whether to show the user's middle name when displaying his/her full name
   */
  name_middle_show?: 0 | 1
  /** The user's last name */
  name_last: string
  /**
   * A fully-constructed name based on the user's account settings. Cannot be
   * set - only available on GET.
   */
  name_display?: string
  /**
   * *The user's username (either a username or email address is required for
   * each user)
   */
  username?: string
  /**
   * The user's primary email address (either a username or email address is
   * required for each user)
   */
  primary_email?: string
  /** The user's position in the school/company. */
  position?: string
  /** The user's gender */
  gender?: 'M' | 'F' // how to get cancelled
  /**
   * *The user's graduation year (YYYY).
   *
   * Type: 4 digit integer
   */
  grad_year?: string
  /** The user's birthday (YYYY-MM-DD) */
  birthday_date?: string
  /**
   * *The user's password (existing passwords will not be changed if left blank)
   */
  password?: string
  /** *The ID of the role to which you would like to assign the user */
  role_id: number
  /**
   * Whether to send login information by email (if an email address is set);
   * used only during user creation
   */
  email_login_info?: 0 | 1
  /** The full URL of the user's profile picture */
  picture_url?: string
  /**
   * *An IANA-defined timezone name (see
   * http://en.wikipedia.org/wiki/List_of_tz_database_time_zones)
   */
  tz_name?: string
  /**
   * The user accounts of the user's parents; requires 'View user parents'
   * permission to be enabled for the current API user.
   */
  parents?: User[]
  /**
   * When creating/updating user accounts, a comma delimited list of the user's
   * parents' user ids. API users must have permission to create users in order
   * to create/update these associations.
   *
   * Type: comma-delimited list of integers
   */
  parent_uids?: string | null
  /**
   * When creating/updating user accounts, a comma delimited list of the user's
   * advisors' user ids. API users must have permission to create users in order
   * to create/update these associations.
   *
   * Type: comma-delimited list of integers
   */
  advisor_uids?: string | null
  /**
   * A comma-delimited list of user ids identifying the user's children.
   *
   * Type: comma-delimited list of integers
   */
  child_uids?: string | null
  /**
   * Whether or not the signed-in user can send a private message to the listed
   * user
   */
  send_message?: number
  /**
   * Whether or not this user was synced with an external system (eg, Student
   * Information System). The default value is 0. For synced users, the Unique
   * ID field is not editable through Schoology.
   */
  synced?: 0 | 1
  /**
   * ID pointing to temporary save of the profile picture upload (write-only).
   * For more details on uploading files: File Uploading
   */
  profile_picture_id?: number
  /**
   * The internal building IDs to which the user belongs to as a non-main
   * building
   *
   * Type: comma-delimited list of integers
   */
  additional_buildings?: string | null

  // Not documented
  id?: number
  language?: string
  tz_offset?: number
  use_preferred_first_name?: '0' | '1'
}

/**
 * Detailed profile fields can be added to the user object with the
 * `?extended=TRUE` argument. The following read-only fields will be included in
 * the user object in the sub attribute profile_info
 *
 * *Fields only included if the user is a course realm admin
 */
type DetailedProfile = {
  /** *The subjects taught by a teacher. */
  subjects_taught?: string
  /** *The grades taught by a teacher */
  grades_taught?: string
  /** *A user generated description of their position */
  position?: string
  /** *A user generated description of their department. */
  department?: string
  /** A user generated short bio on themselves. */
  bio?: string
  /** The phone number of the user */
  phone?: string
  /** User Website */
  website?: string
  /** User Address */
  address?: string
  /** User Interests */
  interests?: string
  /** User Activities */
  activities?: string
  /** The user's birthday */
  birthday_date?: string

  // Not documented
  birthday?: string
}

export interface ExtendedUser extends User {
  profile_info: DetailedProfile
}

// NOTE: Apparently the extended profile info only shows for the current user
// (eg me)
export async function getUsers (
  userIds: number[],
): Promise<Record<number, ExtendedUser>> {
  const responses = await multiGet(
    userIds.map(id => `/v1/users/${id}?extended=TRUE`),
  )
  return Object.fromEntries(
    Array.from(responses, ([path, response]) => [
      path.match(/\b\d+\b/)![0],
      response,
    ]),
  )
}

type Group = {
  iconUrl: string
  name: string
  id: string | null
}
type Badge = {
  /**
   * Could be an absolute path relative to https://pausd.schoology.com/, such as
   * `/sites/all/themes/schoology_theme/images/badges/star_performer_50.png`.
   */
  iconUrl: string
  name: string
  description: string
  classDate: string
}
type GroupsAndBadges = {
  groups: Group[]
  badges: Badge[]
}

async function getGroupsAndBadges (
  id: number,
): Promise<GroupsAndBadges | null> {
  const groups: Group[] = []
  const groupsDoc = await cachePath(`/user/${id}/groups/list`, 'html', {
    allow403: true,
  })
    .then(parseHtml)
    .catch(err => (err instanceof Http403 ? null : Promise.reject(err)))
  if (!groupsDoc) {
    return null
  }
  for (const groupItemNode of groupsDoc.querySelectorAll('.group-item')) {
    const group = shouldBeElement(groupItemNode)
    groups.push({
      iconUrl: expect(
        group.querySelector('.profile-picture img')?.getAttribute('src'),
      ),
      name: expect(
        group.querySelector('.group-item-right a, .group-name')?.textContent,
      ),
      id:
        group
          .querySelector('.group-item-right a')
          ?.getAttribute('href')
          ?.replace('/group/', '') ?? null,
    })
  }

  const badges: Badge[] = []
  const badgesDoc = await cachePath(`/user/${id}/badges`, 'html').then(
    parseHtml,
  )
  for (const userBadgeNode of badgesDoc.querySelectorAll('.user-badge-row')) {
    const badge = shouldBeElement(userBadgeNode)
    badges.push({
      iconUrl: expect(badge.querySelector('.badge-image')?.getAttribute('src')),
      name: expect(badge.querySelector('.badge-title-link a')?.textContent),
      description: expect(badge.querySelector('.badge-message')?.textContent),
      classDate: expect(
        badge.querySelector('.badge-award-details')?.textContent,
      ),
    })
  }

  return { groups, badges }
}

async function archiveUser (id: number): Promise<void> {
  const profileInfo = await getStudentInfo(id)
  const groupsAndBadges = profileInfo && (await getGroupsAndBadges(id))
  const outPath = profileInfo
    ? `./output/users/${id}_${stringToPath(profileInfo.name)}.html`
    : `./output/users/${id}.html`
  await ensureFile(outPath)
  if (profileInfo && groupsAndBadges) {
    const { name, pfpUrl, schools, info } = profileInfo
    const { groups, badges } = groupsAndBadges
    const bigPfp = new URL(pfpUrl).pathname.replace(
      'profile_reg',
      'profile_big',
    )
    const pfpFileName = id + bigPfp.slice(bigPfp.lastIndexOf('.'))
    const outputPfp = `./output/users/${pfpFileName}`
    await cachePath(bigPfp, 'file', { cachePath: outputPfp })
    await Deno.writeTextFile(
      outPath,
      html.page(
        html.style(html.raw(['img {', 'height: 100px;', '}'].join(''))),
        html.div(
          html.img({ src: pfpFileName }),
          html.div(
            { style: { display: 'inline-block' } },
            html.h1(name),
            html.p(`Goes to ${schools.join(', ')}.`),
          ),
        ),
        Object.entries(info).flatMap(([infoType, datum]) => [
          html.dt(infoType),
          ...(Array.isArray(datum)
            ? datum.map(({ url, text }) => html.dd(html.a({ href: url }, text)))
            : [html.dd(datum)]),
        ]),
        badges.length > 0 && html.h2('Badges'),
        badges.map(badge =>
          html.li(
            html.img({
              style: { 'vertical-align': 'top' },
              src: new URL(
                badge.iconUrl,
                'https://app.schoology.com/',
              ).toString(),
            }),
            html.div(
              { style: { display: 'inline-block', 'vertical-align': 'top' } },
              html.h3(badge.name),
              html.p(badge.description),
              html.p(html.em(badge.classDate)),
            ),
          ),
        ),
        groups.length > 0 && html.h2('Groups'),
        groups.map(group =>
          html.li(
            html.div(
              { style: { display: 'inline-block', 'vertical-align': 'top' } },
              html.img({ src: group.iconUrl }),
              html.p(
                group.id
                  ? html.a(
                      { href: `https://pausd.schoology.com/group/${group.id}` },
                      group.name,
                    )
                  : html.strong(group.name),
              ),
            ),
          ),
        ),
        html.h2('Updates'),
        await getUpdates('user', '2017219').then(updatesToHtml),
      ),
    )
  } else {
    await Deno.writeTextFile(
      outPath,
      html.page(html.p("This user's profile is private. Cringe.")),
    )
  }
}

if (import.meta.main) {
  await archiveUser(me.id)
}
