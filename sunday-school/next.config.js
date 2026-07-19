/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Make sure the scripture + topic data files are bundled into the
    // serverless functions that read them with fs at runtime — both the
    // standalone study route and the phase route (which builds study when the
    // teacher picks a question).
    outputFileTracingIncludes: {
      "/api/study": ["./data/**"],
      "/api/session/[code]/phase": ["./data/**"],
    },
  },
};

module.exports = nextConfig;
