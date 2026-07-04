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

  // ── Headers de segurança ───────────────────────────────────────────────
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Impede que o app seja embutido em iframes (clickjacking)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Impede que o browser "adivinhe" o Content-Type de respostas
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Limita referrer a origem + path ao navegar para sites externos
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Bloqueia câmera, microfone e geolocalização (não usados pelo app)
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Força HTTPS por 1 ano em browsers que já acessaram o app
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)