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

bookContainer.onclick = e => {
  const em = parseFloat(getComputedStyle(bookContainer)['font-size'])
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

  if (clickPosition === 'right') {
    bookContainer.scrollTop = bookContainer.scrollTop + bookContainer.clientHeight - em
  } else if (clickPosition === 'left') {
    bookContainer.scrollTop = bookContainer.scrollTop - bookContainer.clientHeight + em
  }

  localStorage.setItem('scrollTop', bookContainer.scrollTop)
}

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
  const container = parser.parseFromString(containerXml, 'application/xml')
  const rootfile = container.querySelector('rootfile')
  const fullPath = rootfile.getAttribute('full-path')

  const rootXml = await fetch(fullPath.replace(/^\w+\//, '')).then(r => r.text())
  const root = parser.parseFromString(rootXml, 'application/xml')
  const items = root.querySelectorAll('item[media-type="application/xhtml+xml"]')

  bookContainer.innerHTML = ''

  for (const item of items) {
    const url = item.getAttribute('href')
    const xhtml = await fetch(url).then(r => r.text())
    const div = document.createElement('div')
    div.innerHTML = xhtml
    bookContainer.appendChild(div)
  }

  await loading()
  scrollToLastPosition()
}

async function loading() {
  const images = Array.from(document.images)
  const notComplete = images.filter(img => !img.complete)
  
  await Promise.all(notComplete.map(img => new Promise(resolve => { img.onload = img.onerror = resolve })))
}

function scrollToLastPosition() {
  const prevScrollPosition = localStorage.getItem('scrollTop')
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