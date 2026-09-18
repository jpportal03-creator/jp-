import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'JP Dating',
    short_name: 'JP Dating',
    description: 'Independent student social and dating platform.',
    start_url: '/discover',
    display: 'standalone',
    background_color: '#f5f3ed',
    theme_color: '#295f50',
    lang: 'en',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }, { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }],
  };
}
