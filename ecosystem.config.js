export default {
  apps: [
    {
      name: 'bpls',
      script: 'src/server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4011,
      },
    },
  ],
};
