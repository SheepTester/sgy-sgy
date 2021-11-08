// deno run --allow-all dining.ts

import {
  DOMParser,
  HTMLDocument
} from 'https://deno.land/x/deno_dom@v0.1.15-alpha/deno-dom-wasm.ts'
import { ensureDir } from 'https://deno.land/std@0.101.0/fs/ensure_dir.ts'
import { assertEquals } from 'https://deno.land/std@0.113.0/testing/asserts.ts'
import {
  Meal,
  Restaurant,
  createDayMap,
  days,
  dayNames,
  parseTime,
  MenuResults,
  MenuItem,
  iconKey,
  bitfield,
  meals,
  assertOk,
  unwrap
} from './dining-common.ts'

await ensureDir('./.cache/')
await ensureDir('./dining/')

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
  cache = false // Cache just doesn't work well with how HDH does their thing
  const cachePath = `./.cache/sgy-sgy_hdh_dining_${path.replaceAll(
    '/',
    '_'
  )}_${body ?? 'GET'}.html`
  return await (cache ? Deno.readTextFile(cachePath) : Promise.reject()).catch(
    async () => {
      const html = await fetch(
        'https://hdh-web.ucsd.edu/dining/apps/diningservices/Restaurants' +
          path,
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
      Deno.writeTextFile(cachePath, html)
      return html
    }
  )
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

async function setMeal (meal: Meal) {
  return parseHtml(
    await request('/changeMenuOption', {
      body: `sel=${meal}`,
      cache: false
    })
  )
}
async function getMenu (location: string, day: number) {
  return parseHtml(
    await request(`/GetRestruantMenus?id=${day}&loc=${location}`)
  )
}

function parseRestaurant (document: HTMLDocument): Restaurant {
  const name =
    document.getElementById('facility')?.textContent.trim() ?? unwrap()
  const description =
    document.getElementById('teaser')?.textContent.trim() ?? unwrap()
  const schedule: Restaurant['schedule'] = {}
  for (const scheduleWrapper of document.querySelectorAll('#hours-standard')) {
    const [lh, li] = scheduleWrapper.children
    const name = lh.childNodes[0].nodeValue?.trim() ?? unwrap()
    schedule[name] = createDayMap(null)
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

    // Sanity check: ensure meal and date are correct
    // AIYA don't forget that WSL's clock can desync!
    assertEquals(
      document.getElementById('mySelect')?.querySelector('option[selected]')
        ?.textContent,
      meal
      // 'Dropdown does not have correct meal'
    )
    assertEquals(
      document.querySelector('.datenow')?.textContent.split(',')[0],
      [
        '',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday'
      ][day]
      // 'Incorrect day selected'
    )

    const restaurant = parseRestaurant(document)
    if (
      results.restaurant.name !== '' &&
      JSON.stringify(results.restaurant) !== JSON.stringify(restaurant)
    ) {
      console.error(results.restaurant, restaurant)
      throw new Error('Restaurant info does not match')
    }
    results.restaurant = restaurant

    // Get links to dining halls from the navbar at the top because the Bistro
    // isn't listed on the home page
    for (const link of document.getElementById('mainNav')?.children ??
      unwrap()) {
      locationIds.add(link.getAttribute('href')?.match(/\d+/)?.[0] ?? unwrap())
    }

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
          let datum: MenuItem = {
            icons: [...menuItem.children]
              .filter(child => child.tagName === 'IMG')
              .map(
                image =>
                  iconKey[image.getAttribute('alt') ?? unwrap()] ?? unwrap()
              ),
            times: createDayMap(0)
          }
          if (price !== null) {
            datum.price = +price
          }
          if (results.menu[menuName][itemName]) {
            if (
              results.menu[menuName][itemName].icons.join(' ') !==
              datum.icons.join(' ')
            ) {
              console.error(
                results,
                menuName,
                itemName,
                results.menu[menuName][itemName],
                datum
              )
              throw new Error('Menu item info does not match')
            } else if (results.menu[menuName][itemName].price !== datum.price) {
              if (results.menu[menuName][itemName].price && datum.price) {
                // Mistakes from HDH? 😔
                // - Wolftown Shrimp Asada is $5 Tuesday lunch and $0.75 Wednesday
                //   lunch
                // - 64° lists a $1 and $5 Marinated Chicken Breast in the same
                //   menu
                console.warn(
                  results.restaurant.name,
                  day,
                  meal,
                  menuName,
                  itemName,
                  'Prices do not match',
                  results.menu[menuName][itemName].price,
                  datum.price
                )
              }
              results.menu[menuName][itemName].price =
                results.menu[menuName][itemName].price ?? datum.price
            }
            datum = results.menu[menuName][itemName]
          } else {
            results.menu[menuName][itemName] = datum
          }
          if (typeof datum.times !== 'string') {
            datum.times[day] |= bitfield[meal]
          }
        }
      }
    }
  }
}

let list = 'ID | Dining hall name\n--- | ---\n'

for (const locationId of locationIds) {
  const results: MenuResults = {
    restaurant: { name: '', description: '', schedule: {} },
    menu: {}
  }
  // Necessary for setting the meal to work
  await request('/MenuItem/' + locationId, { cache: false })
  for (const meal of meals) {
    await setMeal(meal)
    await scrapeMenu(locationId, meal, results)
  }
  for (const items of Object.values(results.menu)) {
    for (const item of Object.values(items)) {
      if (typeof item.times === 'string') continue

      let weekDaysMatch = true
      for (const weekDay of [2, 3, 4, 5] as const) {
        weekDaysMatch = weekDaysMatch && item.times[1] === item.times[weekDay]
      }
      const allDaysMatch =
        weekDaysMatch &&
        item.times[1] === item.times[6] &&
        item.times[1] === item.times[7]
      const meals = item.times[1]
      if (allDaysMatch) {
        if (meals === 0b111) {
          item.times = 'all-days'
        } else if (meals === bitfield.Breakfast) {
          item.times = 'breakfast'
        } else if (meals === (bitfield.Lunch | bitfield.Dinner)) {
          item.times = 'afternoon'
        }
      } else if (weekDaysMatch) {
        if (meals === 0b111) {
          item.times = 'weekdays'
        } else if (meals === bitfield.Breakfast) {
          item.times = 'breakfast-weekdays'
        } else if (meals === (bitfield.Lunch | bitfield.Dinner)) {
          item.times = 'afternoon-weekdays'
        }
      }
      if (
        typeof item.times === 'string' &&
        ![
          'all-days',
          'weekdays',
          'breakfast',
          'breakfast-weekdays',
          'afternoon',
          'afternoon-weekdays'
        ].includes(item.times)
      ) {
        console.log(item.times)
      }
    }
  }
  await Deno.writeTextFile(
    `./dining/${locationId}.json`,
    JSON.stringify(results, null, 2)
  )
  list += `${locationId} | ${results.restaurant.name}\n`
}
await Deno.writeTextFile('./dining/README.md', list)
