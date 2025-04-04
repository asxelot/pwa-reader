const GHPATH = '/pwa-reader'
const APP_PREFIX = 'pwar_'
const VERSION = 'v0.0.0.a16'
const URLS = [
  `${GHPATH}/`,
  `${GHPATH}/index.html`,
  `${GHPATH}/css/reset.css`,
  `${GHPATH}/css/styles.css`,
  `${GHPATH}/img/icon.png`,
  `${GHPATH}/js/zip.min.js`,
  `${GHPATH}/js/app.js`,
  `${GHPATH}/sw.js`,
  `${GHPATH}/manifest.webmanifest`
]

const CACHE_NAME = APP_PREFIX + VERSION

caches.keys().then(keys => {
  for (const key of keys) {
    if (key.startsWith(APP_PREFIX) && key !== CACHE_NAME) {
      caches.delete(key)
    }
  }
})

self.addEventListener('fetch', function (e) {
  console.log('Fetch request : ' + e.request.url);
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(function (request) {
      if (request) {
        console.log('Responding with cache : ' + e.request.url);
        return request
      } else {
        console.log('File is not cached, fetching : ' + e.request.url);
        return fetch(e.request)
      }
    })
  )
})

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      console.log('Installing cache : ' + CACHE_NAME);
      return cache.addAll(URLS)
    })
  )
})

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keyList) {
      const cacheWhitelist = keyList.filter(function (key) {
        return key.indexOf(APP_PREFIX)
      })
      cacheWhitelist.push(CACHE_NAME);
      return Promise.all(keyList.map(function (key, i) {
        if (cacheWhitelist.indexOf(key) === -1) {
          console.log('Deleting cache : ' + keyList[i]);
          return caches.delete(keyList[i])
        }
      }))
    })
  )
})
