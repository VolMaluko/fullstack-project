/** @format */

"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import { jwtDecode } from "jwt-decode";
import Link from "next/link";

type Comment = {
	id: string;
	content: string;
	rating?: number | null;
	createdAt: string;
	user: { id: string; name?: string } | null;
};

function LoginModal({
	isOpen,
	onClose,
}: {
	isOpen: boolean;
	onClose: () => void;
}) {
	if (!isOpen) return null;
	return (
		<div className='fixed inset-0 bg-black/70 flex items-center justify-center z-50'>
			<div className='bg-[#021018] border border-white/10 rounded-xl p-8 max-w-sm w-full mx-4 text-slate-100'>
				<h2 className='text-2xl font-bold text-cyan-300 mb-4'>
					Sign in required
				</h2>
				<p className='text-slate-300 mb-6'>
					You need to be signed in to post a review or rate this game.
				</p>
				<div className='flex gap-3 mb-3'>
					<Link
						href='/login'
						className='flex-1 text-center px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold'>
						Login
					</Link>
					<Link
						href='/register'
						className='flex-1 text-center px-4 py-2 rounded bg-white/10 hover:bg-white/20 font-semibold'>
						Register
					</Link>
				</div>
				<button
					onClick={onClose}
					className='w-full px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-slate-300'>
					Continue as guest
				</button>
			</div>
		</div>
	);
}

export default function GameDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const [game, setGame] = useState<any>(null);
	const [steam, setSteam] = useState<any>(null);
	const [comments, setComments] = useState<Comment[]>([]);
	const [content, setContent] = useState("");
	const [rating, setRating] = useState<number | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
	const [loginModalOpen, setLoginModalOpen] = useState(false);
	const [screenshotIndex, setScreenshotIndex] = useState(0);

	useEffect(() => {
		const t = localStorage.getItem("auth_token");
		if (t) {
			setToken(t);
			try {
				const decoded: any = jwtDecode(t);
				setUser({ id: decoded.id, email: decoded.email });
			} catch (err) {
				console.warn("Invalid token", err);
			}
		}
	}, []);

	useEffect(() => {
		// Use server endpoints that understand Steam AppID
		fetch(`http://localhost:3001/games/steam/${id}`)
			.then((r) => r.json())
			.then((g) => {
				setGame(g.game || null);
				// fetch comments separately
				fetch(`http://localhost:3001/games/steam/${id}/comments`)
					.then((r) => r.json())
					.then((c) => {
						if (Array.isArray(c)) {
							setComments(c);
						} else {
							setComments([]);
						}
					})
					.catch((err) => {
						console.error("Error fetching comments:", err);
						setComments([]);
					});

				// use steam detail returned in `g.detail` if available
				if (g && g.detail) {
					setSteam(g.detail);
				} else if (g && g.game && g.game.steamAppId) {
					// fallback: try server steam appdetails proxy
					fetch(
						`http://localhost:3001/steam/appdetails?appids=${g.game.steamAppId}`
					)
						.then((r) => r.json())
						.then((js) => {
							const dat =
								js && js[g.game.steamAppId] ? js[g.game.steamAppId] : null;
							setSteam(dat || null);
						})
						.catch(console.error);
				}
			})
			.catch(console.error);
	}, [id]);

	async function submitComment(e: React.FormEvent) {
		e.preventDefault();
		if (!token) {
			setLoginModalOpen(true);
			return;
		}
		const res = await fetch(
			`http://localhost:3001/games/steam/${id}/comments`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ content, rating }),
			}
		);
		if (!res.ok) {
			alert("Failed to post comment");
			return;
		}
		const c = await res.json();
		// fetch user info for the comment
		setComments((s) => [c, ...s]);
		setContent("");
		setRating(null);
	}

	const priceOverview =
		steam && steam.price_overview ? steam.price_overview : null;
	const screenshots =
		steam?.screenshots && Array.isArray(steam.screenshots)
			? steam.screenshots
			: [];

	return (
		<main className='min-h-screen bg-linear-to-br from-[#071021] via-[#07172a] to-[#001018] text-slate-100'>
			{game ? (
				<div>
					{/* Banner */}
					<div
						className='w-full h-64 bg-contain bg-center relative flex items-end'
						style={{
							backgroundImage: `url(${
								steam?.header_image || game.image || ""
							})`,
						}}>
						<div className='w-full bg-linear-to-t from-[#001018]/90 to-transparent p-6'>
							<div className='max-w-6xl mx-auto flex items-end justify-between'>
								<div>
									<h1 className='text-4xl font-bold text-white'>{game.name}</h1>
									<div className='text-sm text-slate-300 mt-1'>
										{steam?.short_description || ""}
									</div>
								</div>
								<div className='text-right text-sm text-slate-300 opacity-90'>
									<div>Released: {steam?.release_date?.date || "—"}</div>
									<div>
										Platform:{" "}
										{steam?.platforms
											? Object.keys(steam.platforms).join(", ")
											: "PC"}
									</div>
								</div>
							</div>
						</div>
					</div>

					<div className='max-w-6xl mx-auto p-6 grid grid-cols-12 gap-6'>
						{/* Left: images + about */}
						<div className='col-span-12 lg:col-span-8 space-y-6'>
							{/* Images carousel */}
							<div className='relative bg-[#011018] rounded-lg overflow-hidden'>
								{screenshots.length > 0 ? (
									<>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={screenshots[screenshotIndex]?.path_full}
											alt={`screenshot-${screenshotIndex}`}
											className='w-full h-96 object-cover'
										/>
										{/* Navigation buttons */}
										<button
											onClick={() =>
												setScreenshotIndex(
													(screenshotIndex - 1 + screenshots.length) %
														screenshots.length
												)
											}
											className='absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-2 rounded-full transition'>
											←
										</button>
										<button
											onClick={() =>
												setScreenshotIndex(
													(screenshotIndex + 1) % screenshots.length
												)
											}
											className='absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-2 rounded-full transition'>
											→
										</button>
										{/* Thumbnail indicators */}
										<div className='absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2'>
											{screenshots.slice(0, 5).map((s: any, i: number) => (
												<button
													key={i}
													onClick={() => setScreenshotIndex(i)}
													className={`w-12 h-8 rounded overflow-hidden transition ${
														i === screenshotIndex
															? "ring-2 ring-cyan-400"
															: "opacity-60"
													}`}>
													{/* eslint-disable-next-line @next/next/no-img-element */}
													<img
														src={s.path_full}
														alt={`thumb-${i}`}
														className='w-full h-full object-cover'
													/>
												</button>
											))}
										</div>
									</>
								) : (
									<div className='w-full h-96 bg-[#04202a] flex items-center justify-center text-slate-400'>
										No screenshots available
									</div>
								)}
							</div>

							{/* About / Description */}
							<section className='p-4 rounded-2xl bg-white/5 border border-white/10'>
								<h2 className='text-xl font-semibold text-cyan-300 mb-2'>
									About this game
								</h2>
								<div className='prose prose-invert max-w-none text-slate-200'>
									<div
										dangerouslySetInnerHTML={{
											__html:
												steam?.detailed_description ||
												steam?.about_the_game ||
												"<p>No description available.</p>",
										}}
									/>
								</div>
							</section>

							{/* Comments */}
							<section>
								<h3 className='text-lg font-semibold text-cyan-300 mb-2'>
									Community Reviews
								</h3>
								{token ? (
									<form onSubmit={submitComment} className='grid gap-3 mb-4'>
										<div className='flex items-center gap-3'>
											<div className='flex items-center'>
												{[1, 2, 3, 4, 5].map((s) => (
													<button
														key={s}
														type='button'
														onClick={() => setRating(s)}
														className={`px-2 ${
															rating && rating >= s
																? "text-yellow-400"
																: "text-slate-400"
														}`}>
														★
													</button>
												))}
											</div>
											<textarea
												value={content}
												onChange={(e) => setContent(e.target.value)}
												placeholder='Write a comment...'
												className='flex-1 p-3 rounded bg-[#04121a] text-slate-100'
											/>
										</div>
										<div className='flex gap-2'>
											<button
												type='submit'
												className='px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500'>
												Post review
											</button>
											<a
												className='px-4 py-2 rounded bg-white/10 hover:bg-white/20'
												href={`/profile/${user?.id}`}>
												Profile
											</a>
										</div>
									</form>
								) : (
									<div className='p-4 rounded bg-white/5 text-center'>
										<div className='text-slate-300 mb-2'>
											Login to post a review or rating.
										</div>
										<button
											onClick={() => setLoginModalOpen(true)}
											className='px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500'>
											Sign in
										</button>
									</div>
								)}
								<div className='space-y-3 mt-6'>
									{Array.isArray(comments) && comments.length > 0 ? (
										comments.map((c) => (
											<div
												key={c.id}
												className='p-3 rounded bg-[#021018] border border-white/6'>
												<div className='flex items-center justify-between'>
													<div className='text-sm text-slate-300'>
														{c.user?.name || "User"}
													</div>
													<div className='text-xs text-slate-400'>
														{new Date(c.createdAt).toLocaleString()}
													</div>
												</div>
												<div className='mt-2 text-slate-100'>{c.content}</div>
												{c.rating != null && (
													<div className='mt-1 text-yellow-400'>
														Rating: {c.rating} / 5
													</div>
												)}
											</div>
										))
									) : (
										<div className='text-slate-400 text-center py-4'>
											No comments yet. Be the first to review!
										</div>
									)}
								</div>
							</section>
						</div>

						{/* Right: purchase box / details */}
						<aside className='col-span-12 lg:col-span-4'>
							<div className='p-4 rounded-2xl bg-white/3 border border-white/6 space-y-4'>
								<div className='text-sm text-slate-400'>Price</div>
								<div className='text-2xl font-bold'>
									{priceOverview ? (
										priceOverview.final_formatted ||
										`${(priceOverview.final / 100).toFixed(2)} ${
											priceOverview.currency
										}`
									) : (
										<span className='text-slate-400'>Free / N/A</span>
									)}
								</div>
								<a
									href={
										steam?.steam_appid
											? `https://store.steampowered.com/app/${steam.steam_appid}`
											: "#"
									}
									target='_blank'
									rel='noreferrer'
									className='block text-center px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500'>
									View on Steam
								</a>

								<div>
									<div className='text-sm font-semibold text-cyan-300'>
										System Requirements
									</div>
									<div className='text-xs text-slate-400 mt-2 max-h-40 overflow-auto'>
										<div
											dangerouslySetInnerHTML={{
												__html:
													steam?.pc_requirements?.minimum || "<p>No info</p>",
											}}
										/>
									</div>
								</div>

								<div>
									<div className='text-sm font-semibold text-cyan-300'>
										Platforms
									</div>
									<div className='text-xs text-slate-300 mt-1'>
										{steam?.platforms
											? Object.entries(steam.platforms)
													.filter(([k, v]) => v)
													.map(([k]) => k)
													.join(", ")
											: "PC"}
									</div>
								</div>
							</div>
						</aside>
					</div>
				</div>
			) : (
				<div className='min-h-screen bg-linear-to-br from-[#071021] via-[#07172a] to-[#001018] text-slate-100'>
					<div className='max-w-6xl mx-auto p-6 grid grid-cols-12 gap-6'>
						{/* Left: images + about */}
						<div className='col-span-12 lg:col-span-8 space-y-6'>
							{/* Banner skeleton */}
							<div className='w-full h-64 bg-[#021a22] rounded-lg animate-pulse mb-6' />
							{/* Gallery skeleton */}
							<div className='grid grid-cols-3 gap-2 mb-6'>
								{[...Array(3)].map((_, i) => (
									<div
										key={i}
										className='h-36 bg-[#04202a] rounded animate-pulse'
									/>
								))}
							</div>
							{/* Info skeleton */}
							<div className='p-4 rounded-2xl bg-white/5 border border-white/10 mb-6'>
								<div className='h-6 w-1/2 bg-cyan-900/30 rounded mb-2 animate-pulse' />
								<div className='h-4 w-3/4 bg-cyan-900/20 rounded mb-2 animate-pulse' />
								<div className='h-4 w-1/3 bg-cyan-900/10 rounded animate-pulse' />
							</div>
							{/* Comments skeleton */}
							<div className='space-y-4'>
								{[...Array(2)].map((_, i) => (
									<div
										key={i}
										className='p-3 rounded bg-[#021018] border border-white/6 animate-pulse'>
										<div className='h-4 w-1/4 bg-cyan-900/20 rounded mb-2' />
										<div className='h-3 w-1/2 bg-cyan-900/10 rounded mb-2' />
										<div className='h-4 w-full bg-cyan-900/10 rounded' />
									</div>
								))}
							</div>
						</div>
						{/* Right: purchase box / details skeleton */}
						<aside className='col-span-12 lg:col-span-4'>
							<div className='p-4 rounded-2xl bg-white/3 border border-white/6 space-y-4'>
								<div className='h-6 w-1/2 bg-cyan-900/20 rounded mb-2 animate-pulse' />
								<div className='h-8 w-3/4 bg-cyan-900/10 rounded mb-2 animate-pulse' />
								<div className='h-4 w-1/3 bg-cyan-900/10 rounded animate-pulse' />
							</div>
						</aside>
					</div>
				</div>
			)}
			<LoginModal
				isOpen={loginModalOpen}
				onClose={() => setLoginModalOpen(false)}
			/>
		</main>
	);
}
