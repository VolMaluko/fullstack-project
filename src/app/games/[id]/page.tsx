/** @format */

"use client";

import { useEffect, useState } from "react";
// O use(params) não é recomendado para páginas dinâmicas client-side. Usaremos useParams() do next/navigation.
// import { use } from "react"; // Removido
import { jwtDecode } from "jwt-decode";
import Link from "next/link";
import { useParams } from "next/navigation"; // Importado para uso client-side

type Comment = {
	id: string;
	content: string;
	rating?: number | null;
	createdAt: string;
	user: { id: string; name?: string } | null;
};

type SteamDetails = {
	libraryHeroUrl?: string;
	appid: string;
	name: string;
	header_image: string;
	short_description: string;
	release_date: { date: string };
	platforms: Record<string, boolean>;
	detailed_description: string;
	about_the_game: string;
	price_overview?: { final_formatted: string };
	screenshots: { path_full: string }[];
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
export default function GameDetailPage() {
	const params = useParams();
	const id = params.id as string;

	const [steam, setSteam] = useState<SteamDetails | null>(null);
	const [loading, setLoading] = useState(true);
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
		if (!id) return;
		const fetchGameDetails = async () => {
			setLoading(true);
			try {
				const res = await fetch(`http://localhost:3001/steam/appdetails/${id}`);

				if (!res.ok) {
					throw new Error("Failed to fetch Steam app details from backend");
				}

				const data: SteamDetails = await res.json();
				setSteam(data);

				// Fetch comments after getting game details
				fetchComments();
			} catch (err) {
				console.error("Error fetching Steam app details:", err);
			} finally {
				setLoading(false);
			}
		};
		const fetchComments = async () => {
			try {
				const res = await fetch(
					`http://localhost:3001/games/steam/${id}/comments`
				);
				const c = await res.json();
				if (Array.isArray(c)) {
					setComments(c);
				} else {
					setComments([]);
				}
			} catch (err) {
				console.error("Error fetching comments:", err);
				setComments([]);
			}
		};

		fetchGameDetails();
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
		setComments((s) => [c, ...s]);
		setContent("");
		setRating(null);
	}

	const priceOverview = steam?.price_overview || null;
	const screenshots = steam?.screenshots || [];

	if (loading || !steam) {
		return (
			<div className='min-h-screen flex items-center justify-center'>
				Carregando detalhes do jogo...
			</div>
		);
	}

	return (
		<main className='min-h-screen bg-linear-to-br from-[#071021] via-[#07172a] to-[#001018] text-slate-100'>
			<div>
				{/* Banner */}
				<div
					className='w-full h-64 bg-auto bg-center relative flex items-end'
					style={{
						backgroundImage: ` url(${
							steam.libraryHeroUrl || steam.header_image
						})`,
					}}>
					<div className='w-full bg-linear-to-t from-[#001018]/90 to-transparent p-6'>
						<div className='max-w-6xl mx-auto flex items-end justify-between'>
							<div>
								<h1 className='text-4xl font-bold text-white'>{steam.name}</h1>
								<div className='text-sm text-slate-300 mt-1'>
									{steam.short_description || ""}
								</div>
							</div>
							<div className='text-right text-sm text-slate-300 opacity-90'>
								<div>Released: {steam.release_date?.date || "—"}</div>
								<div>
									Platform:{" "}
									{steam.platforms
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
						<div className='relative bg-[#011018] rounded-lg overflow-hidden'>
							{screenshots.length > 0 ? (
								<>
									<img
										src={screenshots[screenshotIndex]?.path_full}
										alt={`screenshot-${screenshotIndex}`}
										className='w-full h-96 object-cover'
									/>
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
						<section className='p-4 rounded-2xl bg-white/5 border border-white/10'>
							<h2 className='text-xl font-semibold text-cyan-300 mb-2'>
								About this game
							</h2>
							<div className='prose prose-invert max-w-none text-slate-200'>
								<div
									dangerouslySetInnerHTML={{
										__html:
											steam.detailed_description ||
											steam.about_the_game ||
											"<p>No description available.</p>",
									}}
								/>
							</div>
						</section>

						<section className='p-4 rounded-2xl bg-white/5 border border-white/10'>
							<h2 className='text-xl font-semibold text-cyan-300 mb-4'>
								User Reviews ({comments.length})
							</h2>

							<form onSubmit={submitComment} className='mb-6 space-y-3'>
								<textarea
									value={content}
									onChange={(e) => setContent(e.target.value)}
									placeholder='Write your review...'
									className='w-full p-3 rounded-lg bg-white/10 border border-white/10 focus:ring-cyan-500 focus:border-cyan-500 text-white'
									rows={4}
									required
								/>
								<div className='flex justify-between items-center'>
									<div className='flex items-center gap-2'></div>
									<button
										type='submit'
										className='px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-white font-semibold'>
										Post Review
									</button>
								</div>
							</form>

							<div className='space-y-4'>
								{comments.map((comment) => (
									<div
										key={comment.id}
										className='p-4 bg-white/5 rounded-lg border border-white/5'>
										<div className='flex justify-between items-center text-sm mb-2'>
											<span className='font-semibold text-cyan-300'>
												{comment.user?.name || comment.user?.id || "Anonymous"}
											</span>
											<span className='text-slate-500'>
												{new Date(comment.createdAt).toLocaleDateString()}
											</span>
										</div>
										<p className='text-slate-200'>{comment.content}</p>
									</div>
								))}
							</div>
						</section>
					</div>

					<div className='col-span-12 lg:col-span-4 space-y-6'>
						<div className='card-tech p-4 sticky top-6'>
							<div className='text-sm text-slate-400 mb-2'>
								Buy {steam.name}
							</div>
							<div className='flex justify-between items-center bg-white/5 p-3 rounded-lg'>
								<span className='text-xl font-bold'>
									{priceOverview?.final_formatted || "Free to Play"}
								</span>
								<a
									href={`store.steampowered.com{id}`}
									target='_blank'
									rel='noopener noreferrer'
									className='px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded text-white font-semibold transition'>
									Buy on Steam
								</a>
							</div>

							<div className='mt-4 text-sm text-slate-400'>
								<div>
									<span className='font-semibold text-white'>Developer:</span>{" "}
									{steam.developers?.[0] || "N/A"}
								</div>
								<div>
									<span className='font-semibold text-white'>Publisher:</span>{" "}
									{steam.publishers?.[0] || "N/A"}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<LoginModal
				isOpen={loginModalOpen}
				onClose={() => setLoginModalOpen(false)}
			/>
		</main>
	);
}
