# sgy-sgy

Playing with the [Schoology API](https://developers.schoology.com/api-documentation/rest-api-v1)!

Put your [API Credentials](https://pausd.schoology.com/api) in a `api-creds.json` file like this:

```json
{
  "key": "87a6b8e78c0d897897a9f7e99a6d7c9",
  "secret": "0a08c87b75e43da26589d008f76bc"
}
```

Edit `index.js` then do

```bash
node index.js
```

```js
askSgy('/user/2017219/updates') // GET

askSgy('/user/2017219/updates/2230965068/comments', { // POST
  comment: 'comment text',
  uid: '2017219'
})
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

In Node

```sh
node oauth-3leg/app.js
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
