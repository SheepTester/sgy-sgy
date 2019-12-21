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
