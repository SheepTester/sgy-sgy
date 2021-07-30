// deno-lint-ignore-file camelcase
import { ensureDir } from 'https://deno.land/std@0.97.0/fs/ensure_dir.ts'
import { exists } from 'https://deno.land/std@0.103.0/fs/exists.ts'
import { AnticipatedHttpError, cachePath, external } from './cache.ts'
import * as html from './html-maker.ts'
import { cookie, root } from './init.ts'
import { me } from './me.ts'
import { delay, stringToPath } from './utilts.ts'

type ApiPortfoliosInitResponse = {
  data: {
    csrfToken: string

    hints: string[]

    // eg https://asset-cdn.schoology.com/portfolios/assets/portfolio-078b8c30726f3f32d6d6.js
    script: string
  }
}

type FileInfo = {
  id: number
  fileId: number | null
  type: number
  tempURI: string
  publicURI: string | null
  filename: string
  filemime: string
  md5Checksum: string
  conversionFailed: boolean
  conversionPending: boolean
  pdfConversion: null
  swfConversion: null
  image_presets?: {
    profile_reg: string
    profile_sm: string
    profile_tiny: string
    profile_big: string
    album_thumbnail: string
    album_large: string
    album_source: string
  }
}

type ApiPortfolioThingBase = {
  id: number
  created_at: string
  updated_at: string
  file_info: FileInfo | null
  cropped_file_info: FileInfo | null
}

interface ApiPortfolioOrItem extends ApiPortfolioThingBase {
  title: string
  description: string
  file_id: number | null
  color_code: null
  use_file_id: 0 | 1
  position: string // eg "-g" or "g" or "i" or "-h" ??
  cropped_file_id: number | null
  crop_info: {
    xoffset: number
    yoffset: number
    width: number
    height: number
  } | null
}

interface ApiPortfolio extends ApiPortfolioOrItem {
  public_hash: string
  user_id: number
  published: boolean
  editable: boolean
  public_share_url: string
  item_count: number
}

type ApiUserPortfoliosResponse = {
  data: {
    canExport: boolean
    editable: boolean

    /** A datetime in the form of `2021-07-29 00:18:26 -0700` */
    updated_at: string

    portfolios: ApiPortfolio[]
  }
}

interface ApiItemThing extends ApiPortfolioOrItem {
  portfolio_id: number
  deck_id: null
  previous_id: number | null
  next_id: number | null
}

type ApiItemType =
  | {
      item_type: 'page'
      metadata: ApiPortfolioThingBase & {
        portfolio_item_id: number
        content: string
      }
    }
  | {
      item_type: 'link'
      metadata: ApiPortfolioThingBase & {
        portfolio_item_id: number
        url: string
        x_frame_options: string // can be empty
        absolute_url: string
        url_type: 'iframe'
      }
    }
  | {
      item_type: 'assignment'
      metadata: ApiPortfolioThingBase & {
        portfolio_item_id: number
        file_id: number
        submission_id: number
        revision_id: number // or is this 0 | 1?
        grade_item_id: number
      }
    }
  | {
      item_type: 'file'
      metadata: ApiPortfolioThingBase & {
        portfolio_item_id: number
        file_id: number
      }
    }

type ApiItem = ApiItemThing & ApiItemType

type ApiPortfolioResponse = {
  data: ApiPortfolio & {
    previous_id: number | null
    next_id: number | null
    items: ApiItem[]
  }
}

async function attemptUrlNoCache (
  url: string,
  csrfToken: string,
): Promise<ApiPortfolioResponse> {
  // Schoology is quite unreliable and inconsistent. It sometimes gives 404
  // errors, but not always.
  const response1: ApiPortfolioResponse | null = await fetch(url, {
    headers: { 'X-Csrf-Token': csrfToken, cookie },
  }).then(async r => {
    if (r.ok) {
      return r.json()
    } else if (r.status === 429 || r.status === 500) {
      console.log(
        `${url} gave a HTTP ${r.status} error, so I will wait 5 seconds and try again.`,
      )
      return null
    } else {
      throw new Error(`HTTP ${r.status} error for ${r.url}: ${await r.text()}`)
    }
  })
  if (response1) {
    return response1
  }
  // Wait 5 seconds just in case
  await delay(5000)
  const response2: ApiPortfolioResponse = await fetch(url, {
    headers: { 'X-Csrf-Token': csrfToken, cookie },
  }).then(r =>
    r.ok ? r.json() : Promise.reject(`HTTP ${r.status} error for ${r.url}`),
  )
  return response2
}

/** Get portfolios for a user ID */
export async function archivePortfolios (
  userId: number,
  path = `./output/users/${userId}/`,
): Promise<void> {
  const {
    data: { csrfToken },
  }: ApiPortfoliosInitResponse = await cachePath('/portfolios/init')

  const portfolios: ApiUserPortfoliosResponse | null = await cachePath(
    `/portfolios/users/${userId}/portfolios`,
    'json',
    { headers: { 'X-Csrf-Token': csrfToken }, allow404: true },
  ).catch(err =>
    err instanceof AnticipatedHttpError ? null : Promise.reject(err),
  )
  if (!portfolios) return
  for (const { id, title, description } of portfolios.data.portfolios) {
    const outPath = `${path}portfolios/${id}_${stringToPath(title)}/`
    const { data: portfolio }: ApiPortfolioResponse = await cachePath(
      `/portfolios/users/${userId}/portfolios/${id}`,
      'json',
      { headers: { 'X-Csrf-Token': csrfToken } },
    )
    await ensureDir(outPath)
    let needDownload = false
    outer: for (const item of portfolio.items) {
      for (const fileInfo of [item.file_info, item.metadata.file_info]) {
        if (fileInfo) {
          const path = `${outPath}${item.id}_${stringToPath(
            fileInfo.filename.slice(0, fileInfo.filename.lastIndexOf('.')),
          )}${fileInfo.filename.slice(fileInfo.filename.lastIndexOf('.'))}`
          if (!(await exists(path))) {
            needDownload = true
            break outer
          }
        }
      }
    }
    if (needDownload) {
      // Try to get unstale download links
      const { data: portfolio } = await attemptUrlNoCache(
        `${root}/portfolios/users/${userId}/portfolios/${id}`,
        csrfToken,
      )
      for (const item of portfolio.items) {
        for (const fileInfo of [item.file_info, item.metadata.file_info]) {
          if (fileInfo) {
            const path = `${outPath}${item.id}_${stringToPath(
              fileInfo.filename.slice(0, fileInfo.filename.lastIndexOf('.')),
            )}${fileInfo.filename.slice(fileInfo.filename.lastIndexOf('.'))}`
            await cachePath(external(fileInfo.tempURI), 'file', {
              cachePath: path,
            })
          }
        }
      }
    }
    await Deno.writeTextFile(
      outPath + 'index.html',
      html.page(
        html.style(
          html.raw(
            [
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
        // html.base({ href: root }),
        html.h1(title),
        html.p(description),
        html.p(
          html.em(
            `Created ${portfolio.created_at}`,
            portfolio.created_at !== portfolio.updated_at &&
              `, edited ${portfolio.updated_at}`,
          ),
        ),
        html.table(
          html.tr(html.th('Name and description'), html.th('Content')),
          portfolio.items.map(item => {
            return html.tr(
              html.td(
                html.strong(item.title),
                '\n',
                item.description,
                '\n',
                html.em(
                  `Created ${item.created_at}`,
                  item.created_at !== item.updated_at &&
                    `, edited ${item.updated_at}`,
                ),
              ),
              html.td(
                item.item_type === 'page'
                  ? html.raw(item.metadata.content)
                  : item.item_type === 'link'
                  ? html.a(
                      { href: item.metadata.absolute_url },
                      html.strong('Link'),
                    )
                  : null,
                item.file_info &&
                  html.a(
                    {
                      href: `${item.id}_${stringToPath(
                        item.file_info.filename.slice(
                          0,
                          item.file_info.filename.lastIndexOf('.'),
                        ),
                      )}${item.file_info.filename.slice(
                        item.file_info.filename.lastIndexOf('.'),
                      )}`,
                    },
                    item.file_info.filename,
                  ),
                item.metadata.file_info &&
                  html.a(
                    {
                      href: `${item.id}_${stringToPath(
                        item.metadata.file_info.filename.slice(
                          0,
                          item.metadata.file_info.filename.lastIndexOf('.'),
                        ),
                      )}${item.metadata.file_info.filename.slice(
                        item.metadata.file_info.filename.lastIndexOf('.'),
                      )}`,
                    },
                    item.metadata.file_info.filename,
                  ),
              ),
            )
          }),
        ),
      ),
    )
  }
}

if (import.meta.main) {
  await archivePortfolios(me.id, './output/users/2017219_Sean_Yen/')
}
