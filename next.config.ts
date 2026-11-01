import type {NextConfig} from 'next';

const config: NextConfig = {
  output: 'export',
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  generateBuildId: async()=>process.env.CHORYN_BUILD || 'development',
  images: {unoptimized: true},
  webpack(config) {
    config.resolve.extensionAlias = {'.js': ['.ts', '.tsx', '.js'], '.mjs': ['.mts', '.mjs']};
    return config;
  }
};

export default config;
