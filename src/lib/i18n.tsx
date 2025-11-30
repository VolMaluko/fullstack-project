/** @format */

"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { translations, Lang } from "./translations";

type I18nContextType = {
	lang: Lang;
	setLang: (l: Lang) => void;
	t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
	const [lang, setLangState] = useState<Lang>(
		(typeof window !== "undefined" && (localStorage.getItem("lang") as Lang)) ||
			"en"
	);

	useEffect(() => {
		try {
			localStorage.setItem("lang", lang);
		} catch (e) {}
	}, [lang]);

	const setLang = (l: Lang) => setLangState(l);

	const t = (key: string, vars?: Record<string, string | number>) => {
		const dict = translations[lang] || translations["en"];
		let txt = dict[key] || translations["en"][key] || key;
		if (vars) {
			for (const k of Object.keys(vars)) {
				txt = txt.replace(
					new RegExp(`\\{\\s*${k}\\s*\\}`, "g"),
					String(vars[k])
				);
			}
		}
		return txt;
	};

	return (
		<I18nContext.Provider value={{ lang, setLang, t }}>
			{children}
		</I18nContext.Provider>
	);
}

export function useI18n() {
	const ctx = useContext(I18nContext);
	if (!ctx) throw new Error("useI18n must be used within I18nProvider");
	return ctx;
}
