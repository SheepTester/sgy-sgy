// deno run --allow-all --location https://example.com/ dining.ts

import {
  DOMParser,
  HTMLDocument
} from 'https://deno.land/x/deno_dom@v0.1.15-alpha/deno-dom-wasm.ts'

function unwrap (): never {
  throw new Error(
    "I got a value that is null or undefined, which wasn't what I was expecting."
  )
}
function expect<T> (type: { new (): T }, value: unknown): T {
  if (value instanceof type) {
    return value
  } else {
    throw new Error(
      `I expected a ${type.name}, but instead I got a ${
        typeof value === 'object' && value !== null
          ? value?.constructor?.name ?? 'object'
          : typeof value
      }`
    )
  }
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
  ?.match(/ASP\.NET_SessionId=(\w+);/)?.[1] ?? unwrap()}`
// console.log(cookie)

async function request (
  path: string,
  { body, cache = true }: { body?: string; cache?: boolean } = {}
) {
  const key = `sgy-sgy/hdh/dining/${path}`
  const value = localStorage.getItem(key)
  if (cache && body === undefined && value !== null) {
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

function setMeal (meal: Meal) {
  return request('/changeMenuOption', { body: `sel=${meal}` }).then(parseHtml)
}
function getMenu (location: string, day: number) {
  return request(`/GetRestruantMenus?id=${day}&loc=${location}`).then(parseHtml)
}

const iconKeySource = {
  'Legend: Vegan Icon': 'vegan',
  'Legend: Vegetarian Icon': 'vegetarian',
  'Legend: Wellness Icon': 'wellness',
  'Legend: Contains Dairy Icon': 'dairy',
  'Legend: Contains TreeNuts Icon': 'treenuts',
  'Legend: Contains Soy Icon': 'soy',
  'Legend: Contains Wheat Icon': 'wheat',
  'Legend: Contains Fish Icon': 'fish',
  'Legend: Contains Shellfish Icon': 'shellfish',
  'Legend: Contains Peanuts Icon': 'peanuts',
  'Legend: Contains Eggs Icon': 'eggs',
  'Legend: Contains Gluten Icon': 'gluten'
} as const
const iconKey: {
  [alt: string]: typeof iconKeySource[keyof typeof iconKeySource]
} = iconKeySource

const meals = ['Breakfast', 'Lunch', 'Dinner'] as const
type Meal = typeof meals[number]

const days = [1, 2, 3, 4, 5, 6, 7] as const
type Day = typeof days[number]

type Restaurant = {
  name: string
  description: string
  schedule: {
    [stationName: string]: {
      [day in Day]?: [number, number]
    }
  }
}

type MenuItem = {
  price?: number
  icons: typeof iconKeySource[keyof typeof iconKeySource][]
  times: [Day, Meal][]
}

type MenuResults = {
  restaurant: Restaurant
  menu: {
    [menuName: string]: {
      [itemName: string]: MenuItem
    }
  }
}

const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
function parseTime (hour: string, minute: string, half: string): number {
  return (
    ((half === 'a' ? +hour : hour === '12' ? 12 : +hour + 12) % 24) * 60 +
    +minute
  )
}
function parseRestaurant (document: HTMLDocument): Restaurant {
  const name = document.getElementById('facility')?.textContent ?? unwrap()
  const description = document.getElementById('teaser')?.textContent ?? unwrap()
  const schedule: Restaurant['schedule'] = {}
  for (const scheduleWrapper of document.querySelectorAll('#hours-standard')) {
    const [lh, li] = scheduleWrapper.children
    const name = lh.childNodes[0].nodeValue ?? unwrap()
    schedule[name] = {}
    for (const [i, day] of days.entries()) {
      // / +/ is needed because "Mon 7:00 am  - 9:00 pm" has a double space
      const match = li.children[i].textContent.match(
        /(Mon|Tue|Wed|Thu|Fri|Sat|Sun) +(Closed|(1?\d+):(\d\d) +([ap])m +- +(1?\d+):(\d\d) +([ap])m)/
      )
      if (!match) {
        console.error(li.children[i].textContent.trim())
        throw new Error('regex no match')
      }
      const [
        ,
        dayName,
        isClosed,
        openHour,
        openMinute,
        openHalf,
        closeHour,
        closeMinute,
        closeHalf
      ] = match
      if (dayNames[day] !== dayName) {
        throw new Error(`${dayName} vs ${day}`)
      }
      if (isClosed !== 'Closed') {
        schedule[name][day] = [
          parseTime(openHour, openMinute, openHalf),
          parseTime(closeHour, closeMinute, closeHalf)
        ]
      }
    }
  }
  return {
    name,
    description,
    schedule
  }
}

async function scrapeMenu (
  locationId: string,
  meal: Meal,
  results: MenuResults
) {
  const today = new Date().getDay()
  for (const day of days) {
    // It seems the day menu IDs are based on the current day. For example,
    // since today is Wednesday at the time of writing, Sunday's ID is 4.
    const offset = (day + 7 - today) % 7
    const document = await getMenu(locationId, offset)

    const restaurant = parseRestaurant(document)
    if (
      results.restaurant.name !== '' &&
      JSON.stringify(results.restaurant) !== JSON.stringify(restaurant)
    ) {
      console.error(results.restaurant, restaurant)
      throw new Error('Restaurant info does not match')
    }
    results.restaurant = restaurant

    const menus = document.getElementById('menuContainer') ?? unwrap()
    for (const menu of menus.children) {
      const ul = menu.querySelector('ul')
      if (!ul) {
        // Sometimes there's an empty <div> </div> for some reason
        continue
      }
      let menuName = ''
      for (const menuItem of ul.children) {
        if (menuItem.tagName === 'LH') {
          menuName = menuItem.childNodes[0].nodeValue?.trim() ?? unwrap()
          if (menuName === 'Nutritional & Allergen Icons') {
            break
          }
          if (!results.menu[menuName]) {
            results.menu[menuName] = {}
          }
        } else {
          const [
            itemName,
            price = null
          ] = menuItem.children[0].textContent
            .split('$')
            .map(part => part.trim())
          const datum: MenuItem = {
            icons: [...menuItem.children]
              .filter(child => child.tagName === 'IMG')
              .map(
                image =>
                  iconKey[image.getAttribute('alt') ?? unwrap()] ?? unwrap()
              ),
            times: []
          }
          if (price !== null) {
            datum.price = +price
          }
          if (results.menu[menuName][itemName]) {
            if (
              results.menu[menuName][itemName].price !== datum.price ||
              results.menu[menuName][itemName].icons.join(' ') !==
                datum.icons.join(' ')
            ) {
              console.error(results.menu[menuName][itemName], datum)
              throw new Error('Menu item info does not match')
            }
          } else {
            results.menu[menuName][itemName] = datum
          }
          results.menu[menuName][itemName].times.push([day, meal])
        }
      }
    }
  }
}

// Necessary for setting the meal to work
await request('/MenuItem/24', { cache: false })

for (const locationId of locationIds) {
  const results: MenuResults = {
    restaurant: { name: '', description: '', schedule: {} },
    menu: {}
  }
  for (const meal of meals) {
    await setMeal(meal)
    await scrapeMenu(locationId, meal, results)
  }
  console.log(results)

  break
}
