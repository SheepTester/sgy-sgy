# sgy-sgy

Playing with the [Schoology API](https://developers.schoology.com/api-documentation/rest-api-v1) and [Zoom API](https://marketplace.zoom.us/docs/api-reference/zoom-api)!

For Node stuff, make sure you do

```sh
npm install
```

first.

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

askSgy('/user/2017219/updates/2230965068/comments', { // POST
  comment: 'comment text',
  uid: '2017219'
})
  .then(console.log)
```

If you get an error like the following, I have no idea why. Maybe Schoology is dumb, or the Node library I'm using for OAuth is dumb.

> Duplicate timestamp/nonce combination, possible replay attack. Request rejected.

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
