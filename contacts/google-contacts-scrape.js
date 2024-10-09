// From https://github.com/SheepTester/hello-world/blob/master/google-contacts-scrape.js
// Adapted to use File System Access API to stream JSON

// https://contacts.google.com/u/1/directory
// run the following in the console

const handle = await window.showSaveFilePicker({
  types: [{ accept: { 'application/json': ['.json'] } }]
})
const writable = await handle.createWritable()

const authUser = new URLPattern('*://contacts.google.com/u/:authuser/*').exec(
  window.location.href
).pathname.groups.authuser
const url = `https://contacts.google.com/u/${authUser}/_/ContactsUi/data/batchexecute`
const contentType = 'application/x-www-form-urlencoded;charset=UTF-8'

// Guessing what these values mean
const requestType = 'RdqMrd'
const key = AF_initDataChunkQueue.find(chunk => chunk.key === 'ds:0').data[3]
const at = WIZ_global_data.SNlM0e

function getFReq (nextHandle, max = 5000) {
  return (
    new URLSearchParams({
      'f.req': JSON.stringify([
        [
          [
            requestType,
            JSON.stringify([
              null,
              nextHandle,
              // Number of results
              max,
              key
            ]),
            null,
            'generic'
          ]
        ]
      ]),
      at
    }) + '&'
  )
}
async function getContacts (nextHandle = null) {
  const [contacts, nextNextHandle] = await fetch(url, {
    headers: {
      'Content-Type': contentType
    },
    body: getFReq(nextHandle),
    method: 'POST'
  })
    .then(r => r.text())
    .then(t => JSON.parse(JSON.parse(t.replace(/^[^[{]+/, ''))[0][2]))
  return {
    contacts: contacts || [],
    nextHandle: nextNextHandle
  }
}

console.log('window.page')
window.page = { nextHandle: null }
let pageNum = 1
let first = true
do {
  do {
    try {
      page = await getContacts(page.nextHandle)
      console.log(pageNum, 'fetched')
      await new Promise(resolve => setTimeout(resolve, 500))
      break
    } catch (error) {
      console.log(pageNum, 'failed :(', error)
      await new Promise(resolve => setTimeout(resolve, 10000))
    }
  } while (true)
  writable.write(
    page.contacts
      .map(
        (contact, i) =>
          `${first && i === 0 ? '[' : ','} ${JSON.stringify(
            contact,
            null,
            '\t'
          ).replace(/\s*\n\s*/g, ' ')}\n`
      )
      .join('')
  )
  first = false
  pageNum++
} while (page.nextHandle)
await writable.close()
