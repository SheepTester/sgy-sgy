// deno-lint-ignore-file camelcase

import { Element } from 'https://deno.land/x/deno_dom@v0.1.12-alpha/deno-dom-wasm.ts'
import { cachePath } from './cache.ts'
import * as html from './html-maker.ts'
import { getUsers, User } from './user.ts'
import { expect, parseHtml, shouldBeElement } from './utilts.ts'

/**
 * Get the first element that matches a selector that is not inside
 * `update-body`.
 *
 *  This is because `class` is on Schoology's attribute whitelist, so it's
 *  possible for a post to contain an element with a given class name. 😳 (Yes,
 *  one of my posts had all the possible Schoology classes in it.)
 */
function nextElementNotInUpdateBody (
  selector: string,
  parent: Element,
): Element | null {
  const matches = [...parent.querySelectorAll(selector)]
  const inUpdateBody = [...parent.querySelectorAll(`.update-body ${selector}`)]
  const match = matches.find(match => !inUpdateBody.includes(match))
  return match ? shouldBeElement(match) : null
}

type Feed = {
  css: unknown
  js: unknown
  /** In HTML */
  output: string
}

type ShowMore = {
  /** In HTML */
  update: string
}

export type ApiAttachmentFile = {
  /** The Unique ID of the document */
  id: number
  /** For updates with attachments, the type of the attachment */
  type: 'file'
  /** The display value of the link to the attachment */
  title: string
  download_path: string
  extension: string
  fid: number
  filemime: string
  filename: string
  filesize: number
  md5_checksum: string
  timestamp: number
}

export interface ApiAttachmentConvertedFile extends ApiAttachmentFile {
  converted_download_path?: string
  converted_extension?: string
  converted_filemime?: string
  converted_filename?: string
  converted_filesize?: number
  converted_md5_checksum?: string
  converted_status: string // '1' or '2' at least
  converted_type: number // 3 or 4 at least
}

export type ApiAttachmentLink = {
  /** The Unique ID of the document */
  id: number
  /** For updates with attachments, the type of the attachment */
  type: 'link'
  /** The display value of the link to the attachment */
  title: string
  /** The absolute URL of the attachment */
  url: string
  /**
   * For attachments of type 'link', a thumbnail screenshot of the linked page
   */
  thumbnail?: string
  /**
   * For creating documents with links, this field determines whether the link
   * will open in an iframe (1) or a new tab (0)
   */
  display_inline: 0 | 1

  // Undocumented
  summary: string // Is this always empty?
}

type ApiUpdate = {
  /**
   * The body text of the update
   *
   * NOTE: Not in HTML, so formatting is lost.
   */
  body: string
  /** The user ID of the user who posted the update. */
  uid?: number
  /** The display name of the user who posted the update. */
  display_name?: string
  /** The unix timestamp of the most recent time the post was created/modified. */
  last_updated?: string

  /** Only with `?with_attachments=1` in request */
  attachments?: {
    files?: {
      file: (ApiAttachmentFile | ApiAttachmentConvertedFile)[]
    }
    links?: {
      link: ApiAttachmentLink[]
    }
  }

  poll?: {
    /**
     * For updates with polls attached to them, this array will hold all of the
     * poll's options.
     */
    options: {
      /** The title and displayable name of the given poll option */
      title: string
      /** The number of users who have selected this option in the poll */
      count: number
      /** This variable is true if the current user selected this poll item */
      selected: boolean

      // Undocumented
      id: number
      status: '0' | '1' // unsure what this is; only have observed '1'
    }[]
  }

  // Undocumented
  created: number
  id: number
  likes: number
  num_comments: number
  realm: 'user'
  user_id: number
  user_like_action: boolean
}

type ApiUpdateList = {
  links: {
    next?: string
    self: string
  }
  update: ApiUpdate[]
}

type ApiComment = {
  comment: string
  created: number
  id: number
  likes: number
  links: {
    self: string
  }
  parent_id: 0 // Probably always 0? Don't think they support nested comments
  status: 1 // Unsure if it's always 1
  uid: number
  user_like_action: boolean
}

type ApiCommentList = {
  comment: ApiComment[]
}

type ApiLikeList = {
  links: {
    self: string
  }
  total: number
  users: User[]
}

type Liker = {
  id: number
  name: string
  pfp: string
  email: string | null
}

function userToLiker ({
  id,
  name_display,
  picture_url,
  primary_email,
}: User): Liker {
  return {
    id: expect(id),
    name: expect(name_display),
    pfp: expect(picture_url),
    email: primary_email ?? null,
  }
}

type Comment = {
  id: number
  authorId: number
  likeCount: number
  likers: Liker[]
  content: string
  created: Date
}

type Update = {
  id: number
  authorId: number
  author?: Liker
  /** In HTML */
  content: string
  likeCount: number
  likers: Liker[]
  created: Date
  edited?: Date
  comments: Comment[]
  poll: {
    label: string
    votes: number
    selected: boolean
  }[]
  files: {
    displayName: string
    fileName: string
    downloadUrl: string
    /** In bytes */
    size: number
  }[]
  links: {
    displayName: string
    url: string
  }[]
}

export async function getUpdates (
  realm: 'user' | 'course' | 'group',
  id: number | string,
): Promise<Update[]> {
  // Get updates from API
  const updates: Update[] = []
  let response: ApiUpdateList
  let index = 0
  do {
    response = await cachePath(
      `/v1/${realm}/${id}/updates?start=${index}&limit=200&with_attachments=1`,
    )
    for (const update of response.update) {
      const { comment: comments }: ApiCommentList = await cachePath(
        `/v1/${realm}/${id}/updates/${update.id}/comments`,
      )
      const updateObj: Update = {
        id: update.id,
        authorId: expect(update.uid),
        content: update.body,
        likeCount: update.likes,
        likers: [],
        created: new Date(update.created * 1000),
        edited:
          update.last_updated && update.created !== +update.last_updated
            ? new Date(+update.last_updated * 1000)
            : undefined,
        comments: comments.map(comment => ({
          id: comment.id,
          authorId: comment.uid,
          likeCount: comment.likes,
          likers: [],
          content: comment.comment,
          created: new Date(comment.created * 1000),
        })),
        poll: update.poll
          ? update.poll.options.map(({ title, count, selected }) => ({
              label: title,
              votes: count,
              selected,
            }))
          : [],
        files: update.attachments?.files
          ? update.attachments?.files.file.map(
              ({ filename, filesize, download_path, title }) => ({
                displayName: title,
                fileName: filename,
                downloadUrl: download_path,
                size: filesize,
              }),
            )
          : [],
        links: update.attachments?.links
          ? update.attachments?.links.link.map(({ title, url }) => ({
              displayName: title,
              url,
            }))
          : [],
      }
      updates.push(updateObj)
    }
    index += 200
  } while (response.links.next)

  // Get content HTML from website
  let page = 0
  let updateIndex = 0
  while (true) {
    // NOTE: The "Show more" links have a hash that apparently expire after some
    // time. :/ May have to clear cache occasionally.
    const { output }: Feed = await cachePath(
      `/${realm}/${id}/feed?page=${page}`,
      'json',
    )
    const document = parseHtml(output)
    const postWrappers = document.querySelectorAll(
      '.s-edge-feed > li[timestamp]',
    )
    if (postWrappers.length === 0) {
      break
    }
    // Exclude elements with class `s-edge-feed` inside update bodies (because
    // `class` is on Schoology's attribute whitelist)
    const postWrappersInUpdates = [
      ...document.querySelectorAll('.update-body .s-edge-feed > li[timestamp]'),
    ]
    for (const postWrapperNode of postWrappers) {
      if (postWrappersInUpdates.includes(postWrapperNode)) continue
      const postWrapper = shouldBeElement(postWrapperNode)
      const update = updates[updateIndex]
      // Ensure that the indices are synched. The timestamp is a bit off (up to
      // 3 seconds after, it seems), so allow some wiggle room.
      const timestamp = +expect(postWrapper.getAttribute('timestamp'))
      const created = update.created.getTime() / 1000
      if (timestamp - created > 5) {
        throw new ReferenceError(
          `Update ${updateIndex} timestamps are different: the array has ${created}, but the HTML has ${timestamp}.`,
        )
      }
      const showMoreLink = nextElementNotInUpdateBody(
        '.show-more-link',
        postWrapper,
      )
      if (showMoreLink) {
        const { update: updateHtml }: ShowMore = await cachePath(
          expect(showMoreLink.getAttribute('href')),
        )
        update.content = updateHtml
      } else {
        update.content = expect(
          nextElementNotInUpdateBody('.update-body', postWrapper),
        ).innerHTML
      }
      update.author = {
        id: update.authorId,
        name: expect(
          nextElementNotInUpdateBody('.update-sentence-inner > a', postWrapper),
        ).textContent,
        pfp: expect(
          nextElementNotInUpdateBody('.profile-picture img', postWrapper)
            ?.getAttribute('src')
            ?.replace('profile_sm', 'profile_big'),
        ),
        email: null,
      }
      updateIndex++
    }
    page++
  }

  // Get likers from API
  for (const update of updates) {
    if (update.likeCount > 0) {
      const { users }: ApiLikeList = await cachePath(`/v1/like/${update.id}`)
      update.likers = users.map(userToLiker)
    }

    for (const comment of update.comments) {
      if (comment.likeCount > 0) {
        const { users }: ApiLikeList = await cachePath(
          `/v1/like/${update.id}/comment/${comment.id}`,
        )
        comment.likers = users.map(userToLiker)
      }
    }
  }

  return updates
}

function likerToHtml ({ id, name, pfp, email }: Liker): html.Html {
  return html.span(
    {
      title: email ? `Email: ${email}; user ID: ${id}` : `User ID: ${id}`,
      'data-id': id.toString(),
    },
    html.img({
      src: pfp,
      style: {
        height: '1em',
      },
    }),
    name,
  )
}
export async function updatesToHtml (updates: Update[]): Promise<html.Html> {
  const authors = await getUsers(
    updates.flatMap(update => [
      update.authorId,
      ...update.comments.map(comment => comment.authorId),
    ]),
  )
  return html.ul(
    updates.map(update => {
      const maxVotes =
        update.poll.length > 0
          ? Math.max(...update.poll.map(option => option.votes))
          : 0
      const author = authors[update.authorId]
      return html.li(
        html.h2(
          { style: { 'font-size': 'inherit' } },
          author
            ? likerToHtml(userToLiker(author))
            : likerToHtml(expect(update.author)),
          ' ',
          html.em(
            { style: { color: 'grey' } },
            update.created.toLocaleString('en-CA'),
            update.edited &&
              ` (edited ${update.edited.toLocaleString('en-CA')})`,
          ),
        ),
        html.div(html.raw(update.content)),
        update.poll.length > 0 &&
          html.ul(
            update.poll.map(option =>
              html.li(
                {
                  style: {
                    'background-image': `linear-gradient(90deg, rgba(0, 0, 0, 0.3) ${(option.votes /
                      maxVotes || 0) *
                      100}%, rgba(0, 0, 0, 0.05) ${(option.votes / maxVotes ||
                      0) * 100}%)`,
                    'font-weight': option.selected && 'bold',
                  },
                },
                html.strong(
                  { style: { 'margin-right': '20px' } },
                  option.votes.toString(),
                ),
                ' ',
                option.label,
              ),
            ),
          ),
        update.links.length > 0 &&
          html.ul(
            update.links.map(link =>
              html.li(
                html.a(
                  {
                    href: link.url,
                  },
                  link.displayName,
                ),
              ),
            ),
          ),
        update.files.length > 0 &&
          html.ul(
            update.files.map(file =>
              html.li(
                html.a(
                  {
                    download: file.fileName,
                    // From scraper/app.js
                    href: file.downloadUrl
                      .replace('api.', '')
                      .replace('/v1', ''),
                  },
                  file.displayName,
                ),
                ' ',
                `${file.size} bytes`,
              ),
            ),
          ),
        html.em(
          update.likers.length > 0
            ? [
                'Liked by ',
                update.likers.map((liker, i) => [
                  i !== 0 && ', ',
                  likerToHtml(liker),
                ]),
              ]
            : 'No likes',
        ),
        html.ul(
          update.comments.map(comment => {
            const author = authors[comment.authorId]
            return html.li(
              html.h3(
                {
                  style: {
                    'font-size': 'inherit',
                  },
                },
                author
                  ? likerToHtml(userToLiker(author))
                  : html.span(
                      { title: `User ID: ${comment.authorId}` },
                      '[private user, cringe]',
                    ),
                ' ',
                html.em(
                  {
                    style: {
                      color: 'grey',
                    },
                  },
                  update.created.toLocaleString('en-CA'),
                ),
              ),
              html.p(
                {
                  style: {
                    'white-space': 'pre-wrap',
                  },
                },
                comment.content,
              ),
              html.em(
                comment.likers.length > 0
                  ? [
                      'Liked by ',
                      comment.likers.map((liker, i) => [
                        i !== 0 && ', ',
                        likerToHtml(liker),
                      ]),
                    ]
                  : 'No likes',
              ),
            )
          }),
        ),
      )
    }),
  )
}

if (import.meta.main) {
  await Deno.writeTextFile(
    './output/updates-test.html',
    (await getUpdates('group', '256792634').then(updatesToHtml)).html,
  )
}
