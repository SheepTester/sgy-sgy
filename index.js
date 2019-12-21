const askSgy = require('./get-things-from-schoology.js')

// Adapted from https://stackoverflow.com/a/39872849
const emoji = []
for (const [start, end] of [[128513, 128591], [9986, 10160], [128640, 128704]]) {
  for (let i = start; i < end; i++) emoji.push(String.fromCodePoint(i))
}
function randomEmoji (count = 1) {
  let str = ''
  for (let i = 0; i < count; i++) {
    str += emoji[Math.random() * emoji.length | 0]
  }
  return str
}

// 2017219
askSgy('/user/2017219/updates')
  .then(async body => {
    const { update: [{ id }] } = body
    for (let i = 0; i < 20; i++) {
      const { id: commentID } = await askSgy(`/user/2017219/updates/${id}/comments`, {
        comment: `always${randomEmoji()}brush${randomEmoji()}your${randomEmoji()}${new Date().toISOString()}${randomEmoji()}regularly${randomEmoji(50)}`,
        uid: '2017219'
      })
      await askSgy(`/like/${id}/comment/${commentID}`, {
        like_action: 'true'
      })
    }
  })
