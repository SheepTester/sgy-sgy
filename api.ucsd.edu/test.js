const authorization = "Bearer c812cb9b-7c6e-3835"
const base = 'https://api.ucsd.edu/api/am/devportal/v2'
let next = "/apis?limit=10&offset=0",list
const items = []
while (true) {
({list,pagination:{next}}=await fetch(base+next, {"headers": {authorization
  },
}).then(r => r.json()))
    items.push(...list.map(async item => ({...item,swagger:
        await fetch(`https://api.ucsd.edu/api/am/devportal/v2/apis/${item.id}/swagger?environmentName=Production%20and%20Sandbox`, {  "headers": {authorization
  },
}).then(r => r.json())

        })))
    if (!next)break
}
await Promise.all(items)
