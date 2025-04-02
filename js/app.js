class App {
  appContainer = document.getElementById('app-container')
  bookContainer = document.getElementById('book-container')
  bookInput = document.getElementById('book-input')
  topMenu = document.getElementById('top-menu')
  topMenuWrapper = document.getElementById('top-menu-wrapper')
  loadingWrapper = document.getElementById('loading-wrapper')

  constructor() {
    this.initUserStyles()
    this.initEvents()
    this.readBook()
  }

  initUserStyles() {
    const fontSize = localStorage.getItem('fontSize')
    const padding = localStorage.getItem('padding')
    if (fontSize) {
      this.bookContainer.style.fontSize = fontSize
    }
    if (padding) {
      this.appContainer.style.padding = padding
    }
  }

  initEvents() {
    const self = this

    document.getElementById('font-decrease').onclick = () => this.changeFontSize(-1)
    document.getElementById('font-increase').onclick = () => this.changeFontSize(1)
    document.getElementById('padding-decrease').onclick = () => this.changePagePadding(-2)
    document.getElementById('padding-increase').onclick = () => this.changePagePadding(2)
    document.addEventListener('click', this.handleClick.bind(this))
    this.bookInput.onchange = function () {
      self.handleFileChange(this.files)
    }
  }

  changeFontSize(px) {
    const topElement = this.getTopElement()
    const fontSize = parseInt(getComputedStyle(this.bookContainer).fontSize)
    const newFontSize = `${fontSize + px}px`
    this.bookContainer.style.fontSize = newFontSize
    topElement.scrollIntoView()
    localStorage.setItem('fontSize', newFontSize)
    localStorage.setItem('scrollTop', this.bookContainer.scrollTop)
  }

  changePagePadding(px) {
    const topElement = this.getTopElement()
    const padding = parseInt(getComputedStyle(this.appContainer).padding)
    const newPadding = `${padding + px}px`
    this.appContainer.style.padding = newPadding
    topElement.scrollIntoView()
    localStorage.setItem('padding', newPadding)
    localStorage.setItem('scrollTop', this.bookContainer.scrollTop)
  }

  handleClick(e) {
    if (e.target.tagName.toLowerCase() === 'a') {
      e.preventDefault()
      const id = e.target.href.split('#')[1]
      return document.getElementById(id)?.scrollIntoView()
    }

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
      return
    }

    if (this.isTopMenuVisible && e.target === this.topMenuWrapper) {
      this.isTopMenuVisible = false
      return
    }

    let newScrollTop
    const lineHeight = parseFloat(getComputedStyle(this.getTopElement())?.lineHeight)

    if (clickPosition === 'right') {
      newScrollTop = this.bookContainer.scrollTop + this.bookContainer.clientHeight - lineHeight
    } else if (clickPosition === 'left') {
      newScrollTop = this.bookContainer.scrollTop - this.bookContainer.clientHeight + lineHeight
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

    this.isLoading = true

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
    this.isTopMenuVisible = false
    this.isLoading = false
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

  getXPath(element) {
    let selector = ''
    let foundRoot
    let currentElement = element

    do {
      const tagName = currentElement.tagName.toLowerCase()
      const parentElement = currentElement.parentElement

      if (parentElement.childElementCount > 1) {
        const parentsChildren = [...parentElement.children]
        let tag = []
        parentsChildren.forEach(child => {
          if (child.tagName.toLowerCase() === tagName) tag.push(child)
        })

        if (tag.length === 1) {
          selector = `/${tagName}${selector}`
        } else {
          const position = tag.indexOf(currentElement) + 1
          selector = `/${tagName}[${position}]${selector}`
        }

      } else {
        selector = `/${tagName}${selector}`
      }

      currentElement = parentElement
      foundRoot = parentElement.tagName.toLowerCase() === 'html'
      if (foundRoot) selector = `/html${selector}`
    }
    while (foundRoot === false)

    return selector
  }

  get isTopMenuVisible() {
    return this.topMenuWrapper.style.display === 'flex'
  }
  set isTopMenuVisible(value) {
    this.topMenuWrapper.style.display = value ? 'flex' : 'none'
  }

  get isLoading() {
    return this.loadingWrapper.style.display === 'flex'
  }
  set isLoading(value) {
    this.loadingWrapper.style.display = value ? 'flex' : 'none'
  }

  getTopElement() {
    const padding = parseInt(getComputedStyle(this.appContainer).padding)
    return document.elementFromPoint(padding, padding)
  }
}

new App()
