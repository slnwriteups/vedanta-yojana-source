const fs = require('node:fs');
module.exports = ({ config }) => {
  // EAS file-type environment variable; never commit Firebase or service-account credentials.
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || './google-services.json';
  if (fs.existsSync(googleServicesFile)) config.android = { ...config.android, googleServicesFile };
  if (process.env.EAS_BUILD_PLATFORM === 'android' && !config.android.googleServicesFile) {
    throw new Error('Android push requires GOOGLE_SERVICES_JSON (EAS file environment variable) or mobile/google-services.json. Configure FCM before building.');
  }
  return config;
};
