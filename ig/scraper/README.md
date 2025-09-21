scrape UCSD events on instagram

you need:

- Node 22 ideally
- `cookies.json` instagram web cookies of account you want to scrape with
  - `sessionid` changes sometimes
- `api_key.txt` API key for gemini which you can get from Gemini API studio
- water (see: [About Water and Healthier Drinks](https://www.cdc.gov/healthy-weight-growth/water-healthy-drinks/index.html))
- `mongo_userpass.txt` mongo atlas username colon password

```shell
$ npm install
$ npx playwright install firefox
$ node --experimental-strip-types scraper.ts
```

todo:

- [ ] fetch ai and dain??
- [ ] domain
- [ ] mongodb

## server

```shell
$ node --experimental-strip-types server.ts
```

then in another terminal

```shell
$ cd client
$ npm install
$ npm run dev
```

## dain (`bleh/`)

- [follow this guide](https://lahacks-docs.dain.org/docs/getting-started/introduction)
- put credential in `bleh/.env.development`

```shell
$ cd bleh
$ npm install
$ npm run dev
```
