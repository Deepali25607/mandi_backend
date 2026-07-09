// PM2 process definition for the Mandi ERP API.
//   pm2 start deploy/ecosystem.config.js
//   pm2 save && pm2 startup   (to survive reboots)
//
// Runtime config (DATABASE_URL, CORS_ORIGIN, DB_SSL, ...) is read from the
// backend's .env file — see .env.example. Only PORT/NODE_ENV are set here.
module.exports = {
  apps: [
    {
      name: 'mandi-api',
      cwd: '/home/ubuntu/mandi-backend',
      script: 'dist/main.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
  ],
};
