// deno-lint-ignore-file camelcase

import { ensureDir } from 'https://deno.land/std@0.97.0/fs/ensure_dir.ts'
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

type ApiAttachmentFile = {
  download_path: string
  extension: string
  fid: number
  filemime: string
  filename: string
  filesize: number
  id: number
  md5_checksum: string
  timestamp: number
  title: string
  type: 'file'
}

interface ApiAttachmentConvertedFile extends ApiAttachmentFile {
  converted_download_path?: string
  converted_extension?: string
  converted_filemime?: string
  converted_filename?: string
  converted_filesize?: number
  converted_md5_checksum?: string
  converted_status: string // '1' or '2' at least
  converted_type: number // 3 or 4 at least
}

type ApiAttachmentLink = {
  display_inline: 0 | 1
  id: number
  summary: string // Is this always empty?
  title: string
  type: 'link'
  url: string
}

type ApiUpdate = {
  /** Only with `?with_attachments=1` in request */
  attachments?: {
    files?: {
      file: (ApiAttachmentFile | ApiAttachmentConvertedFile)[]
    }
    links?: {
      link: ApiAttachmentLink[]
    }
  }
  /** Not in HTML, so formatting is lost */
  body: string
  created: number
  id: number
  last_updated: string
  likes: number
  num_comments: number
  realm: 'user'
  uid: number
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
  email: string
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
    email: expect(primary_email),
  }
}

type Comment = {
  id: number
  authorId: number
  likers: Liker[]
  content: string
  created: Date
}

type Update = {
  id: number
  authorId: number
  /** In HTML */
  content: string
  likers: Liker[]
  created: Date
  edited?: Date
  comments: Comment[]
}

async function getUpdates (
  realm: 'user' | 'course' | 'group',
  id: number | string,
): Promise<Update[]> {
  // Get updates from API
  const updates: Update[] = []
  const timestampToUpdate: Record<string, Update> = {}
  let response: ApiUpdateList
  let index = 0
  do {
    response = await cachePath(
      `/v1/${realm}/${id}/updates?start=${index}&limit=200`,
    )
    for (const update of response.update) {
      const { comment: comments }: ApiCommentList = await cachePath(
        `/v1/${realm}/${id}/updates/${update.id}/comments`,
      )
      const updateObj = {
        id: update.id,
        authorId: update.uid,
        content: update.body,
        likers: [],
        created: new Date(update.created * 1000),
        edited:
          update.created !== +update.last_updated
            ? new Date(+update.last_updated * 1000)
            : undefined,
        comments: comments.map(comment => ({
          id: comment.id,
          authorId: comment.uid,
          likers: [],
          content: comment.comment,
          created: new Date(comment.created * 1000),
        })),
      }
      updates.push(updateObj)
      // The `timestamp` attribute in the HTML can be off by 1 compared to
      // `created` from the API ¯\_(ツ)_/¯
      timestampToUpdate[update.created] = updateObj
      timestampToUpdate[update.created + 1] = updateObj
    }
    index += 200
  } while (response.links.next)

  // Get content HTML from website
  let page = 0
  while (true) {
    // NOTE: The "Show more" links have a hash that apparently expire after some
    // time. :/ May have to clear cache occasionally.
    const { output } = await cachePath(
      `/${realm}/${id}/feed?page=${page}`,
      'json',
    )
    const document = parseHtml(output)
    const postWrappers = document.querySelectorAll('.own-edge-post')
    if (postWrappers.length === 0) {
      break
    }
    // Exclude elements with class `own-edge-post` inside update bodies (because
    // `class` is on Schoology's attribute whitelist)
    const postWrappersInUpdates = [
      ...document.querySelectorAll('.update-body .own-edge-post'),
    ]
    for (const postWrapperNode of postWrappers) {
      if (postWrappersInUpdates.includes(postWrapperNode)) continue
      const postWrapper = shouldBeElement(postWrapperNode)
      const timestamp = expect(postWrapper.getAttribute('timestamp'))
      const update = timestampToUpdate[timestamp]
      if (!update) {
        throw new ReferenceError(
          `${timestamp} is not in the timestampToUpdate map`,
        )
      }
      const showMoreLink = nextElementNotInUpdateBody(
        '.show-more-link',
        postWrapper,
      )
      if (showMoreLink) {
        const { update: updateHtml } = await cachePath(
          expect(showMoreLink.getAttribute('href')),
        )
        update.content = updateHtml
      } else {
        update.content = expect(
          nextElementNotInUpdateBody('.update-body', postWrapper),
        ).innerHTML
      }
    }
    page++
  }

  // Get likers from API
  for (const update of updates) {
    const { users }: ApiLikeList = await cachePath(`/v1/like/${update.id}`)
    update.likers = users.map(userToLiker)

    for (const comment of update.comments) {
      const { users }: ApiLikeList = await cachePath(
        `/v1/like/${update.id}/comment/${comment.id}`,
      )
      comment.likers = users.map(userToLiker)
    }
  }

  return updates
}

function likerToHtml ({ id, name, pfp, email }: Liker): html.Html {
  return html.span(
    {
      title: email,
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
async function updatesToHtml (updates: Update[]): Promise<html.Html> {
  const authors = await getUsers(
    updates.flatMap(update => [
      update.authorId,
      ...update.comments.map(comment => comment.authorId),
    ]),
  )
  return html.ul(
    updates.map(update =>
      html.li(
        html.h2(
          {
            style: {
              'font-size': 'inherit',
            },
          },
          likerToHtml(userToLiker(authors[update.authorId])),
          ' ',
          html.em(
            {
              style: {
                color: 'grey',
              },
            },
            update.created.toLocaleString('en-CA'),
            update.edited &&
              ` (edited ${update.edited.toLocaleString('en-CA')})`,
          ),
        ),
        html.div(html.raw(update.content)),
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
          update.comments.map(comment =>
            html.li(
              html.h3(
                {
                  style: {
                    'font-size': 'inherit',
                  },
                },
                likerToHtml(userToLiker(authors[comment.authorId])),
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
            ),
          ),
        ),
      ),
    ),
  )
}

if (import.meta.main) {
  await Deno.writeTextFile(
    './output/test.html',
    (await getUpdates('user', '2017219').then(updatesToHtml)).html,
  )
}
