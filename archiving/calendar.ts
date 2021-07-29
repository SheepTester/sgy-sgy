import { cachePath } from "./cache.ts";
import { me } from "./me.ts";

if (import.meta.main) {
  // .ics file
  await cachePath(`/calendar/feed/export/user/${me.id}/download`, 'file')
}
