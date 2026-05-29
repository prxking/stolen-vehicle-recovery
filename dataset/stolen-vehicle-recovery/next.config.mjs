/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/dev.db', '**/dev.db-journal', '**/node_modules'],
    };
    return config;
  },
};

export default nextConfig;
