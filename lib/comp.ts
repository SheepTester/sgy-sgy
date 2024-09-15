/**
 * Whether two arrays are shallow equal. This uses `Object.is` to compare
 * corresponding items of the array.
 */
export function arrayEqual<T> (a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((item, i) => Object.is(item, b[i]))
}
