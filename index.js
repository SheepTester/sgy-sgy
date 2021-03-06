const askSgy = require('./get-things-from-schoology.js')
const fs = require('fs').promises

const min = 0x00AE
const max = 0x0377
function r (count = 3) {
  let str = ''
  for (let i = 0; i < count; i++) {
    str += String.fromCharCode((Math.random() * (max - min + 1) + min) | 0)
  }
  return str
}

// My user ID for testing purposes: 2017219
// askSgy('/sections/136686791/assignments/236174896').then(console.log)
askSgy('/users/me').then(console.log)
/*
askSgy('/users/2017219/grades')
  .then(json => fs.writeFile('./grades-2.json', JSON.stringify(json)))
  .then(() => console.log('ok'))
//*/
/*
askSgy('/user/2017219/updates')
  .then(async body => {
    const { update } = body
    for (let i = 0; i < 30; i++) {
      const { id } = update[Math.random() * update.length | 0]
      const { id: commentID } = await askSgy(`/user/2017219/updates/${id}/comments`, {
        comment: `ALWAYS${r()}BRUSH${r()}YOUR${r()}${new Date().toISOString()}${r()}REGULAREMENT${r(50)}`,
        uid: '2017219'
      })
      await askSgy(`/like/${id}/comment/${commentID}`, {
        like_action: true
      })
    }
  })
*/
