export function unwrap (): never {
  throw new Error(
    "I got a value that is null or undefined, which wasn't what I was expecting."
  )
}
export function assertOk (response: Response) {
  if (response.ok) {
    return response
  } else {
    throw new Error(`HTTP ${response.status} error from ${response.url}`)
  }
}

export const iconKeySource = {
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
export const iconKey: {
  [alt: string]: typeof iconKeySource[keyof typeof iconKeySource]
} = iconKeySource
export type Icon = typeof iconKeySource[keyof typeof iconKeySource]

export const meals = ['Breakfast', 'Lunch', 'Dinner'] as const
export type Meal = typeof meals[number]
export const bitfield = {
  Breakfast: 0b100,
  Lunch: 0b010,
  Dinner: 0b001
}

export const days = [1, 2, 3, 4, 5, 6, 7] as const
export type Day = typeof days[number]
export function createDayMap<T> (defaultValue: T): { [day in Day]: T } {
  return {
    1: defaultValue,
    2: defaultValue,
    3: defaultValue,
    4: defaultValue,
    5: defaultValue,
    6: defaultValue,
    7: defaultValue
  }
}

export type Restaurant = {
  name: string
  description: string
  schedule: {
    [stationName: string]: {
      [day in Day]: [number, number] | null
    }
  }
}

export type Availability =
  | { [day in Day]: number }
  | 'all-days'
  | 'weekdays'
  | 'breakfast'
  | 'breakfast-weekdays'
  | 'afternoon'
  | 'afternoon-weekdays'

export type MenuItem = {
  price?: number
  icons: Icon[]
  times: Availability
}

export type MenuResults = {
  restaurant: Restaurant
  menu: {
    [menuName: string]: {
      [itemName: string]: MenuItem
    }
  }
}

export const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export function parseTime (hour: string, minute: string, half: string): number {
  return (
    ((half === 'a' ? +hour : hour === '12' ? 12 : +hour + 12) % 24) * 60 +
    +minute
  )
}
