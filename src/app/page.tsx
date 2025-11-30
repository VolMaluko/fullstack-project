/** @format */

"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../lib/i18n";
// simple carousel implementation (avoids swiper module import issues)

function Carousel({ items }: { items: any[] }) {
	const ref = useRef<HTMLDivElement | null>(null);
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);

	useEffect(() => {
		if (!items || items.length === 0) return;
		const iv = setInterval(() => {
			if (paused) return;
			setIndex((i) => (i + 1) % items.length);
		}, 3500);
		return () => clearInterval(iv);
	}, [items, paused]);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const items = el.querySelectorAll<HTMLDivElement>(".carousel-item");
		const child = items[index];
		if (child) {
			const left = child.offsetLeft - (el.clientWidth - child.clientWidth) / 2;
			el.scrollTo({ left, behavior: "auto" });
		}
	}, [index]);

	return (
		<div
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			className='overflow-hidden py-4'>
			<div
				ref={ref}
				className='flex gap-4 px-2 snap-x snap-mandatory overflow-x-auto scrollbar-hide'>
				{items.map((m, i) => (
					<div
						key={i}
						className='carousel-item snap-center'
						style={{ width: 224 }}>
						<a
							href={m.url || `https://store.steampowered.com/app/${m.id}`}
							target='_blank'
							rel='noreferrer'
							className='block rounded-xl overflow-hidden panel-hi neon-border'>
							{m.header_image ? (
								<img
									src={m.header_image || m.img_url || m.small_capsule_image}
									alt={m.name || m.title}
									className='w-full h-32 object-cover'
								/>
							) : (
								<div className='w-full h-32 bg-[#04121a] flex items-center justify-center text-slate-400'>
									No image
								</div>
							)}
							<div className='p-3'>
								<div className='font-semibold text-sm text-slate-100 line-clamp-2'>
									{m.name || m.title}
								</div>
								<div className='text-xs text-slate-400 mt-1'>
									{m.price || m.savings ? m.price : ""}
								</div>
							</div>
						</a>
					</div>
				))}
			</div>
		</div>
	);
}

export default function HomePage() {
	const router = useRouter();
	const { t } = useI18n();
	const [games, setGames] = useState<any[]>([]);
	const [query, setQuery] = useState("");
	const [swiperInstance, setSwiperInstance] = useState<any>(null);

	// Most viewed / featured this week from Steam (client-side)
	const [mostViewed, setMostViewed] = useState<any[]>([]);

	// Deduplicate by name
	const dedupeByName = (list: any[]) => {
		const seen = new Set<string>();
		return list.filter((item) => {
			const name = (item.name || item.title || "").toLowerCase();
			if (seen.has(name)) return false;
			seen.add(name);
			return true;
		});
	};
	useEffect(() => {
		fetch("http://localhost:3001/games")
			.then((response) => response.json())
			.then((data) => {
				setGames(data); // Assuming the response is an array of games
			})
			.catch((error) => {
				console.error("Error fetching games:", error);
			});
	}, []);
	// Scroll to top on mount
	useEffect(() => {
		window.scrollTo(0, 0);
		if ("scrollRestoration" in window.history) {
			window.history.scrollRestoration = "manual";
		}
	}, []);

	useEffect(() => {
		// Try Steam featuredcategories endpoint and fall back gracefully
		// Use the server-side proxy to avoid CORS and cache results
		fetch("http://localhost:3001/steam/featuredcategories")
			.then((r) => r.json())
			.then((js) => {
				const candidates =
					(js?.top_sellers && js.top_sellers.items) ||
					(js?.most_played && js.most_played.items) ||
					js?.featured ||
					[];
				const deduped = dedupeByName(candidates || []);
				setMostViewed(deduped.slice(0, 12));
			})
			.catch(() => {
				// ignore failures (Steam may block CORS); optionally we could proxy via server
				setMostViewed([]);
			});
	}, []);

	function onSearch(e: React.FormEvent) {
		e.preventDefault();
		router.push(`/games?search=${encodeURIComponent(query)}`);
	}

	return (
		<main className='min-h-screen bg-linear-to-br from-[#000812] via-[#071021] to-[#001018] text-slate-100'>
			<style>{`\n        @keyframes floatUp { 0%{ transform: translateY(10px); } 50%{ transform: translateY(-10px);} 100%{ transform: translateY(10px);} }\n        .float { animation: floatUp 6s ease-in-out infinite; }\n      `}</style>

			{/* header actions are in global layout now */}

			{/* animated background */}
			<div className='absolute inset-0 -z-10 opacity-30'>
				<div className='w-full h-full grid grid-cols-6 gap-4 p-8'>
					{Array.isArray(games) &&
						games.map((g, i) => (
							<div
								key={g.id}
								className={`rounded-lg overflow-hidden bg-black/20 border border-white/5 float`}
								style={{ animationDelay: `${(i % 6) * 0.6}s` }}>
								<img
									src={g.image || "/logo.png"}
									alt={g.name}
									className='w-full h-40 object-cover opacity-80'
								/>
								<div className='p-2 text-xs text-slate-300'>{g.name}</div>
							</div>
						))}
				</div>
			</div>

			<div className='relative z-10 flex items-center justify-center min-h-screen px-4'>
				<div className='max-w-4xl w-full text-center'>
					<div className='p-8 card-tech rounded-2xl shadow-2xl'>
						<h1 className='text-5xl font-extrabold text-white mb-4'>
							{t("siteTitle")}
						</h1>
						<p className='text-slate-300 mb-6'>
							{t("siteTitle")} — {t("gamesTitle")} and community for players.
						</p>
						<form
							onSubmit={onSearch}
							className='flex gap-0 items-center justify-center mt-4'>
							<input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder={t("searchPlaceholder")}
								className='input-hi w-full max-w-2xl rounded-l-lg'
							/>
							<button className='btn-hi rounded-r-lg ml-2'>
								{t("searchPlaceholder")}
							</button>
						</form>
						<div className='mt-8 flex gap-4 justify-center'>
							<a href='/games' className='btn-hi px-6 py-3'>
								{t("gamesTitle")}
							</a>
							<a
								href='/dashboard'
								className='btn-hi px-6 py-3 bg-cyan-600 text-[#021018]'>
								Dashboard
							</a>
						</div>
					</div>
					{/* add a compact featured strip */}
					{mostViewed.length > 0 && (
						<div className='mt-8'>
							<h3 className='text-cyan-300 font-semibold mb-3'>
								Featured This Week
							</h3>
							<Carousel items={mostViewed.slice(0, 6)} />
						</div>
					)}
				</div>
			</div>

			{/* Most viewed this week (Steam) */}
			{mostViewed.length > 0 && (
				<section className='relative z-10 max-w-6xl mx-auto mt-8 px-4'>
					<h2 className='text-2xl font-semibold text-cyan-300 mb-4'>
						Most Viewed This Week
					</h2>
					<Carousel items={mostViewed} />
				</section>
			)}
		</main>
	);
}
