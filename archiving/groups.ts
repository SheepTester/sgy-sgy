// deno-lint-ignore-file camelcase
import { ensureDir } from 'https://deno.land/std@0.97.0/fs/ensure_dir.ts'
import { cachePath } from './cache.ts'
import * as html from './html-maker.ts'
import { root } from './init.ts'
import { me } from './me.ts'
import { getUpdates, updatesToHtml } from './updates.ts'
import { stringToPath } from './utilts.ts'

type ApiGroup = {
  /** The internal Schoology ID of the group */
  id: string

  /**
   * The internal Schoology ID of the school building to which the group belongs
   */
  building_id: string

  /**
   * The internal Schoology ID of the school to which the group belongs
   */
  school_id: string

  /** The title of the group */
  title: string

  /** The group description */
  description: string

  /**
   * The URL of the group's profile picture
   *
   * Either one of
   * - https://pausd.schoology.com/sites/all/themes/schoology_theme/images/group-default.svg
   * - https://asset-cdn.schoology.com/system/files/imagecache/profile_reg/grouplogos/...?...
   */
  picture_url: string

  /**
   * The group website
   *
   * Note: It's empty (`""`) for all of the PAUSD groups
   */
  website: string

  /**
   * The access code that users can use to join the group (only admins can see
   * this value).
   */
  access_code: string | null

  /**
   * The privacy of the group.
   * `everyone`: All schoology users can see the group.
   * `school`: Only members of the school can see the group
   * `building`: Only members of the building can see the group
   * `group`: Only group members can see the group
   * `custom`: Custom privacy settings (read only; not supported in POST/PUT)
   *
   * Note: Seems to be `custom` for almost all of them except:
   * - `nobody` (???) for https://pausd.schoology.com/group/103102643
   * - `group` for https://pausd.schoology.com/group/827997625
   */
  privacy_level: 'everyone' | 'school' | 'building' | 'group' | 'custom'

  /**
   * The category of the group (see below on how to retrieve a list of available categories)
   */
  category: string

  options: {
    /**
     * How members can join the group.
     * 0: Invite only
     * 1: Request to join
     * 2: Anyone can join
     */
    invite_type: 0 | 1 | 2

    /** Whether or not a group member can post a group update */
    member_post: 0 | 1

    /** Whether or not a group member can post comments to group udpates */
    member_post_comment: 0 | 1

    /** Whether or not a group member can create a discussion thread */
    create_discussion: 0 | 1

    /** Whether or not members can create resources for the group */
    create_files: 0 | 1
  }

  /**
   * If the group was imported from another system into Schoology, the unique ID
   * of that group in the other system.
   */
  group_code: string

  links: { self: string }
}

type ApiMyGroupsResponse = {
  group: ApiGroup[]
  links: {
    self: string
    next?: string
  }
}

interface ApiGroupsResponse extends ApiMyGroupsResponse {
  total: number
}

type ApiCategoriesResponse = {
  category: {
    id: string
    title: string
  }[]
}

async function archiveGroup (id: string, name: string): Promise<void> {
  await Deno.writeTextFile(
    `./output/groups/${stringToPath(name)}.html`,
    html.page(html.h1(name), await getUpdates('group', id).then(updatesToHtml)),
  )
}

async function archiveAllGroups (): Promise<void> {
  const { category }: ApiCategoriesResponse = await cachePath(
    '/v1/groups/categories',
  )
  const categories = Object.fromEntries(
    category.map(({ id, title }) => [id, title]),
  )

  const groups = []
  let groupResponse: ApiGroupsResponse
  let start = 0
  do {
    groupResponse = await cachePath(`/v1/groups/?limit=200&start=${start}`)
    groups.push(...groupResponse.group)
    start += 200
  } while (groupResponse.links.next)

  await Deno.writeTextFile(
    './output/groups/all.html',
    html.page(
      html.style(
        html.raw(
          [
            'img {',
            'width: 100px;',
            '}',
            'table {',
            'border-collapse: collapse;',
            '}',
            'th,',
            'td {',
            'border: 1px solid currentColor;',
            '}',
          ].join(''),
        ),
      ),
      html.h1('All groups'),
      html.p('For most groups, you can'),
      html.ul(
        html.li('Create discussion threads'),
        html.li('Post updates'),
        html.li('Comment on updates'),
      ),
      html.p(
        'Categories: ',
        category.map(({ id, title }, i) => [
          i > 0 && ', ',
          html.em({ title: id }, title),
        ]),
      ),
      html.table(
        html.tr(
          html.th('Image'),
          html.th('Name and description'),
          html.th('Permissions'),
        ),
        groups.map(group =>
          html.tr(
            html.td(
              html.a(
                { href: `${root}/group/${group.id}` },
                html.img({
                  src: group.picture_url.replace('profile_reg', 'profile_big'),
                }),
              ),
            ),
            html.td(
              html.strong(group.title),
              '\n',
              group.category
                ? [
                    html.em(
                      'Category: ',
                      html.span(
                        { title: group.category },
                        categories[group.category],
                      ),
                    ),
                    '\n',
                  ]
                : null,
              group.description,
            ),
            html.td(
              html.ul(
                group.options.create_discussion
                  ? null
                  : html.li('❌ Cannot create discussion threads'),
                group.options.create_files ? html.li('Create resources') : null,
                group.options.member_post
                  ? null
                  : html.li('❌ Cannot post updates'),
                group.options.member_post_comment
                  ? null
                  : html.li('❌ Cannot comment on updates'),
                group.options.invite_type === 1
                  ? html.li(html.em('Request to join'))
                  : group.options.invite_type === 2
                  ? html.li('Join immediately')
                  : null,
              ),
            ),
          ),
        ),
      ),
    ),
  )
}

if (import.meta.main) {
  await ensureDir('./output/groups/')
  await archiveAllGroups()

  const myGroups: ApiMyGroupsResponse = await cachePath(
    `/v1/users/${me.id}/groups`,
  )
  for (const group of myGroups.group) {
    await archiveGroup(group.id, group.title)
  }
}
