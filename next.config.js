// next.config.js
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development', // desabilitar em dev (evita problemas de cache)
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // Cache de páginas do app (stale-while-revalidate)
      urlPattern: /^https:\/\/dentesoft\.vercel\.app\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 1 dia
        },
      },
    },
    {
      // Cache de fontes do Google
      urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'google-fonts',
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 ano
        },
      },
    },
    {
      // Cache de assets estáticos (_next/static)
      urlPattern: /\/_next\/static\/.*/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 dias
        },
      },
    },
  ],
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        // Imagens do Supabase Storage (fotos de pacientes com URL pública temporária)
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
      {
        // Signed URLs do Supabase Storage
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/sign/**',
      },
    ],
  },
  // Habilitar SWC minification
  swcMinify: true,
}

module.exports = withPWA(nextConfig)
