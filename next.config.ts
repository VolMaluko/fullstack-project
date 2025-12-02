/** @format */

import type { NextConfig } from "next";

const nextConfig = {
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "cdn.akamai.steamstatic.com",
			},
			{
				protocol: "https",
				hostname: "steamcdn-a.akamaihd.net",
			},
		],
	},
};

module.exports = nextConfig;
export default nextConfig as NextConfig;
