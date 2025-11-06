// Service Worker สำหรับโปรแกรมรับซื้อทอง
const CACHE_NAME = 'gold-purchase-v1';
const urlsToCache = [
  '/',
  '/gold_purchase_v2_6.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap'
];

// ติดตั้ง Service Worker และ cache ไฟล์
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('✅ Service Worker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('❌ Service Worker: Cache failed', error);
      })
  );
  self.skipWaiting();
});

// เปิดใช้งาน Service Worker
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// จัดการ request
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // ถ้าเป็น API ของ Gold Spot Price หรือ Google Sheets ให้เรียกจากเน็ตเสมอ
  if (url.hostname.includes('goldapi.io') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('sheets.google.com')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(JSON.stringify({
            error: 'ไม่สามารถเชื่อมต่อได้ กรุณาตรวจสอบอินเทอร์เน็ต'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
  
  // สำหรับไฟล์อื่นๆ ใช้ cache first strategy
  event.respondWith(
    caches.match(request)
      .then((response) => {
        // ถ้ามีใน cache ให้ใช้จาก cache
        if (response) {
          console.log('📦 Serving from cache:', request.url);
          return response;
        }
        
        // ถ้าไม่มีใน cache ให้ดึงจากเน็ต
        return fetch(request)
          .then((response) => {
            // ตรวจสอบว่า response ถูกต้องหรือไม่
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone response เพราะ response สามารถใช้ได้ครั้งเดียว
            const responseToCache = response.clone();
            
            // เพิ่มเข้า cache
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
            
            return response;
          })
          .catch((error) => {
            console.log('❌ Fetch failed:', error);
            // ถ้าไม่มีเน็ตและไม่มีใน cache ให้แสดง offline page
            return new Response('ไม่สามารถโหลดหน้านี้ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain; charset=utf-8'
              })
            });
          });
      })
  );
});

// รับ message จาก client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('✅ Service Worker loaded successfully!');
