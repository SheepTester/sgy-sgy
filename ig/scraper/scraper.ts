// node --experimental-strip-types scraper.ts

import playwright from 'playwright'
import type { Response } from 'playwright'
// import cookies from "./cookies.json" with { type: "json" };
import path from 'path'
import fs from 'fs/promises'
import GenAI from '@google/genai'
import type { Part } from '@google/genai'
import { Collection, MongoClient } from 'mongodb'
import sharp from 'sharp'
const { GoogleGenAI } = GenAI

const client = new MongoClient(
  `mongodb+srv://${(
    await fs.readFile('mongo_userpass.txt', 'utf-8')
  ).trim()}@bruh.duskolx.mongodb.net/?retryWrites=true&w=majority&appName=Bruh`
)
await client.connect()
const db = client.db('events_db')
const collection: Collection<ScrapedEvent> = db.collection('events_collection')

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
type GraphQlResponse = {
  data: {
    xdt_api__v1__feed__reels_media__connection?: {
      edges: { node: EdgeNode }[]
    }
    xdt_api__v1__feed__timeline__connection?: {
      edges: { node: TimelinePostNode }[]
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

async function fetchImage (url: string, retries = 0): Promise<ArrayBuffer> {
  try {
    const response = await fetch(url).catch(error => {
      console.error(error)
      return Promise.reject(new Error(`Fetch error: ${url}`))
    })
    return response.arrayBuffer()
    // const buffer = Buffer.from(arrayBuffer);
    // return buffer.toString("base64");
  } catch (error) {
    if (retries < 3) {
      console.error(error)
      console.log(
        'fetching image failed. will try again in 5 secs. retries =',
        retries
      )
      await new Promise(resolve => setTimeout(resolve, 5 * 1000))
      return fetchImage(url, retries + 1)
    } else {
      throw error
    }
  }
}

const apiKey = (await fs.readFile('api_key.txt', 'utf-8')).trim()
const ai = new GoogleGenAI({ apiKey })

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
  "provided": string[], // List of tangible items (i.e. food and merch) provided at the event, if any, using the original phrasing from the post (e.g. "Dirty Birds", "Tapex", "Boba", "refreshments", "snacks", "food", "T-shirt"). Capitalize proper nouns. Keep the phrasing from the post the same but make sure the capitalization is correct (e.g. "Red Bull, bluebooks, scantrons", "clothes, hygiene products", "yummy plant-based food", "essential oils"). Avoid all caps. Make sure the spelling of the items is correct. Exclude items that must be purchased. 
  "location": string, // Adjust the capitalization appropriately. Do NOT respond to the location with all caps but capitalize necessary letters (e.g. "Library Walk" instead of "LIBRARY WALK", "UCSD Cross Cultural Center" instead of "ucsdcrossculturalcenter").
  "date": { "year": number; "month": number; "date": number }, // Month is between 1 and 12
  "start": { "hour": number; "minute": number }, // 24-hour format. Tip: something like "6-9 pm" is the same as "6 pm to 9 pm"
  "end": { "hour": number; "minute": number } // 24-hour format, optional and omitted if no end time specified
}`

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  dateStyle: 'long'
  // gemini will use the current time for the event :/
  // timeStyle: "short", // or medium since the timestamps have second precision
})
let geminiCalls = 0
let starting = 0
let geminiReady = Promise.resolve()
async function readImages (
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
    // max 15 RPM on free plan. 5 seconds just in case
    const ready = starting + (60 + 5) * 1000
    const delay = ready - Date.now()
    console.log('taking a', delay / 1000, 'sec break to cool off on gemini')
    await new Promise(resolve => setTimeout(resolve, delay))
    geminiCalls = 0
  }
  if (geminiCalls === 0) {
    starting = Date.now()
  }
  geminiCalls++
  try {
    // TODO: turn down the temperature maybe
    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        ...images.map(
          (buffer): Part =>
            // fetchImageAsBase64(url).then(
            // (dataUrl): Part => ({
            ({
              inlineData: {
                data: Buffer.from(buffer).toString('base64'),
                mimeType: 'image/jpeg'
              }
            })
          // })
          // )
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
        /"minute": 0([0-9])/,
        (_, digit) => `"minute": ${digit}`
      ) ?? '{}'
    )
  } catch (error) {
    // ServerError: got status: 503 Service Unavailable. {"error":{"code":503,"message":"The model is overloaded. Please try again later.","status":"UNAVAILABLE"}}
    // ServerError: got status: 500 Internal Server Error. {"error":{"code":500,"message":"Internal error encountered.","status":"INTERNAL"}}
    if (
      retries < 5 &&
      error instanceof Error &&
      (error.message.includes('503 Service Unavailable') ||
        error.message.includes('500 Internal Server Error'))
    ) {
      console.error('[gemini error]', error)
      const timeout = 60 * (retries + 1) + 5
      console.log(
        'cooling off for',
        timeout,
        'secs then retrying. retries =',
        retries
      )
      await new Promise(resolve => setTimeout(resolve, timeout * 1000))
      resolve()
      return readImages(images, timestamp, caption, retries + 1)
    } else {
      throw error
    }
  } finally {
    resolve()
  }
}

// https://oxylabs.io/blog/playwright-web-scraping
// Firefox: https://www.reddit.com/r/webscraping/comments/149czf4/how_i_can_bypass_antibot_in_playwright_or_seleium/jo5xhw2/
const browser = await playwright.firefox.launch({
  // see the browser
  // headless: false,
})
// const storageStateExists = await fs
//   .stat("auth.json")
//   .then(() => true)
//   .catch(() => false);
const context = await browser.newContext({
  // storageState: storageStateExists ? "auth.json" : undefined,
})
// if (!storageStateExists) {
await context.addCookies(JSON.parse(await fs.readFile('cookies.json', 'utf-8')))
// }
const page = await context.newPage()
const allUserStories: UserStories[] = []
const allTimelinePosts: TimelinePost[] = []
let id = 0
async function handleGraphQlResponse (
  response: GraphQlResponse
): Promise<void> {
  const {
    data: {
      xdt_api__v1__feed__reels_media__connection: storyData,
      xdt_api__v1__feed__timeline__connection: timelineData
    }
  } = response
  if (storyData) {
    const userStories = storyData.edges.map(
      ({ node: user }): UserStories => ({
        username: user.user.username,
        stories: user.items.map((item): Story => {
          return {
            imageUrl: selectBest(item.image_versions2.candidates, true),
            postId: item.story_feed_media?.[0].media_code ?? null,
            storyId: item.pk,
            timestamp: new Date(item.taken_at * 1000)
          }
        })
      })
    )
    allUserStories.push(...userStories)
    // for (const { username, stories } of userStories) {
    //   console.log(`[${username}]`);
    //   for (const story of stories) {
    //     console.log(story.imageUrl);
    //     if (story.postId) {
    //       console.log(`=> https://www.instagram.com/p/${story.postId}/`);
    //     }
    //   }
    //   console.log();
    // }
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
    allTimelinePosts.push(...timelinePosts)
    return
  }
  console.log('| this one has no stories')
}
async function handleResponse (response: Response): Promise<void> {
  // thanks chatgpt
  const url = response.url()
  if (new URL(url).pathname === '/graphql/query') {
    const buffer = await response.body()
    const filePath = path.join(
      'scraped',
      `d${id.toString().padStart(3, '0')}.json`
    )
    console.log(filePath, url)
    id++
    await fs.writeFile(filePath, buffer)
    await handleGraphQlResponse(JSON.parse(buffer.toString('utf-8')))
  }
  // if (buffer.slice(0, prefix.length).equals(prefix)) {
  //   await fs.writeFile(filePath + ".json", buffer.slice(prefix.length));
  // } else {
  //   await fs.writeFile(filePath, buffer);
  // }
}
const promises: Promise<void>[] = []
page.on('response', response => {
  promises.push(handleResponse(response))
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
for (const script of await page
  .locator('css=script[type="application/json"]')
  .all()) {
  const json = await script
    .textContent()
    .then(json => json && JSON.parse(json))
    .catch(() => {})
  const results = Array.from(analyze(json))
  for (const result of results) {
    await handleGraphQlResponse(result)
  }
}
console.log('i am instagramming now')
for (let i = 0; i < 10; i++) {
  await page.keyboard.press('End') // scroll to bottom
  await page
    .waitForRequest(
      request => new URL(request.url()).pathname === '/graphql/query',
      { timeout: 1000 }
    )
    .catch(() => console.log('no graphql query from pressing end key'))
  await page.waitForTimeout(500) // give time for page to update so i can press end key again
  console.log('end key', i + 1)
}
await page.keyboard.press('Home')
let storiesFromEnd = true
if (storiesFromEnd) {
  // scroll to end has several benefits:
  // - no ads
  // - will include already-read storeies
  // downside:
  // - will include already-read storeies
  const storyScroller = page.locator(
    'css=[data-pagelet="story_tray"] [role=presentation]'
  )
  await storyScroller.hover()
  for (let i = 0; i < 10; i++) await page.mouse.wheel(1000, 0)
  await page.locator('css=[aria-label^="Story by"]').last().click()
} else {
  const story = await page.waitForSelector('[aria-label^="Story by"]')
  console.log('i see the stories are ready for me to CLICK')
  await story.click()
}
console.log('story hath been click')
await page.waitForRequest(
  request => new URL(request.url()).pathname === '/graphql/query'
)
console.log('a request was made')
await page.waitForTimeout(1000)
const storyIterations = storiesFromEnd ? Infinity : 10
for (let i = 0; i < storyIterations; i++) {
  let story = page.locator('css=a[href^="/stories/"]')
  if (storiesFromEnd) {
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
      console.log("We're done with stories! yay")
      console.log('screenshot time!')
      await page.screenshot({ path: 'bruh.png', fullPage: true })
      break
    }
  } else {
    // click last visible story
    story = story.last()
  }
  await story.click()
  await page
    .waitForRequest(
      request => new URL(request.url()).pathname === '/graphql/query',
      { timeout: 1000 }
    )
    .catch(() =>
      console.log('no graphql query from paging down story, oh well')
    )
  await page.waitForTimeout(500) // give time for page to update so i can press end key again
  console.log('story pagination', i + 1)
}
await page.context().storageState({ path: 'auth.json' })
await context.close()
await browser.close()
console.log('i close the browser')

await Promise.all(promises)

async function insertIfNew (
  sourceId: string,
  url: string,
  imageUrls: string[],
  timestamp: Date,
  caption?: string
): Promise<GeminiResult[] | null> {
  const existingDoc = await collection.findOne({ sourceId })
  if (existingDoc) {
    return null
  }
  const images = await Promise.all(imageUrls.map(url => fetchImage(url)))
  const events = (await readImages(images, timestamp, caption)).filter(
    event => (event.provided ?? []).length > 0
  )
  if (events.length > 0) {
    for (const event of events) {
      if (event.date.year !== new Date().getFullYear()) {
        console.warn(event, 'is in a weird year')
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
  return events
}

for (const { username, stories } of allUserStories) {
  for (const { storyId, postId, imageUrl, timestamp } of stories) {
    const sourceId = `story/${username}/${storyId}`
    const url = postId
      ? `https://www.instagram.com/p/${postId}/`
      : `https://www.instagram.com/stories/${username}/${storyId}/`
    const added = await insertIfNew(sourceId, url, [imageUrl], timestamp)
    console.log(sourceId, added)
  }
}
for (const {
  username,
  postId,
  caption,
  imageUrls,
  timestamp
} of allTimelinePosts) {
  const sourceId = `post/${username}/${postId}`
  const url = `https://www.instagram.com/p/${postId}/`
  const added = await insertIfNew(sourceId, url, imageUrls, timestamp, caption)
  console.log(sourceId, added)
}

// console.log("allUserStories", allUserStories);
// console.log("allTimelinePosts", allTimelinePosts);
console.log('ok gamers we done')
process.exit(0)
