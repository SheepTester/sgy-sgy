// node --env-file=.env --experimental-strip-types scraper.ts

import type { Part } from '@google/genai'
import { ApiError, GoogleGenAI } from '@google/genai'
import fs from 'fs/promises'
import { Collection, MongoClient } from 'mongodb'
import type { Page, Response } from 'playwright'
import playwright from 'playwright'
import sharp from 'sharp'

// so it's easier to copypaste between floofy-bot and here
const isDev = true
const displayError = (error: unknown) =>
  error instanceof Error
    ? error.stack ?? `${error.name}: ${error.message}`
    : JSON.stringify(error)

let collectionPromise: Promise<Collection<ScrapedEvent>> | undefined

async function getCollection (): Promise<Collection<ScrapedEvent>> {
  const client = new MongoClient(
    `mongodb+srv://${process.env.FREE_FOOD_MONGO_USERPASS}@bruh.duskolx.mongodb.net/?retryWrites=true&w=majority&appName=Bruh`
  )
  await client.connect()
  const db = client.db('events_db')
  return db.collection('events_collection')
}

type ImageV2Candidate = {
  width: number
  height: number
  url: string
}
type StoryStickers<T = {}> =
  | (T & {
      x: number
      y: number
      width: number
      height: number
      rotation: number
    })[]
  | null
/** story */
type EdgeNode = {
  /** seems to be user iD */
  id: string
  items: {
    /** ID of story shown in URL */
    pk: string
    /** {pk}_{userId} I think */
    id: string
    accessibility_caption: string
    image_versions2: {
      candidates: ImageV2Candidate[]
    }
    /** unix timestamp in seconds */
    taken_at: number
    /** `taken_at` + 86400 */
    expiring_at: number
    /** an XML string */
    video_dash_manifest: string | null
    video_versions:
      | {
          type: number
          url: string
        }[]
      | null
    story_hashtags: StoryStickers<{
      hashtag: { name: string; id: string }
    }>
    story_feed_media: StoryStickers<{
      /** instagram post ID: https://www.instagram.com/p/___/ */
      media_code: string
    }>
    story_bloks_stickers: StoryStickers<{
      bloks_sticker: {
        sticker_data: {
          ig_mention: { full_name: string; username: string }
        }
      }
    }>
    story_link_stickers: StoryStickers<{
      story_link: {
        /**
         * a https://l.instagram.com/ link :(
         *
         * can be cleaned up with:
         *
         * @example
         * const url = new URL(new URL("https://l.instagram.com/?u=https%3A%2F%2Fgoogle.com%2F%3Ffbclid%3DPAZXh0bgNhZW0CMTEAAaeNc6WS9qpUAugNDZagvJQ73pKGfnlnQq0ZRfXeIO_D-jc1szmlZdwMM7cMPA_aem_xp9snzJoHdqx7DNg_wvvuw&e=AT2wJrjTj9FobakmZfhL847eoTJD0Nif8mYpAqvHOpj2akZkcaVXx4xU2YJdUbDAfoQ1iDbURq9LDxc-RA7DveuYm_-r1lgYuIIIUA").searchParams.get('u'))
         * url.searchParams.delete('fbclid')
         * url.toString()
         */
        url: string
      }
    }>
    story_locations: StoryStickers<{ location: { pk: string } }>
    story_countdowns: StoryStickers
    story_questions: StoryStickers
    story_sliders: StoryStickers
  }[]
  user: {
    username: string
    profile_pic_url: string
  }
}
/** post */
type TimelinePostNode = {
  /** `null` if ad (i.e. this already filters out ads) */
  media: {
    owner: {
      username: string
    }
    carousel_media:
      | {
          accessibility_caption: string
          image_versions2: {
            candidates: ImageV2Candidate[]
          }
        }[]
      | null
    code: string
    /** same as `owner`?? */
    user: {
      username: string
    }
    /** probably just the first slide */
    image_versions2: {
      candidates: ImageV2Candidate[]
    }
    /** unix timestamp in seconds */
    taken_at: number
    coauthor_producers: {
      id: string
      /** same as id? */
      pk: string
      profile_pic_url: string
      username: string
      full_name: string
    }[]
    /** `null` if no caption (i.e. empty string) */
    caption: {
      text: string
    } | null
  } | null
}
type StoryUser = {
  id: string
  has_besties_media: boolean
  muted: boolean
  latest_reel_media: number
  /** a timestamp(?) or 0 */
  seen: number
  expiring_at: number
  ranked_position: number
  /** seems to always be the same as `ranked_position`? */
  seen_ranked_position: number
  user: {
    pk: string
    username: string
    profile_pic_url: string
  }
}
type GraphQlResponse = {
  data: {
    xdt_api__v1__feed__reels_media__connection?: {
      edges: { node: EdgeNode }[]
    }
    xdt_api__v1__feed__timeline__connection?: {
      edges: { node: TimelinePostNode }[]
    }
    xdt_api__v1__feed__reels_tray?: {
      tray: StoryUser[]
    }
  }
}

type Story = {
  imageUrl: string
  storyId: string
  /** instagram post ID: https://www.instagram.com/p/___/ */
  postId: string | null
  timestamp: Date
}
type UserStories = {
  username: string
  stories: Story[]
}
type TimelinePost = {
  username: string
  caption: string
  imageUrls: string[]
  postId: string
  timestamp: Date
}

function selectBest (
  candidates: ImageV2Candidate[],
  excludeSquare = false
): string {
  return candidates.reduce<ImageV2Candidate>(
    (cum, curr) => {
      if (excludeSquare && curr.width === curr.height) {
        return cum
      }
      return curr.width > cum.width ? curr : cum
    },
    { width: 0, height: 0, url: '' }
  ).url
}

type GeminiResult = {
  provided: string[]
  location: string
  date: { year: number; month: number; date: number }
  start: { hour: number; minute: number }
  end?: { hour: number; minute: number }
}
type ScrapedEvent = (
  | (Omit<GeminiResult, 'provided'> & {
      freeFood: string[]
      result: true
      previewData?: string
      postTimestamp?: Date
      caption?: string
    })
  | { result: false }
) & {
  sourceId: string
  url: string | null
}

type ScrapeStats = {
  posts: number
  stories: number
  users: number
  note: string
}
type InsertStats = ScrapeStats & {
  newPosts: number
  newStories: number
  inserted: number
}

/**
 * prompt notes:
 * - changed phrasing of "free" to "provided" so it doesn't exclude e.g. "Lunch
 *   provided"
 * - removed mentions of "consumable" to include merch like T-shirts, but it
 *   might be too general now
 * - `end` was preemptively made optional, not as a response to Gemini's
 *   behavior
 * - sometimes gemini will generate a leading zero (e.g. `05`) for `minute`,
 *   which is invalid JSON
 * - sometimes gemini will set `location` to `null` instead of an empty string
 *   when location ins't specified
 * - had to include tip; otherwise text like "6-9 pm" will be treated as 6 am to
 *   9 pm
 * - if time isn't specified, gemini defaults to midnight
 * - the post date is included elsewhere. otherwise, when the year isn't
 *   specified, Gemini sometimes defaults to 2024
 * - unlike the date, including the time of the story/post would make gemini use
 *   that as the event start date, so the post time isn't included in the prompt
 * - added "tangible" to filter by food and merch and exclude things like "free
 *   admission"
 */
const schemaPrompt = `output only a JSON array of event objects without any explanation or formatting, whose contents each conform to the following schema.

{
  "provided": string[], // List of tangible items (i.e. food and merch) provided at the event, if any, using the original phrasing from the post (e.g. "Dirty Birds", "Tapex", "boba", "refreshments", "snacks", "food", "T-shirt"). Exclude items that must be purchased (e.g. fundraisers or discounts).
  "location": string,
  "date": { "year": number; "month": number; "date": number }, // Month is between 1 and 12
  "start": { "hour": number; "minute": number }, // 24-hour format. Tip: something like "6-9 pm" is the same as "6 pm to 9 pm"
  "end": { "hour": number; "minute": number } // 24-hour format, optional and omitted if no end time specified
}`

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  dateStyle: 'long'
  // omit time or gemini will use the current time for the event :/
})

const POST_PAGES = isDev ? 2 : 10

let ai: GoogleGenAI | undefined
let geminiCalls = 0
let starting = 0
let geminiReady = Promise.resolve()

type GeminiModel = 'gemini-2.0-flash' | 'gemini-2.5-flash'

export class FreeFoodScraper {
  #allUserStories: UserStories[] = []
  #allTimelinePosts: TimelinePost[] = []
  #expectedUsernameOrder: string[] = []
  #expectedUsernames = new Set<string>()
  #seenUsernames = new Set<string>()
  #model: GeminiModel = 'gemini-2.0-flash'

  logs = ''

  #log (message: string, error?: unknown): void {
    if (this.logs) {
      this.logs += '\n'
    }
    this.logs += message
    if (error !== undefined) {
      this.logs += ' ' + error
      if (isDev) {
        console.error(message, error)
      }
    } else if (isDev) {
      console.error(message)
    }
  }

  async #fetchImage (url: string, retries = 0): Promise<ArrayBuffer> {
    try {
      const response = await fetch(url).catch(error => {
        this.#log('[image]', error)
        return Promise.reject(new Error(`Fetch error: ${url}`))
      })
      return response.arrayBuffer()
    } catch (error) {
      if (retries < 3) {
        this.#log('[image]', error)
        this.#log(
          `[image] fetch failed. will try again in 5 secs. retries = ${retries}`
        )
        await new Promise(resolve => setTimeout(resolve, 5 * 1000))
        return this.#fetchImage(url, retries + 1)
      } else {
        throw error
      }
    }
  }

  async #readImages (
    images: ArrayBuffer[],
    timestamp: Date,
    caption?: string,
    retries = 0
  ): Promise<GeminiResult[]> {
    // ensure gemini calls are performed in series
    const { promise, resolve } = Promise.withResolvers<void>()
    const oldPromise = geminiReady
    geminiReady = geminiReady.then(() => promise)
    await oldPromise

    if (geminiCalls >= 15) {
      // max 15 RPM on free plan
      const ready = starting + 60 * 1000
      const delay = Math.max(ready - Date.now(), 0)
      this.#log(
        `[gemini] taking a ${delay / 1000 + 5} sec break to cool off on gemini`
      )
      await new Promise(resolve => setTimeout(resolve, delay))
      // 5 seconds just in case
      await new Promise(resolve => setTimeout(resolve, 5000))
      geminiCalls = 0
    }
    if (geminiCalls === 0) {
      starting = Date.now()
    }
    geminiCalls++
    ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    try {
      // TODO: turn down the temperature maybe
      const result = await ai.models.generateContent({
        model: this.#model,
        contents: [
          ...images.map(
            (buffer): Part => ({
              inlineData: {
                data: Buffer.from(buffer).toString('base64'),
                mimeType: 'image/jpeg'
              }
            })
          ),
          {
            text:
              `Using the following flyer${images.length !== 1 ? 's' : ''}${
                caption ? ' and caption' : ''
              }, which was posted ${fmt.format(timestamp)}, ${schemaPrompt}` +
              (caption ? '\n\n' + caption : '')
          }
        ],
        config: {
          responseMimeType: 'application/json'
        }
      })
      return JSON.parse(
        // sometimes will generate `"minute": 05` or `00`
        result.text?.replace(
          /"minute":\s*0+([0-9])/,
          (_, digit) => `"minute": ${digit}`
        ) ?? '{}'
      )
    } catch (error) {
      // ServerError: got status: 503 Service Unavailable. {"error":{"code":503,"message":"The model is overloaded. Please try again later.","status":"UNAVAILABLE"}}
      // ServerError: got status: 500 Internal Server Error. {"error":{"code":500,"message":"Internal error encountered.","status":"INTERNAL"}}
      // ClientError: got status: 429 Too Many Requests. {"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaMetric":"generativelanguage.googleapis.com/generate_content_free_tier_requests","quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier","quotaDimensions":{"location":"global","model":"gemini-2.0-flash"},"quotaValue":"15"}]},{"@type":"type.googleapis.com/google.rpc.Help","links":[{"description":"Learn more about Gemini API quotas","url":"https://ai.google.dev/gemini-api/docs/rate-limits"}]},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"23s"}]}}
      // ApiError: {"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 15\nPlease retry in 55.369243237s.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaMetric":"generativelanguage.googleapis.com/generate_content_free_tier_requests","quotaId":"GenerateRequestsPerMinutePerProjectPerModel-FreeTier","quotaDimensions":{"location":"global","model":"gemini-2.0-flash"},"quotaValue":"15"}]},{"@type":"type.googleapis.com/google.rpc.Help","links":[{"description":"Learn more about Gemini API quotas","url":"https://ai.google.dev/gemini-api/docs/rate-limits"}]},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"55s"}]}}
      // ApiError: {"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits.\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 200\nPlease retry in 55.515718001s.","status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.QuotaFailure","violations":[{"quotaMetric":"generativelanguage.googleapis.com/generate_content_free_tier_requests","quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier","quotaDimensions":{"location":"global","model":"gemini-2.0-flash"},"quotaValue":"200"}]},{"@type":"type.googleapis.com/google.rpc.Help","links":[{"description":"Learn more about Gemini API quotas","url":"https://ai.google.dev/gemini-api/docs/rate-limits"}]},{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"55s"}]}}
      if (
        retries < 5 &&
        error instanceof ApiError &&
        (error.status === 503 || error.status === 500 || error.status === 429)
      ) {
        this.#log('[gemini]', error)
        let timeout = 60 * (retries + 1) + 5
        if (error.status === 429) {
          const match = error.message.match(/"retryDelay":"(\d+)s"/)
          if (match) {
            timeout = +match[1] + 5
          }
          if (
            error.message.includes(
              'GenerateRequestsPerDayPerProjectPerModel'
            ) ||
            error.message.includes('The model is overloaded.')
          ) {
            const nextModel: GeminiModel =
              this.#model === 'gemini-2.0-flash'
                ? 'gemini-2.5-flash'
                : 'gemini-2.0-flash'
            this.#log(
              `[gemini] ${this.#model} ${
                error.message.includes(
                  'GenerateRequestsPerDayPerProjectPerModel'
                )
                  ? 'ratelimit reached'
                  : 'overloaded'
              }, switching to ${nextModel}`
            )
            this.#model = nextModel
          }
        }
        this.#log(
          `[gemini] cooling off for ${timeout} secs then retrying. retries = ${retries}`
        )
        await new Promise(resolve => setTimeout(resolve, timeout * 1000))
        resolve()
        return this.#readImages(images, timestamp, caption, retries + 1)
      } else {
        throw error
      }
    } finally {
      resolve()
    }
  }

  async #handleGraphQlResponse (response: GraphQlResponse): Promise<void> {
    const {
      data: {
        xdt_api__v1__feed__reels_media__connection: storyData,
        xdt_api__v1__feed__timeline__connection: timelineData,
        xdt_api__v1__feed__reels_tray: storyUserData,
        ...rest
      }
    } = response
    if (storyData) {
      const userStories = storyData.edges.map(({ node: user }): UserStories => {
        this.#seenUsernames.add(user.user.username)
        return {
          username: user.user.username,
          stories: user.items.map((item): Story => {
            return {
              imageUrl: selectBest(item.image_versions2.candidates, true),
              postId: item.story_feed_media?.[0].media_code ?? null,
              storyId: item.pk,
              timestamp: new Date(item.taken_at * 1000)
            }
          })
        }
      })
      this.#allUserStories.push(...userStories)
      this.#log(`[graph ql] found ${userStories.length} stories`)
      return
    }
    if (timelineData) {
      const timelinePosts = timelineData.edges.flatMap(
        ({ node: { media } }): TimelinePost[] => {
          if (!media) {
            return []
          }
          const images: {
            image_versions2: { candidates: ImageV2Candidate[] }
          }[] = media.carousel_media ?? [media]
          return [
            {
              username: media.owner.username,
              caption: media.caption?.text ?? '',
              imageUrls: images.map(({ image_versions2 }) =>
                selectBest(image_versions2.candidates)
              ),
              postId: media.code,
              timestamp: new Date(media.taken_at * 1000)
            }
          ]
        }
      )
      this.#allTimelinePosts.push(...timelinePosts)
      this.#log(`[graph ql] found ${timelinePosts.length} posts`)
      return
    }
    if (storyUserData) {
      if (this.#expectedUsernames.size > 0) {
        throw new Error('Received story usernames twice?')
      }
      this.#expectedUsernames = new Set(
        storyUserData.tray.map(user => user.user.username)
      )
      this.#expectedUsernameOrder = storyUserData.tray
        .toSorted((a, b) => a.ranked_position - b.ranked_position)
        .map(user => user.user.username)
      this.#log(`[graph ql] found ${this.#expectedUsernames.size} story users`)
      return
    }
    this.#log(`[graph ql] has no posts/stories: ${Object.keys(rest)[0]}`)
  }

  async #handleResponse (response: Response): Promise<void> {
    const url = response.url()
    if (new URL(url).pathname === '/graphql/query') {
      const buffer = await response.body()
      await this.#handleGraphQlResponse(JSON.parse(buffer.toString('utf-8')))
    }
  }

  async #insertIfNew (
    sourceId: string,
    url: string,
    imageUrls: string[],
    timestamp: Date,
    caption?: string
  ): Promise<number | null> {
    collectionPromise ??= getCollection()
    const collection = await collectionPromise
    const existingDoc = await collection.findOne({ sourceId })
    if (existingDoc) {
      this.#log(`[insert] ${sourceId} already added`)
      return null
    }
    const images = await Promise.all(
      imageUrls.map(url => this.#fetchImage(url))
    )
    const events = (await this.#readImages(images, timestamp, caption)).filter(
      event => (event.provided ?? []).length > 0
    )
    if (events.length > 0) {
      for (const event of events) {
        if (event.date.year !== new Date().getFullYear()) {
          this.#log(`[insert] ${JSON.stringify(event)} is in a weird year`)
        }
      }
      // it kinda looks like they're all 4:5 now :/
      const buffer = await sharp(images[0])
        .resize(80, 100, { fit: 'cover' })
        .webp({ quality: 20 })
        .toBuffer()
      const previewData = buffer.toString('base64')
      await collection.insertMany(
        events.map(
          ({ provided, ...event }): ScrapedEvent => ({
            freeFood: provided,
            ...event,
            sourceId,
            url,
            previewData,
            postTimestamp: timestamp,
            caption,
            result: true
          })
        )
      )
    } else {
      await collection.insertOne({
        sourceId,
        url,
        result: false
      })
    }
    this.#log(`[insert] ${sourceId} added ${JSON.stringify(events)}`)
    return events.length
  }

  async #scrollStories (
    page: Page,
    target?: string
  ): Promise<playwright.Locator> {
    // Make sure the story tray is visible
    let done = false
    const promise = page
      .locator('css=[data-pagelet="story_tray"]')
      .waitFor({ timeout: 1000 })
      .catch(() => {})
      .then(() => (done = true))
    while (!done) {
      await page.keyboard.press('Escape')
    }
    await promise
    const seenUsernames = new Set<string>()
    try {
      while (true) {
        await page
          .locator('css=[data-pagelet="story_tray"] [aria-label="Next"]')
          .click({ timeout: 1000 })
        await page.waitForTimeout(100 + Math.random() * 400)
        for (const username of await page
          .locator('css=[aria-label^="Story by"]')
          .evaluateAll(stories =>
            stories
              .map(elem => elem.ariaLabel?.split(',')[0]?.split(' ').at(-1))
              .filter(x => x !== undefined)
          )) {
          seenUsernames.add(username)
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('ms exceeded.')) {
        this.#log(
          "[scroll] Failed to find next story row page button. We're at the end!"
        )
      } else {
        throw error
      }
    }
    const missing = this.#expectedUsernames.difference(seenUsernames)
    const extra = seenUsernames.difference(this.#expectedUsernames)
    if (missing.size > 0) {
      console.log(`[scroll] missing: ${Array.from(missing).join(', ')}`)
    }
    if (extra.size > 0) {
      console.log(`[scroll] extra: ${Array.from(extra).join(', ')}`)
    }
    if (!target) {
      return page.locator('css=[aria-label^="Story by"]').last()
    }
    // tbh this for loop is not necessary because page.locator will fail when it
    // doesn't see the Go back button
    for (let i = 0; i < 50; i++) {
      const count = await page
        .locator(`css=[aria-label^="Story by ${target},"]`)
        .count()
      if (count === 1) {
        return page.locator(`css=[aria-label^="Story by ${target},"]`)
      }
      if (count > 1) {
        throw new Error(`Found multiple for ${target}`)
      }
      await page
        .locator('css=[data-pagelet="story_tray"] [aria-label="Go back"]')
        .click({ timeout: 1000 })
      await page.waitForTimeout(100 + Math.random() * 400)
    }
    throw new Error(`Couldn't find ${target} in 50 pages`)
  }

  async main (
    onBrowserEnd?: (error: unknown | undefined, stats: ScrapeStats) => void
  ): Promise<InsertStats> {
    await fs.rm('data/free-food-debug-screenshot.png', { force: true })
    let note = ''

    const browser = await playwright.firefox.launch()
    const context = await browser.newContext()
    await context.addCookies(
      Object.entries({
        ig_nrcb: '1',
        ps_l: '1',
        ps_n: '1',
        wd: '1440x825',
        ...JSON.parse(process.env.FREE_FOOD_COOKIES ?? '{}')
      }).map(([name, value]) => ({
        name,
        value: String(value),
        path: '/',
        domain: '.instagram.com'
      }))
    )
    const page = await context.newPage()

    const promises: Promise<void>[] = []
    try {
      page.on('response', response => {
        promises.push(this.#handleResponse(response))
      })
      await page.goto('https://instagram.com/')
      function * analyze (x: any): Generator<GraphQlResponse> {
        for (const req of x.require ?? []) {
          const args = req.at(-1)
          for (const arg of args) {
            if (arg?.__bbox) {
              if (arg.__bbox.complete) yield arg.__bbox.result
              else yield * analyze(arg.__bbox)
            }
          }
        }
      }
      let hasThereBeenAGraphQlResponse = false
      for (const script of await page
        .locator('css=script[type="application/json"]')
        .all()) {
        const json = await script
          .textContent()
          .then(json => json && JSON.parse(json))
          .catch(() => {})
        const results = Array.from(analyze(json))
        for (const result of results) {
          await this.#handleGraphQlResponse(result)
          hasThereBeenAGraphQlResponse = true
        }
      }
      if (!hasThereBeenAGraphQlResponse) {
        throw new Error(
          '[browser] No graphql responses received. Something is awry.'
        )
      }
      if (this.#expectedUsernames.size === 0) {
        throw new Error('expected some story usernames on page load')
      }
      this.#log('[browser] Scrolling down posts...')
      for (let i = 0; i < POST_PAGES; i++) {
        await page.keyboard.press('End') // scroll to bottom
        const start = performance.now()
        let done = false
        const promise = page
          .waitForRequest(
            request => new URL(request.url()).pathname === '/graphql/query',
            // it takes like 3s for me in the browser, like damn that's slow
            { timeout: 5000 }
          )
          .then(() =>
            this.#log(
              `[browser] end key ${i + 1}: graphql took ${(
                (performance.now() - start) /
                1000
              ).toFixed(3)}s`
            )
          )
          .catch(async () => {
            this.#log(`[browser] end key ${i + 1}: no graphql query`)
            // await page.screenshot({ path: `data/no-graphql-query-${i + 1}.png` })
            // await page.screenshot({
            //   path: `data/no-graphql-query-${i + 1}-full.png`,
            // fullPage: true
            // })
          })
          .finally(() => {
            done = true
          })
        // keep trying to scroll to bottom
        while (!done) {
          await page.keyboard.press('End')
          await page.waitForTimeout(100 + Math.random() * 400)
        }
        await promise
      }
      await page.keyboard.press('Home')
      // scroll to end has several benefits:
      // - no ads
      // - will include already-read stories
      // downside:
      // - will include already-read stories
      const target = await this.#scrollStories(page)
      // it might make the request immediately while clicking so need to wait
      // for request before click :/
      await target.click()
      // wait for stories close button
      await page.locator('css=[aria-label="Close"]').waitFor()
      this.#log('[browser] It seems the stories have opened.')
      await page.waitForTimeout(1000)
      const seenUsernames = new Set<string>()
      let lastUsername: string | null = null
      let stuckAt: string | null = null
      let stucks = 0
      for (let i = 0; ; i++) {
        if (i > 500) {
          throw new Error('I am stuck somehow')
        }
        // await page.screenshot({
        //   path: `data/screen-stories-${i}.png`
        // fullPage: true
        // })
        let story = page.locator('css=a[href^="/stories/"]')
        // click first visible story
        story = story.first()
        const atEnd = await story.evaluate(link => {
          // See if the first clickable story is preceded by the currently viewed
          // story, which has the Menu (3 dots) button shown. If so, then the
          // currently viewed story is the first story in the row, so we're at the
          // end
          return !!link.parentElement?.previousElementSibling?.querySelector(
            '[aria-label="Menu"]'
          )
        })
        if (atEnd) {
          this.#log("[browser] We're done with stories! yay")
          break
        }
        // [...$$('[aria-label="Menu"]')[0].closest('[style*="transform: translate"]').querySelectorAll('[role="link"]')][1].textContent
        const usernames = await page
          .locator('css=[aria-label="Menu"]')
          .first()
          .evaluate(menuBtn => {
            const parent = menuBtn.closest('[style*="transform: translate"]')
            if (!parent) {
              let output = ''
              let e: SVGElement | HTMLElement | null = menuBtn
              while (e) {
                output += `${e.outerHTML.split('>')[0]}\n`
                e = e.parentElement
              }
              return { success: false, output }
            }
            const usernames = Array.from(
              parent.querySelectorAll('[role="link"]'),
              link => link.textContent
            )
            return { success: true, usernames }
          })
        if (usernames.success) {
          this.#log(`[username] Usernames: ${JSON.stringify(usernames)}`)
        } else {
          this.#log(`[username] No translate parent\n${usernames.output}`)
        }
        let username = usernames.usernames?.[1]
        if (!username) {
          throw new Error('Expected to find a story username')
        }
        if (username === lastUsername) {
          this.#log(`[stuck] Stuck at ${username}, exiting and reentering...`)
          if (username === stuckAt) {
            stucks++
            if (stucks > 3) {
              this.#log(`[stuck] Really stuck at ${username} D:`)
              await page.screenshot({
                path: 'data/free-food-debug-screenshot.png'
                // fullPage: true
              })
              break
            }
            // Move on to the next username /shrug
            username =
              this.#expectedUsernameOrder[
                this.#expectedUsernameOrder.indexOf(username) - 1
              ]
          }
          stuckAt = username
          // just in case
          lastUsername = ''
          seenUsernames.clear()
          await page.keyboard.press('Escape')
          const target = await this.#scrollStories(page, username)
          await target.click()
          await page.locator('css=[aria-label="Close"]').waitFor()
          this.#log('[stuck] We resume')
          continue
        }
        if (seenUsernames.has(username)) {
          this.#log(`[username] We seem to have already seen ${username}`)
        }
        if (!this.#expectedUsernames.has(username)) {
          throw new Error(`who tf is ${username}`)
        }
        seenUsernames.add(username)
        lastUsername = username
        const start = performance.now()
        let done = false
        const promise = page
          .waitForRequest(
            request => new URL(request.url()).pathname === '/graphql/query',
            { timeout: 1000 }
          )
          .then(() =>
            this.#log(
              `[browser] story up ${i + 1} (${username}): graphql took ${(
                (performance.now() - start) /
                1000
              ).toFixed(3)}s`
            )
          )
          .catch(() =>
            this.#log(
              `[browser] story up ${i + 1} (${username}): no graphql query`
            )
          )
          .finally(() => {
            done = true
          })
        await story.click()
        await page.waitForTimeout(500 + Math.random() * 500)
        while (!done) {
          // go up by user rather than story
          await page.keyboard.press('ArrowUp')
          await page.waitForTimeout(500 + Math.random() * 500)
        }
        await promise
      }

      const tried = new Set<string>()
      while (true) {
        // Calculate missing each time because we might mark more than just
        // `username` was read
        const missing = this.#expectedUsernames.difference(this.#seenUsernames)
        const username = Array.from(missing).find(
          username => !tried.has(username)
        )
        if (!username) {
          break
        }
        tried.add(username)
        try {
          const target = await this.#scrollStories(page, username)
          await target.click()
          await page.locator('css=[aria-label="Close"]').waitFor()
          await page.keyboard.press('Escape')
          await page.waitForTimeout(500 + Math.random() * 500)
          this.#log(`[missing] Successfully read ${username}`)
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes('ms exceeded.')
          ) {
            this.#log(
              `[missing] Failed to read ${username}: ${displayError(error)}`
            )
            await page.screenshot({
              path: 'data/free-food-debug-screenshot.png'
            })
            continue
          }
          throw error
        }
      }

      // Wait for requests to finish
      await Promise.all(promises)
      await page
        .context()
        .storageState({ path: 'data/free-food-debug-auth.json' })

      const missing2 = this.#expectedUsernames.difference(this.#seenUsernames)
      const extra = this.#seenUsernames.difference(this.#expectedUsernames)
      if (missing2.size > 0) {
        throw new Error(
          `[missing] Still missing story users: ${[...missing2].join(', ')}`
        )
      }
      if (extra.size > 0) {
        throw new Error(`Extra story users: ${[...extra].join(', ')}`)
      }
      note += missing2.size > 0 ? `Missing: ${[...missing2].join(', ')}\n` : ''

      onBrowserEnd?.(undefined, { ...this.#stats(), note })
    } catch (error) {
      this.#log('[browser] There was an error! 🚨')
      await page.screenshot({
        path: 'data/free-food-debug-screenshot.png'
        // fullPage: true
      })
      onBrowserEnd?.(error, { ...this.#stats(), note })
    } finally {
      await context.close()
      await browser.close()
      this.#log('[browser] i close the browser')
    }

    let total = 0
    let oldStories = 0
    for (const { username, stories } of this.#allUserStories) {
      for (const { storyId, postId, imageUrl, timestamp } of stories) {
        const sourceId = `story/${username}/${storyId}`
        const url = postId
          ? `https://www.instagram.com/p/${postId}/`
          : `https://www.instagram.com/stories/${username}/${storyId}/`
        total +=
          (await this.#insertIfNew(sourceId, url, [imageUrl], timestamp)) ??
          (oldStories++, 0)
      }
    }
    let oldPosts = 0
    for (const { username, postId, caption, imageUrls, timestamp } of this
      .#allTimelinePosts) {
      const sourceId = `post/${username}/${postId}`
      const url = `https://www.instagram.com/p/${postId}/`
      total +=
        (await this.#insertIfNew(
          sourceId,
          url,
          imageUrls,
          timestamp,
          caption
        )) ?? (oldPosts++, 0)
    }

    this.#log('[insert] ok gamers we done')
    const stats = this.#stats()
    return {
      ...stats,
      inserted: total,
      newPosts: this.#allTimelinePosts.length - oldPosts,
      newStories: stats.stories - oldStories,
      note
    }
  }

  #stats (): Omit<ScrapeStats, 'note'> {
    const totalStories = this.#allUserStories.reduce(
      (cum, curr) => cum + curr.stories.length,
      0
    )
    return {
      posts: this.#allTimelinePosts.length,
      users: this.#seenUsernames.size,
      stories: totalStories
    }
  }
}

console.log('ok gamers we done. events:', await new FreeFoodScraper().main())
// Doesn't exit on its own because MongoDB client is still active
process.exit(0)
