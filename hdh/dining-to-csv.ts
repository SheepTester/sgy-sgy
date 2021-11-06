import {
  Availability,
  bitfield,
  dayNames,
  Icon,
  MenuResults
} from './dining-common.ts'

const sortedIcons: Icon[] = [
  // Sorted by most important to me

  // Potential allergies
  'peanuts',
  'treenuts',

  // Nutrition
  'dairy',
  'eggs',
  'fish',
  'shellfish',
  'soy',

  // Less useful
  'vegetarian',
  'vegan',
  'gluten',
  'wheat',
  'wellness'
]
const icons: Record<Icon, string> = {
  dairy: '🥛',
  eggs: '🥚',
  fish: '🐟',
  gluten: '🇬',
  peanuts: '🥜',
  shellfish: '🦐',
  soy: '🌱',
  treenuts: '🌰',
  vegan: '🇻',
  vegetarian: '🌿',
  wellness: '😊',
  wheat: '🌾'
}

const locations: MenuResults[] = []

const el = (
  name: string,
  attributes?: string | Record<string, string>,
  ...children: string[]
) =>
  `<${name}${
    typeof attributes === 'object'
      ? Object.entries(attributes)
          .map(([property, value]) => ` ${property}="${value}"`)
          .join('')
      : ''
  }>${typeof attributes === 'string' ? attributes : ''}${children.join(
    ''
  )}</${name}>`

let output = ''

for await (const entry of Deno.readDir('./dining/')) {
  if (entry.name.endsWith('.json')) {
    const locationId = entry.name.split('.')[0]
    locations.push(
      await Deno.readTextFile(`./dining/${locationId}.json`).then(JSON.parse)
    )
  }
}

function displayList (items: string[], separator: ',' | ';' = ',') {
  if (items.length < 3) {
    return items.join(' and ')
  } else {
    // Oxford comma!
    return (
      items.slice(0, -1).join(separator + ' ') +
      separator +
      ' and ' +
      items[items.length - 1]
    )
  }
}
function capitalize (string: string) {
  return string[0].toUpperCase() + string.slice(1)
}

function displayAvailability (availability: Availability) {
  switch (availability) {
    case 'all-days': {
      return 'Always available'
    }
    case 'breakfast': {
      return 'Breakfast every day'
    }
    case 'afternoon': {
      return 'Lunch and dinner every day'
    }
    case 'lunch': {
      return 'Lunch every day'
    }
    case 'dinner': {
      return 'Dinner every day'
    }
    case 'weekdays': {
      return 'All times on weekdays'
    }
    case 'breakfast-weekdays': {
      return 'Breakfast on weekdays'
    }
    case 'afternoon-weekdays': {
      return 'Lunch and dinner on weekdays'
    }
    case 'lunch-weekdays': {
      return 'Lunch on weekdays'
    }
    case 'dinner-weekdays': {
      return 'Dinner on weekdays'
    }
    default: {
      // meals -> days
      const available: Map<number, number[]> = new Map()
      for (const [day, meals] of Object.entries(availability)) {
        if (meals === 0b000) continue
        let array = available.get(meals)
        if (!array) {
          array = []
          available.set(meals, array)
        }
        array.push(+day)
      }
      const output = []
      for (const [mealBitfield, days] of available) {
        const meals = []
        if (mealBitfield & bitfield.Breakfast) meals.push('breakfast')
        if (mealBitfield & bitfield.Lunch) meals.push('lunch')
        if (mealBitfield & bitfield.Dinner) meals.push('dinner')
        output.push(
          `${displayList(meals)} on ${displayList(
            days.map(day => dayNames[day])
          )}`
        )
      }
      return capitalize(displayList(output, ';'))
    }
  }
}

for (const { restaurant, menu } of locations) {
  output += el(
    'tr',
    el(
      'td',
      { colspan: '4' },
      el('strong', restaurant.name),
      '<br>',
      restaurant.description
    )
  )
  for (const [menuName, items] of Object.entries(menu)) {
    output += el('tr', el('td', { colspan: '4' }, el('strong', menuName)))
    for (const [name, { price, times, icons: contains }] of Object.entries(
      items
    )) {
      output += el(
        'tr',
        el('td', name),
        el('td', price ? '$' + price.toFixed(2) : 'Unknown'),
        el('td', displayAvailability(times)),
        el(
          'td',
          sortedIcons
            .filter(icon => contains.includes(icon))
            .map(icon => icons[icon])
            .join('')
        )
      )
    }
  }
}

Deno.writeTextFile(
  './dining/summary.html',
  el(
    'table',
    el(
      'thead',
      el(
        'tr',
        el('th', 'Name'),
        el('th', 'Price'),
        el('th', 'Availability'),
        el('th', 'Contains')
      )
    ),
    el('tbody', output)
  ) + '\n'
)
