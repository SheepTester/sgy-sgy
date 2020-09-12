/** All of the Schoology REST API documentation */
interface Docs {
  /** Type definitions for various Schoology API objects */
  fields: { [fieldName: string]: ObjectDefinition }

  /** Meanings of magic numbers used by the Schoology API */
  values: ValuesEntry[]

  /** Operations categorized under Schoology API resources */
  resources: Resource[]
}

/** A definition for a Schoology API object's fields */
interface ObjectDefinition {
  /** A description for the object if the documentation provided one */
  note?: string

  /** The fields of the object */
  fields: Field[]
}

/** A field/property for a Schoology API object */
interface Field {
  /** The property name used by the API */
  field: string

  /** The human-readable name for the field if the documentation provided one */
  name?: string

  /** A description for the purpose of the field */
  description: string

  /** The type of the field, such as "string" or "{0, 1}" */
  type?: string

  /**
   * Whether the field is required or a description of when the field is
   * required
   */
  required?: boolean | string
}

/**
 * Some Schoology API fields use arbitrary numbers for values, so this serves as
 * a table describing what each number represents.
 */
interface ValuesEntry {
  /** What the values are meant to represent */
  meaning: string

  /** Field property names that the values are used for */
  for: string[]

  /** A mapping of numbers to their represented meaning */
  values: ValueEntry[]
}

/** A pairing of a magic number with its intended meaning */
interface ValueEntry {
  /** The magic number used by the API */
  value: number

  /** A description of what the number represents */
  meaning: number | string
}

/**
 * A category of Schoology API operations, which usually deals with a specific
 * resource like a User or Course
 */
interface Resource {
  /** The name of the category */
  name: string

  /** A description of the category */
  description: string

  /** URLs used by the operations */
  urls: string[]

  /**
   * For some resources, the URLs will have a `[realm]` placeholder, which can
   * be substituted with one of the values here.
   */
  realms?: string[]

  /**
   * The operations relevant to the resource, if there are any. If the
   * documentation is private for the category, this will be `null`.
   */
  operations: Operation[] | null
}

/** An operation is a REST API request */
interface Operation {
  /** The documentation's name for the operation */
  name: string

  /** A description of the operation */
  description: string

  /** An object mapping of query parameter names to their descriptions */
  parameters?: { [parameter: string]: string }

  /** The URL path for the request without "https://api.schoology.com/v1/" */
  path: string | string[]

  /** The HTTP method for the REST API request */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'

  /**
   * A description of the type of the request body. There's a distinction
   * between `null` and the omission of this property: the former case is when
   * the API says no content is needed, while the latter means the documentation
   * doesn't mention it.
   */
  content?: string | null

  /**
   * A description of the type of response, with a similar distinction between
   * `null` and property omission.
   */
  return?: string | null
}
