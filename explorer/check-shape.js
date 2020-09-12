const { ok } = require('assert').strict

function id (value) {
  return value
}

function is (expectation) {
  return value => value === expectation ? [] : [{ name: '', expectation: JSON.stringify(expectation) }]
}

function str (value) {
  return typeof value === 'string' ? [] : [{ name: '', expectation: 'string' }]
}

function num (value) {
  return Number.isFinite(value) ? [] : [{ name: '', expectation: 'finite number' }]
}

function bool (value) {
  return typeof value === 'boolean' ? [] : [{ name: '', expectation: 'boolean' }]
}

function either (...tests) {
  return value => {
    const problems = [{
      name: '',
      expectation: 'any of the following'
    }]
    for (const test of tests) {
      const result = test(value)
      if (!result.length) return []
      problems.push(...result)
    }
    return problems
  }
}

function oneOf (...values) {
  return either(...values.map(is))
}

function maybe (test) {
  const tester = either(is(undefined), test)
  tester.isMaybe = true
  return tester
}

function nullOr (test) {
  return either(is(null), test)
}

function arrOf (test) {
  return value => Array.isArray(value)
    ? [].concat(
      ...value
        .map((item, i) =>
          test(item)
            .map(({ name, expectation }) =>
              ({ name: `[${i}]${name}`, expectation })))
        .filter(id)
    )
    : [{ name: '', expectation: 'array' }]
}

function objMapOf (test) {
  return value => typeof value === 'object' && value !== null
    ? [].concat(
      ...Object.entries(value)
        .map(([key, val]) =>
          test(val)
            .map(({ name, expectation }) =>
              ({ name: `['${key}']${name}`, expectation })))
        .filter(id)
    )
    : [{ name: '', expectation: 'object' }]
}

function objOf (definition) {
  const keys = Object.keys(definition)
  return value => {
    if (typeof value === 'object' && value !== null) {
      const valueKeys = Object.keys(value)
      return [].concat(
        ...Object.entries(value)
          .map(([key, val]) =>
            keys.includes(key)
              ? definition[key](val)
                .map(({ name, expectation }) =>
                  ({ name: `.${key}${name}`, expectation }))
              : [{ name: `.${key}`, expectation: 'excluded (is extra)' }])
          .filter(id),
        keys
          .filter(key => !valueKeys.includes(key) && !definition[key].isMaybe)
          .map(missingKey => ({
            name: `.${missingKey}`,
            expectation: 'included (is missing)'
          }))
      )
    } else {
      return [{ name: '', expectation: 'object' }]
    }
  }
}

function testType (value, test) {
  return test(value)
    .map(({ name, expectation }) => `${name || 'value'} not ${expectation}`)
    .join('\n') || null
}

module.exports = function checkSgyApiShape (yaml) {
  return testType(yaml, objOf({
    fields: objMapOf(objOf({
      note: maybe(str),
      fields: arrOf(objOf({
        field: str,
        // grading xyz fields do not have a name
        name: maybe(str),
        description: str,
        // Some user fields do not have a type
        type: maybe(str),
        required: maybe(either(str, bool))
      }))
    })),
    values: arrOf(objOf({
      meaning: str,
      for: arrOf(str),
      values: arrOf(objOf({
        value: num,
        meaning: either(num, str)
      }))
    })),
    resources: arrOf(objOf({
      name: str,
      description: str,
      urls: arrOf(str),
      realms: maybe(arrOf(str)),
      operations: arrOf(objOf({
        name: str,
        description: str,
        parameters: maybe(objMapOf(str)),
        path: str,
        method: oneOf('GET', 'POST', 'PUT', 'DELETE'),
        content: maybe(nullOr(str)),
        return: maybe(nullOr(str))
      }))
    }))
  }))
}
