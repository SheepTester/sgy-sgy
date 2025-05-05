import { MongoClient } from "mongodb";



type GeminiResult = {
  provided: string[];
  location: string;
  date: { year: number; month: number; date: number };
  start: { hour: number; minute: number };
  end?: { hour: number; minute: number };
};
type ScrapedEvent = (
  | (Omit<GeminiResult, "provided"> & {
      freeFood: string[];
      result: true;
      previewData?: string;
      postTimestamp?: Date;
      caption?: string;
    })
  | { result: false }
) & {
  sourceId: string;
  url: string | null;
};

export const eventsPromise =  new MongoClient(process.env.MONGO_URI || `mongodb+srv://${process.env.USERPASS?.trim()}@bruh.duskolx.mongodb.net/?retryWrites=true&w=majority&appName=Bruh`).connect()
  .then(client => client.db("events_db"))
  .then(db =>  db.collection<ScrapedEvent>("events_collection"))
