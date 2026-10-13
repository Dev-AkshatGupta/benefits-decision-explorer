const value = process.env.DEMO_BASE_URL;
if (!value)
  throw new Error(
    'Set DEMO_BASE_URL to the deployed demonstration origin before remote verification.',
  );
const url = new URL(value);
if (
  url.protocol !== 'https:' ||
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  url.pathname !== '/'
)
  throw new Error(
    'DEMO_BASE_URL must be an origin-only HTTPS URL without credentials, tokens or a path.',
  );
