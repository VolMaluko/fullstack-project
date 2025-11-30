/** @format */

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "../lib/i18n";
import NavHeader from "../components/NavHeader";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "GamerHub",
	description: "For gaming enthusiasts and community building",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang='en'>
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#000814]`}
				style={{ overflow: "auto" }}>
				<I18nProvider>
					<NavHeader />
					<main className='mt-16 min-h-screen'>{children}</main>
				</I18nProvider>
			</body>
		</html>
	);
}
