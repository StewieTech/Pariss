// Load .env into process.env for Expo dev; expo will inject `expo.constants.manifest.extra` from this config.
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
      ELEVEN_API_KEY: process.env.ELEVEN_API_KEY || '',
      ELEVEN_VOICE_ID: process.env.ELEVEN_VOICE_ID || '',
    },
  };
};
