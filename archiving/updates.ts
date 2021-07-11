// deno-lint-ignore-file camelcase

import { ensureDir } from 'https://deno.land/std@0.97.0/fs/ensure_dir.ts'
import { cachePath } from './cache.ts'
import * as html from './html-maker.ts'
import { User } from './user.ts'
import { expect, parseHtml, shouldBeElement } from './utilts.ts'

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

type Comment = {
  id: number
  likers: {
    id: number
    name: string
    pfp: string
    email: string
  }[]
  content: string
  created: Date
}

type Update = {
  id: number
  authorId: number
  /** In HTML */
  content: string
  likers: number[]
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
        likers: [update.id],
        created: new Date(update.created * 1000),
        edited:
          update.created !== +update.last_updated
            ? new Date(+update.last_updated * 1000)
            : undefined,
        comments: comments.map(comment => ({
          id: comment.id,
          likers: [],
          content: comment.comment,
          created: new Date(comment.created * 1000),
        })),
      }
      updates.push(updateObj)
      timestampToUpdate[update.created] = updateObj
    }
    index += 200
  } while (response.links.next)

  // Get content HTML from website
  let page = 0
  while (true) {
    const document = await cachePath(`/${realm}/${id}/feed?page=${page}`).then(
      parseHtml,
    )
    const postWrappers = document.querySelectorAll('.own-edge-post')
    if (postWrappers.length === 0) {
      break
    }
    for (const postWrapperNode of postWrappers) {
      const postWrapper = shouldBeElement(postWrapperNode)
      const update =
        timestampToUpdate[expect(postWrapper.getAttribute('timestamp'))]
      // Note: `class` is on Schoology's attribute whitelist, so it's possible
      // for this to match a link inside a post. 😳
      const showMoreLink = postWrapper.querySelector('.show-more-link')
      if (showMoreLink) {
        const { update: updateHtml } = await cachePath(
          expect(showMoreLink.getAttribute('href')),
        )
        update.content = updateHtml
      } else {
        update.content = expect(
          postWrapper.querySelector('.update-body'),
        ).innerHTML
      }
    }
    page++
  }

  // Get likers from API
  for (const update of updates) {
    const { users }: ApiLikeList = await cachePath(`/v1/like/${update.id}`)
    update.likers = users.map(user => expect(user.id))

    for (const comment of update.comments) {
      const { users }: ApiLikeList = await cachePath(
        `/v1/like/${update.id}/comment/${comment.id}`,
      )
      comment.likers = users.map(
        ({ id, name_display, picture_url, primary_email }) => ({
          id: expect(id),
          name: expect(name_display),
          pfp: expect(picture_url),
          email: expect(primary_email),
        }),
      )
    }
  }

  return updates
}

if (import.meta.main) {
  console.log(await getUpdates('user', '2017219'))
}
