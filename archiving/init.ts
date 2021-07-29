import { config } from 'https://deno.land/x/dotenv@v2.0.0/mod.ts'

const env = config({ safe: true })

// '61db7d00d28d332758e01dd6ef4e88e9' is the md5 hash of 'pausd.schoology.com'
export const cookie = `SESS61db7d00d28d332758e01dd6ef4e88e9=${env['SESS']}`

export const root = 'https://pausd.schoology.com'
