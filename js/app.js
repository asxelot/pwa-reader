const appContainer = document.getElementById('app-container')
const bookInput = document.getElementById('book-input')
const bookContainer = document.getElementById('book-container')
const topMenu = document.getElementById('top-menu')
const topMenuWrapper = document.getElementById('top-menu-wrapper')

let isTopMenuVisible = false

topMenuWrapper.onclick = e => {
  if (e.target === topMenuWrapper) {
    topMenuWrapper.style.display = 'none'
    isTopMenuVisible = false
  }
}

if (localStorage.getItem('fontSize')) {
  bookContainer.style.fontSize = localStorage.getItem('fontSize')
}

if (localStorage.getItem('margin')) {
  appContainer.style.padding = localStorage.getItem('margin')
}

document.getElementById('font-decrease').onclick = () => changeFontSize(-1)
document.getElementById('font-increase').onclick = () => changeFontSize(1)
document.getElementById('margin-decrease').onclick = () => changePageMagin(-2)
document.getElementById('margin-increase').onclick = () => changePageMagin(2)

function changeFontSize(px) {
  const fontSize = parseInt(getComputedStyle(bookContainer).fontSize)
  const newFontSize = `${fontSize + px}px`
  bookContainer.style.fontSize = newFontSize
  localStorage.setItem('fontSize', newFontSize)
  localStorage.setItem('scrollTop', bookContainer.scrollTop)
}

function changePageMagin(px) {
  const margin = parseInt(getComputedStyle(appContainer).padding)
  const newMargin = `${margin + px}px`
  appContainer.style.padding = localStorage.getItem('margin')
  localStorage.setItem('margin', newMargin)
  localStorage.setItem('scrollTop', bookContainer.scrollTop)
}

document.addEventListener('click', e => {
  const fontSize = parseFloat(getComputedStyle(bookContainer).fontSize)
  const lineHeight = parseFloat(getComputedStyle(bookContainer).lineHeight)
  const lineSize = fontSize + lineHeight
  
  const x = e.x / bookContainer.clientWidth
  const y = e.y / bookContainer.clientHeight
  const clickPosition = (() => {
    if (y <= 0.2) {
      return 'top'
    } else if (x <= 0.4) {
      return 'left'
    } else {
      return 'right'
    }
  })()

  if (clickPosition === 'top' && !isTopMenuVisible) {
    isTopMenuVisible = true
    topMenuWrapper.style.display = 'block'
  }

  let newScrollTop
  if (clickPosition === 'right') {
    newScrollTop = bookContainer.scrollTop + bookContainer.clientHeight - lineSize
  } else if (clickPosition === 'left') {
    newScrollTop = bookContainer.scrollTop - bookContainer.clientHeight + lineSize
  }

  bookContainer.scrollTop = newScrollTop
  localStorage.setItem('scrollTop', newScrollTop)
})

readBook()

bookInput.onchange = function () {
  try {
    const [file] = this.files
    if (file) readFile(file)
  } catch (err) {
    console.error(err)
  }
}

function readFile(file) {
  const reader = new FileReader()
  reader.addEventListener('load', event => {
    getEntries(event).then(readBook)
  })
  reader.readAsDataURL(file)
}

async function readBook() {
  const parser = new DOMParser()
  const containerXml = await fetch('META-INF/container.xml').then(r => r.text())

  if (!containerXml) return 

  const container = parser.parseFromString(containerXml, 'application/xml')
  const rootfile = container.querySelector('rootfile')
  const fullPath = rootfile.getAttribute('full-path')

  const rootXml = await fetch(fullPath.replace(/^\w+\//, '')).then(r => r.text())
  const root = parser.parseFromString(rootXml, 'application/xml')
  const items = root.querySelectorAll('item[media-type="application/xhtml+xml"]')

  // bookContainer.style.display = 'none'
  bookContainer.innerHTML = ''

  for (const item of items) {
    const url = item.getAttribute('href')
    const xhtml = await fetch(url).then(r => r.text())
    const div = document.createElement('div')
    div.innerHTML = xhtml
    bookContainer.appendChild(div)
  }

  await waitForImages()

  // bookContainer.style.display = 'block'

  scrollToLastPosition()
}

async function waitForImages() {
  const images = Array.from(document.images)
  const notComplete = images.filter(img => !img.complete)
  await Promise.all(notComplete.map(img => new Promise(resolve => { img.onload = img.onerror = resolve })))
}

function scrollToLastPosition() {
  const prevScrollPosition = parseInt(localStorage.getItem('scrollTop'))
  if (prevScrollPosition) {
    bookContainer.scrollTop = prevScrollPosition
  }
}

async function getEntries(event) {
  const mimetypes = {
    html: 'application/xhtml+xml',
    css: 'text/css',
    js: 'application/javascript',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    epub: 'application/epub+zip',
    ttf: 'font/ttf',
    ttc: 'font/collection',
    woff: 'font/woff',
    woff2: 'font/woff2',
    otf: 'font/otf',
    eot: 'application/vnd.ms-fontobject',
    sfnt: 'application/font-sfnt'
  }

  const res = await fetch(event.target.result)
  const blob = await res.blob()
  const zipFileReader = new zip.BlobReader(blob)
  const zipReader = new zip.ZipReader(zipFileReader)
  const entries = await zipReader.getEntries()

  const cacheKey = 'book-cache'
  await caches.delete(cacheKey)
  await caches.delete(undefined)
  const cache = await caches.open(cacheKey)
  for (const entry of entries) {
    const writer = new zip.BlobWriter()
    const blob = await entry.getData(writer)
    const ext = entry.filename?.split('.')?.pop() || 'txt'
    const url = `${location.href}${entry.filename.replace(/^\w+\//, '')}`
    const options = {
      headers: {
        'Content-Type': mimetypes[ext],
        'Content-Length': blob.size
      }
    }
    cache.put(url, new Response(blob, options))
  }
}

async function blob_b64(blob) {
  var buf = await blob.arrayBuffer()
  var bytes = new Uint8Array(buf)
  var bin = bytes.reduce((acc, byte) => acc += String.fromCharCode(byte), '')
  var b64 = btoa(bin)
  return b64
}


