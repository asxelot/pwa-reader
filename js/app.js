const bookInput = document.getElementById('book-input')
const bookContainer = document.getElementById('book-container')

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

  console.log('containerXml', containerXml)
  console.log('rootXml', rootXml)

  for (const item of items) {
    const url = item.getAttribute('href')
    const text = await fetch(url).then(r => r.text())
    const div = document.createElement('div')
    div.innerHTML = text
    bookContainer.appendChild(div)
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
  console.log('entries', entries)

  const cacheKey = caches.keys()[0]
  const cache = await caches.open(cacheKey)
  for (const entry of entries) {
    const writer = new zip.BlobWriter()
    const blob = await entry.getData(writer)
    const ext = entry.filename?.split('.')?.pop() || 'txt'
    const url = `${location.href}${entry.filename.replace(/^\w+\//, '')}`
    const options = {
      headers: {
        'Content-Type': mimetypes[ext]
      }
    }
    cache.put(url, new Response(blob, options))
  }
}

async function getEpubEntryMap(entries) {
  const imageExtentions = ['.jpg', '.jpeg', '.png', '.gif']
  const epubEntryMap = {}

  for (const entry of entries) {
    const name = entry.filename.replace(/^[A-Z]+\//, '')

    let data
    const isImage = imageExtentions.some(ext => entry.filename.endsWith(ext))
    if (isImage) {
      const writer = new zip.BlobWriter()
      const blob = await entry.getData(writer)
      data = await blob_b64(blob)
    } else {
      const writer = new zip.TextWriter()
      data = await entry.getData(writer)
    }

    epubEntryMap[name] = data
  }

  return epubEntryMap
}

async function blob_b64(blob) {
  var buf = await blob.arrayBuffer()
  var bytes = new Uint8Array(buf)
  var bin = bytes.reduce((acc, byte) => acc += String.fromCharCode(byte), '')
  var b64 = btoa(bin)
  return b64
}