// deno run --allow-all --location https://example.com/ dining.ts

import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.15-alpha/deno-dom-wasm.ts'

function unwrap (): never {
  throw new Error(
    "I got a value that is null or undefined, which wasn't what I was expecting."
  )
}
function assertOk (response: Response) {
  if (response.ok) {
    return response
  } else {
    throw new Error(`HTTP ${response.status} error from ${response.url}`)
  }
}
const parser = new DOMParser()
function parseHtml (html: string) {
  return parser.parseFromString(html, 'text/html') ?? unwrap()
}

const homePageResponse = await fetch(
  'https://hdh-web.ucsd.edu/dining/apps/diningservices/Restaurants/'
).then(assertOk)
const cookie = `ASP.NET_SessionId=${homePageResponse.headers
  .get('set-cookie')
  ?.match(/ASP\.NET_SessionId=(\w+)/)?.[1] ?? unwrap()}`
// console.log(cookie)

async function request (path: string, body?: string) {
  const key = `sgy-sgy/hdh/dining/${path}-${body}`
  const value = localStorage.getItem(key)
  if (value !== null) {
    return value
  } else {
    const html = await fetch(
      'https://hdh-web.ucsd.edu/dining/apps/diningservices/Restaurants' + path,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          cookie
        },
        body,
        method: body !== undefined ? 'POST' : 'GET'
      }
    )
      .then(assertOk)
      .then(r => r.text())
    localStorage.setItem(key, html)
    return html
  }
}

// Funnily, 64°'s ID is fixed at 64
const locationIds = await homePageResponse
  .text()
  .then(
    html =>
      new Set(
        Array.from(
          html.matchAll(
            /\/dining\/apps\/diningservices\/Restaurants\/MenuItem\/(\d\d)/g
          ),
          ([, location]) => location
        )
      )
  )

function setMeal (meal: 'Breakfast' | 'Lunch' | 'Dinner') {
  return request('/changeMenuOption', `sel=${meal}`).then(parseHtml)
}
function getMenu (location: string, day: number) {
  return request(`/GetRestruantMenus?id=${day}&loc=${location}`).then(parseHtml)
}

// Necessary for setting the meal to work
await request('/MenuItem/24')
for (const locationId of locationIds) {
  const page = await setMeal('Breakfast')

  for (let offset = 0; offset < 7; offset++) {
    const day = new Date().getDay()
  }
  break
}
await Deno.writeTextFile(
  './test.html',
  (await getMenu('24', 0)).documentElement?.outerHTML ?? unwrap()
)
