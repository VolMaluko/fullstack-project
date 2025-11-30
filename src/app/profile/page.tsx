/** @format */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../../lib/i18n";

interface Game {
	name: string;
	header_image: string;
	steam_appid: number;
}

interface UserProfile {
	id: string;
	email: string;
	displayName: string;
	bio?: string;
	avatarUrl?: string;
	backgroundUrl?: string;
}

export default function ProfilePage() {
	const router = useRouter();
	const { t } = useI18n();
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [displayName, setDisplayName] = useState("");
	const [bio, setBio] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [playedGames, setPlayedGames] = useState<Game[]>([]);
	const [wishlistGames, setWishlistGames] = useState<Game[]>([]);
	const [tab, setTab] = useState<"profile" | "games">("profile");

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

		fetchProfile();
		fetchUserGames();
	}, []);

	const fetchProfile = async () => {
		const token = localStorage.getItem("auth_token");
		if (!token) return;

		try {
			// Use authenticated endpoint to get current user's profile
			const response = await fetch("http://localhost:3001/profiles/me", {
				headers: { Authorization: `Bearer ${token}` },
			});

			if (!response.ok) throw new Error("Failed to fetch profile");

			const data = await response.json();
			setProfile(data);
			setDisplayName(data.displayName || data.name || "");
			setBio(data.bio || "");
			// store quick access for navbar
			if (data.displayName || data.name) {
				localStorage.setItem("user_name", data.displayName || data.name);
			}
			if (data.avatarUrl) {
				localStorage.setItem("user_avatar", data.avatarUrl);
			}
		} catch (err) {
			setError("Error loading profile");
			console.error(err);
		} finally {
			setLoading(false);
		}
	};

	const fetchUserGames = async () => {
		const token = localStorage.getItem("auth_token");
		if (!token) return;

		try {
			const response = await fetch("http://localhost:3001/me/games", {
				headers: { Authorization: `Bearer ${token}` },
			});

			if (!response.ok) throw new Error("Failed to fetch games");

			const data = await response.json();

			// Fetch game details for the lists
			if (data.played?.length > 0) {
				const playedResponse = await fetch(
					`http://localhost:3001/steam/appdetails?appids=${data.played.join(
						","
					)}`
				);
				const playedData = await playedResponse.json();
				// Transform data structure
				const games = Object.values(playedData)
					.filter((g: any) => g?.data)
					.map((g: any) => g.data);
				setPlayedGames(games);
			}

			if (data.wishlist?.length > 0) {
				const wishlistResponse = await fetch(
					`http://localhost:3001/steam/appdetails?appids=${data.wishlist.join(
						","
					)}`
				);
				const wishlistData = await wishlistResponse.json();
				const games = Object.values(wishlistData)
					.filter((g: any) => g?.data)
					.map((g: any) => g.data);
				setWishlistGames(games);
			}
		} catch (err) {
			console.error("Error fetching user games:", err);
		}
	};

	const handleSaveProfile = async () => {
		const token = localStorage.getItem("auth_token");
		if (!token) return;

		setSaving(true);
		setError("");
		setSuccess("");

		try {
			const response = await fetch("http://localhost:3001/profiles", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ displayName, bio }),
			});

			if (!response.ok) throw new Error("Failed to save profile");

			const updated = await response.json();
			setProfile(updated);
			setSuccess("Profile updated successfully");
			setTimeout(() => setSuccess(""), 3000);
		} catch (err) {
			setError("Error saving profile");
			console.error(err);
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className='min-h-screen flex items-center justify-center'>
				<div className='text-cyan-300'>{t("loadingGames")}</div>
			</div>
		);
	}

	if (!profile) {
		return (
			<div className='min-h-screen flex items-center justify-center'>
				<div className='text-red-400'>Error loading profile</div>
			</div>
		);
	}

	return (
		<div className='min-h-screen bg-gradient-to-b from-[#000814] via-[#001d2a] to-[#000814] px-4 py-8'>
			<div className='max-w-4xl mx-auto'>
				{/* Tabs */}
				<div className='flex gap-4 mb-6 border-b border-slate-600'>
					<button
						onClick={() => setTab("profile")}
						className={`pb-3 font-semibold transition ${
							tab === "profile"
								? "text-cyan-300 border-b-2 border-cyan-300"
								: "text-slate-400 hover:text-cyan-300"
						}`}>
						{t("profile")}
					</button>
					<button
						onClick={() => setTab("games")}
						className={`pb-3 font-semibold transition ${
							tab === "games"
								? "text-cyan-300 border-b-2 border-cyan-300"
								: "text-slate-400 hover:text-cyan-300"
						}`}>
						{t("myGames")}
					</button>
				</div>

				{/* Profile Tab */}
				{tab === "profile" && (
					<div className='card-tech p-8 space-y-6'>
						{error && (
							<div className='bg-red-500/10 border border-red-500/30 rounded p-3 text-red-400'>
								{error}
							</div>
						)}

						{success && (
							<div className='bg-green-500/10 border border-green-500/30 rounded p-3 text-green-400'>
								{success}
							</div>
						)}

						<div className='space-y-4'>
							<div>
								<label className='block text-sm font-medium text-cyan-300 mb-2'>
									{t("email")}
								</label>
								<input
									type='email'
									value={profile.email}
									disabled
									className='input-hi w-full opacity-50 cursor-not-allowed'
								/>
								<p className='text-xs text-slate-400 mt-1'>
									Email cannot be changed
								</p>
							</div>

							<div>
								<label className='block text-sm font-medium text-cyan-300 mb-2'>
									{t("displayName")}
								</label>
								<input
									type='text'
									value={displayName}
									onChange={(e) => setDisplayName(e.target.value)}
									className='input-hi w-full'
									placeholder='Your gaming name'
								/>
							</div>

							<div>
								<label className='block text-sm font-medium text-cyan-300 mb-2'>
									Bio
								</label>
								<textarea
									value={bio}
									onChange={(e) => setBio(e.target.value)}
									className='input-hi w-full min-h-24 resize-none'
									placeholder='Tell other gamers about yourself...'
								/>
							</div>

							<button
								onClick={handleSaveProfile}
								disabled={saving}
								className='btn-hi bg-cyan-600 text-[#021018] font-semibold disabled:opacity-50 disabled:cursor-not-allowed'>
								{saving ? "Saving..." : "Save Profile"}
							</button>
						</div>
					</div>
				)}

				{/* Games Tab */}
				{tab === "games" && (
					<div className='space-y-8'>
						{/* Played Games */}
						<div>
							<h2 className='text-2xl font-bold text-cyan-300 mb-4'>
								{t("played")} ({playedGames.length})
							</h2>
							{playedGames.length > 0 ? (
								<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'>
									{playedGames.map((game: any) => (
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
									{t("noGamesFound")}
								</div>
							)}
						</div>

						{/* Wishlist Games */}
						<div>
							<h2 className='text-2xl font-bold text-cyan-300 mb-4'>
								{t("wishlist")} ({wishlistGames.length})
							</h2>
							{wishlistGames.length > 0 ? (
								<div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'>
									{wishlistGames.map((game: any) => (
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
									{t("noGamesFound")}
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
