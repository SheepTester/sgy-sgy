import { cachePath } from './cache.ts'

// Idk which of these can be null
interface SgyUser {
  uid: string
  id: number
  school_id: number
  synced: 0 | 1
  school_uid: string
  building_id: number
  additional_buildings: string
  name_title: string
  name_title_show: 0 | 1
  name_first: string
  name_first_preferred: string
  use_preferred_first_name: '0' | '1'
  name_middle: string
  name_middle_show: 0 | 1
  name_last: string
  name_display: string
  username: string
  primary_email: string
  picture_url: string
  gender: string | null
  position: string | null
  grad_year: string
  password: string
  role_id: number
  tz_offset: number
  tz_name: string
  child_uids: string[] | null
  send_message: 0 | 1
  language: string
  permissions: {
    is_directory_public: 0 | 1
    allow_connections: 0 | 1
  }
}

export const me: SgyUser = await cachePath('/v1/users/me')
