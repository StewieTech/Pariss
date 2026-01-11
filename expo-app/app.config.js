// Load .env into process.env so we can read it below.
// This runs at build time (when metro/expo bundles).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch (e) {
  // no-op if dotenv isn't available
}

module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      // Explicitly forward EXPO_PUBLIC_* vars so they're available at runtime
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || '',
      // Legacy support
      EXPO_API_URL: process.env.EXPO_API_URL || '',
      // Existing keys
      ELEVEN_API_KEY: process.env.ELEVEN_API_KEY || '',
      ELEVEN_VOICE_ID: process.env.ELEVEN_VOICE_ID || '',
    },
  };
};
