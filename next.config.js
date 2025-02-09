/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        ({ context, request }, callback) => {
          if (request === "@uniswap/smart-order-router") {
            return callback(null, "commonjs2 @uniswap/smart-order-router");
          }
          callback();
        },
      ];
    }
    return config;
  },
}

module.exports = nextConfig 