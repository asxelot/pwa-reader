class App {
  appContainer = document.getElementById('app-container')
  bookContainer = document.getElementById('book-container')
  bookInput = document.getElementById('book-input')
  topMenu = document.getElementById('top-menu')
  topMenuWrapper = document.getElementById('top-menu-wrapper')

  isTopMenuVisible = false

  constructor() {
    this.initUserStyles()
    this.initEvents()
    this.readBook()
  }

  initUserStyles() {
    const fontSize = localStorage.getItem('fontSize')
    const margin = localStorage.getItem('margin')
    if (fontSize) {
      this.bookContainer.style.fontSize = fontSize
    }
    if (margin) {
      this.appContainer.style.padding = margin
    }
  }

  initEvents() {
    const self = this

    document.getElementById('font-decrease').onclick = () => this.changeFontSize(-1)
    document.getElementById('font-increase').onclick = () => this.changeFontSize(1)
    document.getElementById('margin-decrease').onclick = () => this.changePageMagin(-2)
    document.getElementById('margin-increase').onclick = () => this.changePageMagin(2)
    document.addEventListener('click', this.handleClick.bind(this))
    this.bookInput.onchange = function() {
      self.handleFileChange(this.files)
    }
  }

  changeFontSize(px) {
    const fontSize = parseInt(getComputedStyle(this.bookContainer).fontSize)
    const newFontSize = `${fontSize + px}px`
    this.bookContainer.style.fontSize = newFontSize
    localStorage.setItem('fontSize', newFontSize)
    localStorage.setItem('scrollTop', this.bookContainer.scrollTop)
  }

  changePageMagin(px) {
    const margin = parseInt(getComputedStyle(this.appContainer).padding)
    const newMargin = `${margin + px}px`
    this.appContainer.style.padding = localStorage.getItem('margin')
    localStorage.setItem('margin', newMargin)
    localStorage.setItem('scrollTop', this.bookContainer.scrollTop)
  }

  handleClick(e) {
    if (e.target.tagName.toLowerCase() === 'a') {
      e.preventDefault()
      const id = e.target.href.split('#')[1]
      return document.getElementById(id).scrollIntoView()
    }

    const fontSize = parseFloat(getComputedStyle(this.bookContainer).fontSize)
    const lineHeight = parseFloat(getComputedStyle(this.bookContainer).lineHeight)
    const lineSize = fontSize + lineHeight
    
    const x = e.x / this.bookContainer.clientWidth
    const y = e.y / this.bookContainer.clientHeight
    const clickPosition = (() => {
      if (y <= 0.2) {
        return 'top'
      } else if (x <= 0.4) {
        return 'left'
      } else {
        return 'right'
      }
    })()
  
    if (clickPosition === 'top' && !this.isTopMenuVisible) {
      this.isTopMenuVisible = true
      this.topMenuWrapper.style.display = 'block'
    }
  
    if (this.isTopMenuVisible && e.target === this.topMenuWrapper) {
      this.isTopMenuVisible = false
      this.topMenuWrapper.style.display = 'none'
      return 
    }
  
    let newScrollTop
    if (clickPosition === 'right') {
      newScrollTop = this.bookContainer.scrollTop + this.bookContainer.clientHeight - lineSize
    } else if (clickPosition === 'left') {
      newScrollTop = this.bookContainer.scrollTop - this.bookContainer.clientHeight + lineSize
    }
  
    if (newScrollTop) {
      this.bookContainer.scrollTop = newScrollTop
      localStorage.setItem('scrollTop', newScrollTop)
    }
  }

  handleFileChange([file]) {
    try {
      if (file) this.readFile(file)
    } catch (err) {
      console.error(err)
    }
  }

  readFile(file) {
    const reader = new FileReader()
    reader.addEventListener('load', event => {
      localStorage.setItem('scrollTop', 0)
      this.getEntries(event).then(() => this.readBook())
    })
    reader.readAsDataURL(file)
  }

  async readBook() {
    const parser = new DOMParser()
    const containerXml = await fetch('META-INF/container.xml').then(r => r.text())
  
    if (!containerXml) return 
  
    const container = parser.parseFromString(containerXml, 'application/xml')
    const rootfile = container.querySelector('rootfile')
    const fullPath = rootfile.getAttribute('full-path')
  
    const rootXml = await fetch(fullPath.replace(/^\w+\//, '')).then(r => r.text())
    const root = parser.parseFromString(rootXml, 'application/xml')
    const lang = root.querySelector('language')
    const items = root.querySelectorAll('item[media-type="application/xhtml+xml"]')
  
    this.bookContainer.setAttribute('lang', lang.textContent)
    this.bookContainer.innerHTML = '' 
  
    for (const item of items) {
      const url = item.getAttribute('href')
      const xhtml = await fetch(url).then(r => r.text())
      const el = document.createElement('item')
      el.setAttribute('id', url)
      el.innerHTML = xhtml
      this.bookContainer.appendChild(el)
    }
  
    await this.waitForImages()
  
    this.scrollToLastPosition()
  }

  async waitForImages() {
    const images = Array.from(document.images)
    const notComplete = images.filter(img => !img.complete)
    await Promise.all(notComplete.map(img => new Promise(resolve => { img.onload = img.onerror = resolve })))
  }

  scrollToLastPosition() {
    const prevScrollPosition = parseInt(localStorage.getItem('scrollTop'))
    if (prevScrollPosition) {
      this.bookContainer.scrollTop = prevScrollPosition
    }
  }

  async getEntries(event) {
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
}

new App()
