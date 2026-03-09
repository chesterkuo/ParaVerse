module.exports = {
  apps: [
    {
      name: "paraverse-backend",
      cwd: "./backend",
      script: "src/index.ts",
      interpreter: "bun",
      env: {
        NODE_ENV: "development",
      },
      watch: false,
      max_memory_restart: "512M",
      error_file: "./logs/backend-error.log",
      out_file: "./logs/backend-out.log",
      merge_logs: true,
      time: true,
    },
    {
      name: "paraverse-frontend",
      cwd: "./frontend",
      script: "node_modules/.bin/vite",
      args: "--host 0.0.0.0",
      env: {
        NODE_ENV: "development",
      },
      watch: false,
      max_memory_restart: "512M",
      error_file: "./logs/frontend-error.log",
      out_file: "./logs/frontend-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
