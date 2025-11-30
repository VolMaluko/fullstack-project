/** @format */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "../../lib/i18n";

type SteamApp = { appid: number; name: string };

const GENRE_KEYWORDS: Record<string, string[]> = {
	RPG: ["rpg", "action rpg", "jrpg"],
	Roguelike: ["roguelike"],
	Roguelite: ["roguelite"],
	Action: ["action"],
	Adventure: ["adventure"],
	Shooter: ["shooter", "fps"],
	Strategy: ["strategy", "rts"],
	Puzzle: ["puzzle"],
	Indie: ["indie"],
	Multiplayer: ["multiplayer", "coop"],
};

export default function GamesPage() {
	const { t } = useI18n();
	const [apps, setApps] = useState<SteamApp[]>([]);
	const [query, setQuery] = useState("");
	const [loading, setLoading] = useState(false);
	const [page, setPage] = useState(1);
	const [showAll, setShowAll] = useState(false);
	const [selectedGenre, setSelectedGenre] = useState<string>("");
	const perPage = 30;
	const [searchResults, setSearchResults] = useState<SteamApp[]>([]);
	const STEAM_HEADERS = {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
		Accept:
			"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
		"Accept-Language": "en-US,en;q=0.9, br;q=0.8",
		"Accept-Encoding": "gzip, deflate, br",
		Connection: "keep-alive",
		Referer: "https://store.steampowered.com/",
		Host: "store.steampowered.com",
		Pragma: "no-cache",
		"Cache-Control": "no-cache",
	};

	// Scroll to top on mount
	useEffect(() => {
		window.scrollTo(0, 0);
		if ("scrollRestoration" in window.history) {
			window.history.scrollRestoration = "manual";
		}
	}, []);

	// Deduplicate apps by name
	const dedupeApps = (list: SteamApp[]) => {
		const seen = new Set<string>();
		return list.filter((app) => {
			const name = app.name.toLowerCase();
			if (seen.has(name)) return false;
			seen.add(name);
			return true;
		});
	};

	useEffect(() => {
		let isMounted = true; // Track if the component is mounted

		async function load() {
			setLoading(true);
			try {
				const res = await fetch("http://localhost:3001/steam/apps");
				const json = await res.json();

				let list = json?.applist?.apps || [];
				list = dedupeApps(list);

				if (isMounted) {
					setApps(list); // Set state only if component is still mounted
				}
			} catch (err) {
				console.error("Failed to fetch apps list", err);
			} finally {
				if (isMounted) setLoading(false); // Stop loading if the component is still mounted
			}
		}

		load();

		return () => {
			isMounted = false; // Cleanup function to set the flag to false when unmounting
		};
	}, []); // Empty dependency array ensures this effect runs once when the component mounts

	const filtered = useMemo(() => {
		// If searching on Steam → override local list
		let result = searchResults.length > 0 ? searchResults : apps;

		// Filter by search query
		const q = query.trim().toLowerCase();
		if (q) {
			result = result.filter((a) => a.name.toLowerCase().includes(q));
		}

		// Filter by genre
		if (selectedGenre) {
			const keywords = GENRE_KEYWORDS[selectedGenre] || [];
			result = result.filter((a) => {
				const name = a.name.toLowerCase();
				return keywords.some((k) => name.includes(k));
			});
		}

		// Limit to 30 if not showing all
		if (!showAll) {
			result = result.slice(0, 30);
		}

		return result;
	}, [apps, query, selectedGenre, showAll]);

	const total = filtered.length;
	const totalPages = Math.max(1, Math.ceil(total / perPage));
	const pageItems = filtered.slice((page - 1) * perPage, page * perPage);

	const [detailsMap, setDetailsMap] = useState<Record<string, any>>({});

	useEffect(() => {
		if (!pageItems || pageItems.length === 0) return;
		const ids = pageItems.map((p) => String(p.appid)).join(",");
		let mounted = true;
		(async () => {
			try {
				const res = await fetch(
					`http://localhost:3001/steam/appdetails?appids=${ids}`
				);
				if (!res.ok) return;
				const json = await res.json();
				if (!mounted) return;
				setDetailsMap((m) => ({ ...m, ...json }));
			} catch (err) {
				console.error("Failed to fetch app details", err);
			}
		})();
		return () => {
			mounted = false;
		};
	}, [pageItems]);

	// Generate page number buttons
	const paginationButtons = [];
	const maxButtons = 5;
	let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
	let endPage = Math.min(totalPages, startPage + maxButtons - 1);
	if (endPage - startPage + 1 < maxButtons) {
		startPage = Math.max(1, endPage - maxButtons + 1);
	}
	for (let p = startPage; p <= endPage; p++) {
		paginationButtons.push(p);
	}

	return (
		<main className='min-h-screen bg-linear-to-br from-[#071021] via-[#07172a] to-[#001018] text-slate-100 p-8'>
			<div className='max-w-7xl mx-auto'>
				<div className='mb-8'>
					<div className='flex items-center justify-between mb-4'>
						<h1 className='text-4xl font-bold text-cyan-300'>
							{t("gamesTitle")}
						</h1>
						<div className='flex gap-3 items-center'>
							<input
								value={query}
								onChange={(e) => {
									setQuery(e.target.value);
									setPage(1);
								}}
								placeholder={t("searchPlaceholder")}
								className='input-hi w-72'
							/>
						</div>
					</div>

					{/* Genre Filters */}
					<div className='mb-4 flex gap-2 flex-wrap'>
						<button
							onClick={() => {
								setSelectedGenre("");
								setPage(1);
							}}
							className={`px-4 py-2 rounded text-sm font-medium transition ${
								selectedGenre === ""
									? "bg-cyan-600 text-white"
									: "bg-white/10 text-slate-300 hover:bg-white/20"
							}`}>
							All Genres
						</button>
						{Object.keys(GENRE_KEYWORDS).map((genre) => (
							<button
								key={genre}
								onClick={() => {
									setSelectedGenre(genre);
									setPage(1);
								}}
								className={`px-4 py-2 rounded text-sm font-medium transition ${
									selectedGenre === genre
										? "bg-cyan-600 text-white"
										: "bg-white/10 text-slate-300 hover:bg-white/20"
								}`}>
								{genre}
							</button>
						))}
					</div>

					{/* Show All / Limited toggle */}
					<div className='mb-4 flex gap-2 items-center'>
						<label className='text-sm text-slate-400'>
							<input
								type='checkbox'
								checked={showAll}
								onChange={(e) => {
									setShowAll(e.target.checked);
									setPage(1);
								}}
								className='mr-2'
							/>
							Show All Games ({apps.length} total)
						</label>
					</div>

					<p className='text-slate-400 mt-2'>
						{showAll ? "Showing all" : "Showing first 30"} (
						{total.toLocaleString()} after filters)
					</p>
				</div>

				{loading ? (
					<div className='flex flex-col items-center justify-center h-56 gap-4'>
						<div className='text-cyan-300 animate-pulse text-lg font-semibold'>
							{t("loadingGames")}
						</div>
						<div className='w-10 h-10 border-3 border-cyan-300/30 border-t-cyan-300 rounded-full animate-spin' />
					</div>
				) : apps.length === 0 ? (
					<div className='card-tech p-12 text-center'>
						<p className='text-slate-300 text-lg mb-2'>No games found.</p>
						<p className='text-slate-400 text-sm'>
							Try checking your connection or search for specific games.
						</p>
					</div>
				) : (
					<>
						<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4'>
							{pageItems.map((g) => {
								const det = detailsMap[String(g.appid)];
								return (
									<Link
										key={g.appid}
										href={`/games/${g.appid}`}
										className='group block rounded-xl overflow-hidden card-tech p-3 hover:scale-[1.02] transform transition shadow-xl'>
										<div className='h-28 w-full bg-[#021a22] rounded-md flex items-center justify-center text-slate-400 text-sm'>
											{det && det.header_image ? (
												<img
													src={det.header_image}
													alt={g.name}
													className='w-full h-28 object-cover rounded-md'
												/>
											) : (
												<div className='text-center px-2'>
													<div className='font-semibold text-sm text-slate-100 line-clamp-2'>
														{g.name}
													</div>
												</div>
											)}
										</div>
										<div className='mt-3 flex items-center justify-between'>
											<div className='text-xs text-slate-400 truncate w-36'>
												{g.name}
											</div>
											<div className='text-xs text-cyan-300'>
												{det && det.price_overview
													? det.price_overview.final_formatted
													: det && det.is_free
													? "Free"
													: ""}
											</div>
										</div>
									</Link>
								);
							})}
						</div>

						<div className='mt-6 flex items-center justify-center gap-2'>
							<button
								onClick={() => setPage(Math.max(1, page - 1))}
								disabled={page <= 1}
								className='px-3 py-2 rounded bg-white/6 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed'>
								← Prev
							</button>

							{startPage > 1 && (
								<>
									<button
										onClick={() => setPage(1)}
										className='px-3 py-2 rounded bg-white/10 hover:bg-white/20'>
										1
									</button>
									{startPage > 2 && <span className='text-slate-400'>...</span>}
								</>
							)}

							{paginationButtons.map((p) => (
								<button
									key={p}
									onClick={() => setPage(p)}
									className={`px-3 py-2 rounded font-medium transition ${
										page === p
											? "bg-cyan-600 text-white"
											: "bg-white/10 text-slate-300 hover:bg-white/20"
									}`}>
									{p}
								</button>
							))}

							{endPage < totalPages && (
								<>
									{endPage < totalPages - 1 && (
										<span className='text-slate-400'>...</span>
									)}
									<button
										onClick={() => setPage(totalPages)}
										className='px-3 py-2 rounded bg-white/10 hover:bg-white/20'>
										{totalPages}
									</button>
								</>
							)}

							<button
								onClick={() => setPage(Math.min(totalPages, page + 1))}
								disabled={page >= totalPages}
								className='px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed'>
								Next →
							</button>
						</div>

						<div className='mt-4 text-center text-sm text-slate-400'>
							{t("pageInfo", { page, totalPages, total })}
						</div>
					</>
				)}
			</div>
		</main>
	);
}
