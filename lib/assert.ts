export function assert<T> (value: unknown, constructor: { new (): T }): T {
  if (value instanceof constructor) {
    return value
  } else {
    throw new TypeError(
      `${value} (${(value as any)?.constructor.name}) is not a ${
        constructor.name
      }`
    )
  }
}

export function expect (expected?: string): never {
  throw new TypeError(
    expected
      ? `Expected ${expected}, received null or undefined.`
      : 'Received null or undefined.'
  )
}
