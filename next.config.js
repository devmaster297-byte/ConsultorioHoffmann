// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  // Não fazer cache de rotas de autenticação ou API
  buildExcludes: [/middleware-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: 'NetworkOnly', // Supabase sempre vai para a rede
    },
    {
      urlPattern: /^\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'static-assets', expiration: { maxEntries: 200 } },
    },
    {
      urlPattern: /^\/_next\/image\/.*/i,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'image-assets' },
    },
    {
      urlPattern: /^\/icons\/.*/i,
      handler: 'CacheFirst',
      options: { cacheName: 'icons' },
    },
    {
      // Rotas da aplicação — sempre rede, fallback para cache
      urlPattern: /^\/(?!api|_next).*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'app-pages',
        networkTimeoutSeconds: 10,
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/**',
      },
    ],
  },
}

module.exports = withPWA(nextConfig)