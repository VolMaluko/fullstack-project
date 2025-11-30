/** @format */

"use client";

import { useI18n } from "../lib/i18n";
import LanguageToggle from "./LanguageToggle";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function NavHeader() {
	const { t } = useI18n();
	const [userName, setUserName] = useState<string | null>(null);
	const [avatar, setAvatar] = useState<string | null>(null);

	useEffect(() => {
		const n = localStorage.getItem("user_name");
		const a = localStorage.getItem("user_avatar");
		setUserName(n);
		setAvatar(a);
	}, []);

	return (
		<header className='w-full border-b border-white/6 bg-[#000814] fixed top-0 left-0 right-0 z-40 h-16'>
			<div className='max-w-6xl mx-auto px-4 h-16 flex items-center justify-between'>
				<div className='flex items-center gap-4'>
					<div className='text-cyan-300 font-bold text-lg'>GamerHub</div>
					<nav className='hidden sm:flex gap-3 ml-4 text-sm text-slate-300'>
						<a href='/' className='hover:underline'>
							{t("home")}
						</a>
						<a href='/games' className='hover:underline'>
							{t("gamesTitle")}
						</a>
						<a href='/dashboard' className='hover:underline'>
							{t("dashboard")}
						</a>
					</nav>
				</div>
				<div className='flex items-center gap-3'>
					<LanguageToggle />
					{userName ? (
						<div className='flex items-center gap-3'>
							<Link href='/profile' className='flex items-center gap-2'>
								{avatar ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={avatar}
										alt={userName}
										className='w-9 h-9 rounded-full object-cover'
									/>
								) : (
									<div className='w-9 h-9 rounded-full bg-white/6 flex items-center justify-center text-sm text-slate-100'>
										{userName.slice(0, 1).toUpperCase()}
									</div>
								)}
								<span className='text-sm text-slate-100 hidden sm:inline'>
									{userName}
								</span>
							</Link>
						</div>
					) : (
						<>
							<a href='/login' className='btn-hi'>
								{t("login")}
							</a>
							<a href='/register' className='btn-hi bg-cyan-600 text-[#021018]'>
								{t("register")}
							</a>
						</>
					)}
				</div>
			</div>
		</header>
	);
}
