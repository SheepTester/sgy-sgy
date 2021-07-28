import { ensureDir } from 'https://deno.land/std@0.97.0/fs/ensure_dir.ts'
import { cachePath } from './cache.ts'
import { colours } from './courses.ts'
import * as html from './html-maker.ts'
import {
  ApiAttachmentConvertedFile,
  ApiAttachmentFile,
  ApiAttachmentLink,
} from './updates.ts'
import { stringToPath } from './utilts.ts'

type CollectionsResponse = {
  collection: {
    /** The Schoology Id of the collection */
    id: number

    /** The title the collection */
    title: string

    /** The owner of the collection */
    uid: number

    /**
     * - 0: Regular collection
     * - 1: Default home collection
     * - 2: Default Downloads collection
     */
    is_default: 0 | 1 | 2

    /** The number of users this collection is shared with */
    shared_users: number
  }[]

  count: number

  links: {
    self: string
  }
}

type ResourcesResponse = {
  resources: {
    /** The Schoology Id of the template */
    id: number

    /** The title the template. Note that documents do not require a title. */
    title: string

    /** The creator of the template */
    uid: number

    /** Resource notes that can be attached to the actual template */
    resource_notes: string

    /**
     * The resource folder this item is in.
     *
     * `0` if it's not in a folder.
     */
    folder_id: number

    /** The Collection this item is contained in */
    collection_id: number

    /**
     * The type of template this template item is. Note that we only support
     * assignment, discussion, page, and document creation currently.
     */
    type:
      | 'assessment'
      | 'assignment'
      | 'discussion'
      | 'page'
      | 'album'
      | 'document'
      | 'folder'

    /** Fields specific to this template type. */
    template_fields: { document_type: 'file' | 'video' | 'link' }

    /** Only present if `?with_attachments=1` in URL. */
    attachments?: {
      files?: {
        file: (ApiAttachmentFile | ApiAttachmentConvertedFile)[]
      }
      links?: {
        link: ApiAttachmentLink[]
      }
      videos?: {
        video: {
          id: number
          type: 'video'
          url: string
          title: string
        }[]
      }
    }

    created?: number
    last_updated: number
    color?: string
  }[]

  total: number

  links: {
    self: string
  }
}

async function archiveCollection (id: number, title: string): Promise<void> {
  const outPath = `./output/collections/${stringToPath(title)}/`

  async function archiveFolder (path: string, folderId: number): Promise<void> {
    await ensureDir(path)
    const resources: ResourcesResponse = await cachePath(
      `/v1/collections/${id}/resources/?with_attachments=1&limit=200&f=${folderId}`,
    )
    for (const {
      id,
      title,
      type,
      attachments: { files: { file: [file, ...others] } = { file: [] } } = {},
    } of resources.resources) {
      if (type === 'folder') {
        await archiveFolder(`${path}${stringToPath(title)}/`, id)
      } else if (file) {
        if (others.length > 0) {
          throw new Error('There are other files?')
        }
        // https://api.pausd.schoology.com/v1/attachment/977995665/source/6705b5146073a0e4738777ca5784665d.pdf
        // which 404s ->
        // /attachment/977995665/source/6705b5146073a0e4738777ca5784665d.pdf,
        // which works (base pausd.schoology.com, sans api.)
        await cachePath(
          file.download_path
            .replace('https://api.pausd.schoology.com', '')
            .replace('/v1', ''),
          'file',
          {
            cachePath:
              // Yes, one of my files are called "index.html" (from JLS Wheel,
              // Computers)
              file.filename === 'index.html'
                ? path + '_index.html'
                : path + file.filename,
          },
        )
      }
    }
    await Deno.writeTextFile(
      path + 'index.html',
      html.page(
        html.h1(title),
        resources.resources.map(resource => {
          const file = resource.attachments?.files?.file[0]
          const link =
            resource.attachments?.links?.link[0]?.url ??
            resource.attachments?.videos?.video[0]?.url
          const folderColours =
            resource.type === 'folder' && colours[resource.color ?? '']
          return html.p(
            folderColours && [
              html.span({
                style: {
                  width: '1em',
                  height: '1em',
                  display: 'inline-block',
                  'background-color': `#${folderColours.background}`,
                  border: `1px solid #${folderColours.border}`,
                },
              }),
              ' ',
            ],
            html.strong(
              html.a(
                {
                  href: folderColours
                    ? `./${stringToPath(resource.title)}/index.html`
                    : file
                    ? file.filename === 'index.html'
                      ? './_index.html'
                      : './' + file.filename
                    : link,
                },
                resource.title,
              ),
            ),
            '\n',
            resource.resource_notes,
          )
        }),
      ),
    )
  }

  await archiveFolder(outPath, 0)
}

if (import.meta.main) {
  const collections: CollectionsResponse = await cachePath('/v1/collections/')
  for (const { id, title } of collections.collection) {
    await archiveCollection(id, title)
  }
}
