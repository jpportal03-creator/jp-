const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

if (process.env.NODE_ENV === 'production' && !configuredApiUrl) {
  throw new Error('NEXT_PUBLIC_API_URL must be configured in production');
}

if (process.env.NODE_ENV === 'production' && !configuredSiteUrl) {
  throw new Error('NEXT_PUBLIC_SITE_URL must be configured in production');
}

export const apiUrl = configuredApiUrl || 'http://localhost:4000';
export const siteUrl = configuredSiteUrl || 'http://localhost:3000';