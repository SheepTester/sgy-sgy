export function parseIntMaybe (int?: string | null): number | undefined {
  if (typeof int === 'string') {
    const number = parseInt(int)
    return Number.isFinite(number) ? number : undefined
  } else {
    return undefined
  }
}
