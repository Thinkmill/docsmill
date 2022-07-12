const withBundleAnalyzer =
  ({ enabled = true } = {}) =>
  (nextConfig = {}) => {
    return Object.assign({}, nextConfig, {
      webpack(config, options) {
        if (enabled) {
          const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
          config.plugins.push(
            new BundleAnalyzerPlugin({
              analyzerMode: "static",
              reportFilename: options.isServer
                ? "../analyze/server.html"
                : "./analyze/client.html",
              generateStatsFile: true,
              statsFilename: options.isServer
                ? "../analyze/server-stats.json"
                : "./analyze/client-stats.json",
            })
          );
        }

        if (typeof nextConfig.webpack === "function") {
          return nextConfig.webpack(config, options);
        }
        return config;
      },
    });
  };

/** @type {import('next').NextConfig} */
const config = {
  optimizeFonts: false,
  typescript: {
    tsconfigPath: "../tsconfig.json",
  },
  experimental: {
    newNextLinkBehavior: true,
  },
};

module.exports = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(config);
