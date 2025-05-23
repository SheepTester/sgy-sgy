# All purpose scraping

Playing with the [Schoology API](https://developers.schoology.com/api-documentation/rest-api-v1) and [Zoom API](https://marketplace.zoom.us/docs/api-reference/zoom-api)!

Scrapes https://finance.ucsd.edu/Home/ListFunded and maybe Instagram

- [oauth-3leg](#oauth-3leg): Schoology API 3-legged OAuth
- [explorer](./explorer/): Schoology API
- [irrelevant-scripts-maybe](#irrelevant-side-note): Schoology API
- [scraper](#scraper): Schoology API
- [archiving](./archiving/): Archiving Schoology
- [zoom](#zoom): Zoom API
- hdh: Scraping [UCSD HDH's dining hall menus](https://hdh-web.ucsd.edu/dining/apps/diningservices/Restaurants/)
- contacts: Scraping Google Contacts, based on [prior work](https://github.com/SheepTester/hello-world/blob/master/google-contacts-scrape.js)
- lib: Utils for explore/
- explore/finance: Scraping [UCSD A.S. Finance](https://finance.ucsd.edu/Home/ListFunded)
- explore/police: Scraping [UCSD crime logs](https://www.police.ucsd.edu/docs/reports/callsandarrests/Calls_and_Arrests.asp)
- ig: Scraping Instagram for free food events at UCSD (based on our [LA Hacks project](https://devpost.com/software/free-food-nrab03))

## Usage

The code in this repo was largely written just to explore and play around with what's available, so there's little documentation available. Sorry about that!

If it gives you any consolation, I'm also shooting my future self in the foot shrouding all this in mystery.

In general, each script has a comment at the top of the file with the command required to run the script.

- If it starts with `deno`, you'll need [Deno 1.x](https://deno.com/) installed.

- If it starts with `node` or `tsx`, you'll [Node](https://nodejs.org/) installed. Hopefully the latest version still works.

  Then, run the following command to install the dependencies.

  ```sh
  $ npm install
  ```

  For `tsx`, you'll also need to install `tsx` globally.

  ```sh
  $ npm install -g tsx
  ```

## Schoology

Put your [API Credentials](https://pausd.schoology.com/api) in a `api-creds.json` file like this:

```json
{
  "key": "87a6b8e78c0d897897a9f7e99a6d7c9",
  "secret": "0a08c87b75e43da26589d008f76bc"
}
```

You can then play with `get-things-from-schoology.js` directly:

```bash
$ node
Welcome to Node.js v14.4.0.
Type ".help" for more information.
> const askSgy = require('./get-things-from-schoology.js')
undefined
```

```js
// These probably won't work for you unless you change 2017219 to your user ID.

askSgy('/user/2017219/updates') // GET
  .then(console.log)

askSgy('/user/2017219/updates/2230965068/comments', {
  // POST
  comment: 'comment text',
  uid: '2017219'
}).then(console.log)
```

If you get an error like the following, I have no idea why. Maybe Schoology is dumb, or the Node library I'm using for OAuth is dumb.

> Duplicate timestamp/nonce combination, possible replay attack. Request rejected.

### Explorer

```sh
node explorer/app.js
```

## Zoom

Create an [OAuth app](https://marketplace.zoom.us/develop/create) for Zoom, then
fill out the necessary information for the Install button in the Activation tab.
Copy Client ID and Secret, and also the redirect URL you put, and paste them
into a new file at `zoom/credentials.json`. See
[`zoom/credentials.example.json`](./zoom/credentials.example.json) for a
template.

When you click on the Install button in the Activation tab, it'll send you to the specified redirect URL with a URL parameter `code` in the URL. Copy its value, then run

```sh
node zoom/start.js <authorization code here>
```

It should output `Done.`.

## oauth-3leg

[Three-legged OAuth with Schoology.](https://developers.schoology.com/api-documentation/authentication#toc-item-1)

In Node

```sh
# Does not work
node oauth-3leg/app.js

# Works
node oauth-3leg/app2.js
```

http://localhost:3000/

In Python, some venv stuff

```sh
# Activate venv
source venv/Scripts/activate

# Save
pip freeze > requirements.txt

# Load
pip install -r requirements.txt
```

Then run server

```sh
export FLASK_APP=oauth-3leg/hello.py
export FLASK_ENV=development
flask run
```

http://127.0.0.1:5000/

## Scraper

Gets all the course materials from Schoology. You'll need to populate `.env` first:

```
HOST=pausd.schoology.com
UID=
CSRF_KEY=
CSRF_TOKEN=
SESS_ID=
```

On Schoology, you can get the first four by running the following in the console:

```js
;`HOST=${window.location.hostname}
UID=${Drupal.settings.s_common.user.uid}
CSRF_KEY=${Drupal.settings.s_common.csrf_key}
CSRF_TOKEN=${Drupal.settings.s_common.csrf_token}
SESS_ID=`
```

To get `SESS_ID`, you need to look for the SESS<hash> cookie in the Application tab of devtools.

```sh
# In scraper/:

# Scrape Schoology -> ./private/ (Uses Deno)
deno run --allow-read=./ --allow-write=./private/ --allow-env --allow-net index.ts

# Web server to view ./private/ (Uses Node)
node app.js
```

### Irrelevant side note

Comparing grades.json, which gets randomly jambled:

```sh
git show <commit>:grades.json > ../../private/grades-old.json
git show <commit>:grades.json > ../../private/grades-new.json
deno run --allow-read --allow-write irrelevant-scripts-maybe/sort-grades.ts private/grades-old.json
deno run --allow-read --allow-write irrelevant-scripts-maybe/sort-grades.ts private/grades-new.json
diff private/grades-old.json private/grades-new.json --color=always -c | sed -e 's/\t/ /g'
```
