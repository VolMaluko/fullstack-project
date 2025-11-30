/** @format */

"use client";
import React from "react";
import { useI18n } from "../lib/i18n";

export default function LanguageToggle() {
	const { lang, setLang } = useI18n();

	return (
		<div className='flex items-center gap-2'>
			<button
				aria-label='English'
				onClick={() => setLang("en")}
				className={`px-2 py-1 rounded ${
					lang === "en" ? "bg-white/8" : "bg-transparent"
				}`}>
				🇺🇸
			</button>
			<button
				aria-label='Português'
				onClick={() => setLang("pt")}
				className={`px-2 py-1 rounded ${
					lang === "pt" ? "bg-white/8" : "bg-transparent"
				}`}>
				🇧🇷
			</button>
		</div>
	);
}
