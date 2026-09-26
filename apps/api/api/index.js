let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const { createApp } = require('../dist/apps/api/src/app.js');
      const app = await createApp();
      await app.ready();
      return app;
    })();
  }
  return appPromise;
}

module.exports = async function handler(req, res) {
  const app = await getApp();
  app.server.emit('request', req, res);
};
