// ==UserScript==
// @name         scrape assessments
// @namespace    https://sheeptester.github.io/
// @version      0.1
// @description  schoology is too smart so just going to use outerHTML
// @author       You
// @match        https://pausd.schoology.com/home/notifications
// @icon         https://www.google.com/s2/favicons?domain=schoology.com
// @grant        none
// ==/UserScript==

const paths = `/course/[...]/common-assessment/[...]
[...]
/course/[...]/common-assessment/[...]`

;(async function () {
  'use strict'

  function delay (time) {
    return new Promise(resolve => setTimeout(resolve, time))
  }

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '0'
  iframe.style.left = '0'
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.style.border = 'none'
  iframe.style.zIndex = 1000
  document.body.append(iframe)
  document.body.style.overflow = 'hidden'
  document.documentElement.style.overflow = 'hidden'

  const output = {}
  for (const path of paths.split(/\r?\n/)) {
    const promise = new Promise(resolve => {
      iframe.onload = resolve
    })
    iframe.src = path
    await promise
    while (!iframe.contentDocument.querySelector('main')) await delay(100)
    const viewBtn = iframe.contentDocument.querySelector(
      'main > :last-child > :last-child > :last-child > :last-child > :last-child > :last-child',
    )
    if (viewBtn.tagName === 'A') viewBtn.click()
    else continue
    while (!iframe.contentDocument.querySelector('main .lrn_question'))
      await delay(100)
    output[path] = iframe.contentDocument.documentElement.outerHTML
  }
  console.log(JSON.stringify(output, null, '\t'))
})()
