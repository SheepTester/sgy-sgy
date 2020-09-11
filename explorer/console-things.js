// Turn a table into a YAML list
// Select the <table> element in inspect element
(table => {
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
