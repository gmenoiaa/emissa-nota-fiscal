import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['node-forge', 'xml-crypto', '@react-pdf/renderer'],
};

export default nextConfig;

