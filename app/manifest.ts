import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CarrinhoCerto',
    short_name: 'CarrinhoCerto',
    description: 'Coleção de Hot Wheels com busca rápida, offline e alerta de duplicidade.',
    start_url: '/',
    display: 'standalone',
    background_color: '#080b14',
    theme_color: '#080b14',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}