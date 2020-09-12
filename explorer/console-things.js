// Turn a table into a YAML list
// Or select the <table> element in inspect element
;(table => {
const headings = Array.from(table.querySelectorAll('th'), d => d.textContent.trim().toLowerCase())
let data = ''
for (const row of [...table.querySelectorAll('tr')].slice(1)) {
for (let i = 0; i < row.children.length; i++) {
const val = row.children[i].textContent.trim()
if (!val) continue
data += i === 0 ? '- ' : '  '
data += headings[i] + ': '
data += val
data += '\n'
}
}
return data
})($0)

// Get all of the Schoology documentations's resources
// https://developers.schoology.com/api-documentation/rest-api-v1#
[...document.querySelectorAll('table tr')].map(tr => {
const resource = tr.children[0]
if (resource.tagName === 'TH') return
const desc = tr.children[1]
const urls = [...tr.querySelectorAll('.api-path-code')].map(t => '    - ' + t.textContent.trim()).join('\n')
if (!tr.querySelector('a')) console.warn(resource.textContent.trim())
return `- name: ${resource.textContent.trim()}
  description: ${desc.textContent.trim()}
  urls: ${urls ? '\n' + urls : '[]'}` + (tr.querySelector('a') ? `
  operations:
    - eeee` : '')
}).filter(a => a).join('\n')

// Get all operations on a resource page
function getRow (rows, name, pathMode = false) {
  let row = rows.find(tr => tr.children[0]?.textContent.trim().toLowerCase() === name)
  if (row && row.textContent.trim()) {
  row = row.children[1]
  if (row.textContent.trim().toLowerCase() === 'none' || row.textContent.trim().toLowerCase() === '-') return 'null'
  else {
  if (pathMode && row.querySelectorAll('.api-path-code').length >= 2) {
    row = row.querySelector('.api-path-code')
  }
  let content = row.textContent.trim()
  if (content.includes('JSON')) content = content.slice(0, content.indexOf('JSON')).trim()
  return content
  }
  }
  return null
}
function check (str = '') {
  if (str.includes('\n')) console.warn('newline detected', str)
  if (str.includes(':') || str[0] === '[' || str[0] === '{') return JSON.stringify(str)
  else return str
}
[...document.querySelectorAll('h3')].map(heading => {
const name = heading.textContent.trim()
let elem = heading
let description = ''
let parameters = ''
let path, method, content = '', returnz = ''
while ((elem = elem.nextSibling)) {
if (elem.tagName === 'TABLE' || elem.classList?.contains('api-path')) {
  if (elem.classList.contains('api-path')) elem = elem.children[0]
  if (elem.tagName === 'P') {
    const paththing = elem.parentNode.children[1].textContent.trim()
    if (!paththing) return console.error('??? no <p> path?', elem)
    ;[method, path] = paththing.split(/ ?https:\/\/api\.schoology\.com\/v1\//)
    break
  }

  const rows = [...elem.querySelectorAll('tr')]

  const pathE = getRow(rows, 'path', true)
  if (!pathE) {
    console.error('??? no path? CONTINUE.', elem)
    continue
  }
  ;[method, path] = pathE.split(/ ?https:\/\/api\.schoology\.com\/v1\//)

  content = getRow(rows, 'content')
  if (content) content = '\n  content: ' + check(content)

  returnz = getRow(rows, 'return')
  if (returnz) returnz = '\n  return: ' + check(returnz)
  break
} else if (elem.tagName === 'P' || elem.nodeType === Node.TEXT_NODE) {
  const text = (elem.textContent || elem.nodeValue).trim()
  if (!text) continue
  if (description) {
    console.error('description already exists?', elem)
    if (elem.firstChild?.tagName === 'B') {
      console.error('^ was bold so will not add to description')
      continue
    }
    description += '\n'
  }
  description += text
} else if (elem.tagName === 'UL') {
  if (parameters) console.error('extra parameters (probably ok)', elem, parameters)
  parameters = (parameters ? parameters + '\n' : '\n  parameters:\n') + [...elem.children].map(li => '    ' + li.textContent.trim()).join('\n')
}
}
if (!path || !method) console.error('why are path and method falsy?', heading)
return `- name: ${check(name)}
  description: ${check(description)}` + parameters +
`
  path: ${check(path)}
  method: ${check(method)}` + content + returnz
}).filter(a => a).join('\n')

// Autocreates a fields entry
function check (str) {
  if (str.includes('\n')) console.warn('newline detected', str)
  if (str.includes(':') || str[0] === '[' || str[0] === '{') return JSON.stringify(str)
  else return str
}
;(table => {
const wrapper = document.querySelector('.field-item')
const note = wrapper.firstElementChild.tagName === 'P' ? wrapper.firstElementChild.textContent.trim() : null
const headings = Array.from(table.querySelectorAll('th'), d => d.textContent.trim().toLowerCase())
let data = document.querySelector('#page-title').textContent.trim().toLowerCase() + ':\n' +
(note ? `  note: ${note}\n` : '') + '  fields:\n'
for (const row of [...table.querySelectorAll('tr')].slice(1)) {
for (let i = 0; i < row.children.length; i++) {
const val = row.children[i].textContent.trim()
if (!val) continue
data += i === 0 ? '    - ' : '      '
data += headings[i] + ': '
data += val === 'yes' || val === 'Y' ? true : val === 'no' || val === 'N' ? false : check(val)
data += '\n'
}
}
return data
})(document.querySelector('table'))
