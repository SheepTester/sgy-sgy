import { EventObject } from '@/components/Event'
import { eventsPromise } from '@/lib/eventsDb'

export async function getEvents (): Promise<EventObject[]> {
  const db = await eventsPromise
  const rawEvents = await db.find({ result: true }).toArray()
  return rawEvents.flatMap((event): EventObject[] => {
    if (!event.result) {
      return []
    }
    // if (!event.start) {
    //   console.warn('Missing `start`', event)
    // }
    event.start ??= { hour: 0, minute: 0 }
    return [
      {
        mongoDbId: event._id.toString(),
        postId: event.sourceId,
        /**
         * URL of referenced post (if available), otherwise URL of story. `null`
         * means it was a story but was scraped a while ago
         */
        referencedUrl: event.url,
        freeStuff: event.freeFood.map(item => item.replace(/^free\s+/i, '')),
        location: event.location,
        start: new Date(
          Date.UTC(
            event.date.year,
            event.date.month - 1,
            event.date.date,
            event.start.hour,
            event.start.minute
          )
        ),
        end: event.end
          ? new Date(
            Date.UTC(
              event.date.year,
              event.date.month - 1,
              event.date.date,
              event.end.hour,
              event.end.minute
            )
          )
          : null,
        imageUrl: event.previewData
          ? `data:image/webp;base64,${event.previewData}`
          : null,
        postTimestamp: event.postTimestamp ?? null,
        caption: event.caption ?? ''
      }
    ]
  })
}
