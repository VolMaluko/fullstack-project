/** @format */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../../lib/i18n";
import Link from "next/link";

interface Game {
	name: string;
	header_image: string;
	steam_appid: number;
}

interface User {
	id: string;
	displayName: string;
	avatarUrl?: string;
}

export default function DashboardPage() {
	const router = useRouter();
	const { t } = useI18n();
	const [user, setUser] = useState<User | null>(null);
	const [stats, setStats] = useState({
		played: 0,
		wishlist: 0,
		recommendations: 0,
	});
	const [games, setGames] = useState<{ played: Game[]; wishlist: Game[] }>({
		played: [],
		wishlist: [],
	});
	const [loading, setLoading] = useState(true);

	// Scroll to top on mount
	useEffect(() => {
		window.scrollTo(0, 0);
		if ("scrollRestoration" in window.history) {
			window.history.scrollRestoration = "manual";
		}
	}, []);

	useEffect(() => {
		const token = localStorage.getItem("auth_token");
		if (!token) {
			router.push("/login");
			return;
		}

		const userId = localStorage.getItem("user_id");
		const userName = localStorage.getItem("user_name");

		if (userId && userName) {
			setUser({ id: userId, displayName: userName });
		}

		fetchDashboardData();
	}, []);

	const fetchDashboardData = async () => {
		const token = localStorage.getItem("auth_token");
		if (!token) return;

		try {
			// Fetch user games
			const gamesResponse = await fetch("http://localhost:3001/me/games", {
				headers: { Authorization: `Bearer ${token}` },
			});

			if (!gamesResponse.ok) throw new Error("Failed to fetch games");

			const gamesData = await gamesResponse.json();

			// Update stats
			setStats({
				played: gamesData.played?.length || 0,
				wishlist: gamesData.wishlist?.length || 0,
				recommendations: 0, // TODO: get actual count
			});

			// Fetch game details for display
			if (gamesData.played?.length > 0) {
				const playedResponse = await fetch(
					`http://localhost:3001/steam/appdetails?appids=${gamesData.played
						.slice(0, 4)
						.join(",")}`
				);
				if (playedResponse.ok) {
					const playedData = await playedResponse.json();
					const gamesList = Object.values(playedData)
						.filter((g: any) => g?.data)
						.map((g: any) => g.data);
					setGames((prev) => ({ ...prev, played: gamesList }));
				}
			}

			if (gamesData.wishlist?.length > 0) {
				const wishResponse = await fetch(
					`http://localhost:3001/steam/appdetails?appids=${gamesData.wishlist
						.slice(0, 4)
						.join(",")}`
				);
				if (wishResponse.ok) {
					const wishData = await wishResponse.json();
					const gamesList = Object.values(wishData)
						.filter((g: any) => g?.data)
						.map((g: any) => g.data);
					setGames((prev) => ({ ...prev, wishlist: gamesList }));
				}
			}
		} catch (err) {
			console.error("Error fetching dashboard data:", err);
		} finally {
			setLoading(false);
		}
	};

	const handleLogout = () => {
		localStorage.removeItem("auth_token");
		localStorage.removeItem("user_id");
		localStorage.removeItem("user_name");
		router.push("/login");
	};

	if (loading) {
		return (
			<div className='min-h-screen flex items-center justify-center'>
				<div className='text-cyan-300'>{t("loadingGames")}</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gradient-to-b from-[#000814] via-[#001d2a] to-[#000814] px-4 py-8'>
			<div className='max-w-6xl mx-auto space-y-8'>
				{/* Welcome Header */}
				<div className='card-tech p-8'>
					<div className='flex items-center justify-between'>
						<div>
							<h1 className='text-4xl font-bold text-cyan-300 mb-2'>
								{t("dashboard")}
							</h1>
							<p className='text-slate-400'>
								Welcome back,{" "}
								<span className='text-cyan-300'>{user?.displayName}</span>!
							</p>
						</div>
						<button
							onClick={handleLogout}
							className='btn-hi bg-red-600 text-white hover:bg-red-700'>
							{t("logout")}
						</button>
					</div>
				</div>

				{/* Stats Grid */}
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
					<div className='card-tech p-6 text-center'>
						<div className='text-3xl font-bold text-cyan-300 mb-2'>
							{stats.played}
						</div>
						<div className='text-slate-400'>{t("played")}</div>
					</div>
					<div className='card-tech p-6 text-center'>
						<div className='text-3xl font-bold text-cyan-300 mb-2'>
							{stats.wishlist}
						</div>
						<div className='text-slate-400'>{t("wishlist")}</div>
					</div>
					<div className='card-tech p-6 text-center'>
						<div className='text-3xl font-bold text-cyan-300 mb-2'>
							{stats.recommendations}
						</div>
						<div className='text-slate-400'>{t("recommendations")}</div>
					</div>
				</div>

				{/* Games Overview */}
				<div className='space-y-6'>
					{/* Recently Played */}
					<div className='card-tech p-6'>
						<div className='flex items-center justify-between mb-4'>
							<h2 className='text-2xl font-bold text-cyan-300'>
								{t("played")}
							</h2>
							<Link
								href='/profile'
								className='text-cyan-400 hover:text-cyan-300 text-sm'>
								View All →
							</Link>
						</div>
						{games.played.length > 0 ? (
							<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'>
								{games.played.map((game: any) => (
									<div
										key={game.steam_appid}
										className='group relative overflow-hidden rounded-lg cursor-pointer'>
										<img
											src={game.header_image}
											alt={game.name}
											className='w-full h-32 object-cover group-hover:scale-110 transition duration-300'
										/>
										<div className='absolute inset-0 bg-black/50 group-hover:bg-black/70 transition flex items-end'>
											<p className='text-xs text-white p-2 line-clamp-2'>
												{game.name}
											</p>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className='text-center py-8 text-slate-400'>
								{t("noGamesFound")}. Go to{" "}
								<Link
									href='/games'
									className='text-cyan-400 hover:text-cyan-300'>
									Games
								</Link>{" "}
								to add some!
							</div>
						)}
					</div>

					{/* Wishlist */}
					<div className='card-tech p-6'>
						<div className='flex items-center justify-between mb-4'>
							<h2 className='text-2xl font-bold text-cyan-300'>
								{t("wishlist")}
							</h2>
							<Link
								href='/profile'
								className='text-cyan-400 hover:text-cyan-300 text-sm'>
								View All →
							</Link>
						</div>
						{games.wishlist.length > 0 ? (
							<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'>
								{games.wishlist.map((game: any) => (
									<div
										key={game.steam_appid}
										className='group relative overflow-hidden rounded-lg cursor-pointer'>
										<img
											src={game.header_image}
											alt={game.name}
											className='w-full h-32 object-cover group-hover:scale-110 transition duration-300'
										/>
										<div className='absolute inset-0 bg-black/50 group-hover:bg-black/70 transition flex items-end'>
											<p className='text-xs text-white p-2 line-clamp-2'>
												{game.name}
											</p>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className='text-center py-8 text-slate-400'>
								{t("noGamesFound")}. Go to{" "}
								<Link
									href='/games'
									className='text-cyan-400 hover:text-cyan-300'>
									Games
								</Link>{" "}
								to add some!
							</div>
						)}
					</div>
				</div>

				{/* Quick Actions */}
				<div className='card-tech p-6 space-y-4'>
					<h3 className='text-lg font-bold text-cyan-300'>Quick Actions</h3>
					<div className='flex gap-4 flex-wrap'>
						<Link href='/games' className='btn-hi bg-cyan-600 text-[#021018]'>
							{t("gamesTitle")}
						</Link>
						<Link
							href='/profile'
							className='btn-hi bg-slate-700 text-white hover:bg-slate-600'>
							{t("profile")}
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
