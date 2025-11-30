/** @format */

"use client";

import React, { useEffect, useState } from "react";
import { useI18n } from "../lib/i18n";

export default function GameDetailClient({ appid }: { appid: string }) {
	const { t } = useI18n();
	const [loading, setLoading] = useState(true);
	const [game, setGame] = useState<any>(null);
	const [detail, setDetail] = useState<any>(null);
	const [comments, setComments] = useState<any[]>([]);
	const [likes, setLikes] = useState({ count: 0, likedByUser: false });
	const [newComment, setNewComment] = useState("");
	const [rating, setRating] = useState<number | null>(null);
	const [submitting, setSubmitting] = useState(false);

	useEffect(() => {
		window.scrollTo(0, 0);
		if ("scrollRestoration" in window.history) {
			window.history.scrollRestoration = "manual";
		}
	}, []);

	useEffect(() => {
		let mounted = true;
		async function load() {
			setLoading(true);
			try {
				const res = await fetch(`/games/steam/${appid}`);
				const json = await res.json();
				if (!mounted) return;
				setGame(json.game || null);
				setDetail(json.detail || null);

				// fetch comments
				const cRes = await fetch(`/games/steam/${appid}/comments`);
				if (cRes.ok) {
					const cj = await cRes.json();
					if (mounted) setComments(cj || []);
				}

				// likes
				const lRes = await fetch(`/games/steam/${appid}/likes`);
				if (lRes.ok) {
					const lj = await lRes.json();
					if (mounted) setLikes(lj || { count: 0, likedByUser: false });
				}
			} catch (e) {
				console.error(e);
			} finally {
				if (mounted) setLoading(false);
			}
		}
		load();
		return () => {
			mounted = false;
		};
	}, [appid]);

	const submitComment = async () => {
		const token = localStorage.getItem("token");
		if (!token) return alert(t("loginRequired") || "Please login to comment");
		if (!newComment || newComment.trim().length === 0) return;
		setSubmitting(true);
		try {
			const res = await fetch(`/games/steam/${appid}/comments`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ content: newComment, rating }),
			});
			if (res.ok) {
				const created = await res.json();
				setComments((c) => [created, ...c]);
				setNewComment("");
				setRating(null);
			} else {
				const err = await res.json();
				alert(err && err.error ? err.error : "Failed to post");
			}
		} catch (e) {
			console.error(e);
		} finally {
			setSubmitting(false);
		}
	};

	const toggleLike = async () => {
		const token = localStorage.getItem("token");
		if (!token) return alert(t("loginRequired") || "Please login to like");
		try {
			const res = await fetch(`/games/steam/${appid}/likes`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.ok) {
				const j = await res.json();
				setLikes({ count: j.count, likedByUser: j.action === "liked" });
			}
		} catch (e) {
			console.error(e);
		}
	};

	return (
		<main className='min-h-screen bg-linear-to-br from-[#071021] via-[#07172a] to-[#001018] text-slate-100 p-6'>
			<div className='max-w-4xl mx-auto'>
				{loading ? (
					<div className='p-6'>{t("loading") || "Loading..."}</div>
				) : (
					<>
						<div className='mb-6'>
							<div className='flex gap-4 items-start'>
								<div className='w-48 h-24 bg-[#021a22] rounded overflow-hidden'>
									{detail && detail.header_image ? (
										<img
											src={detail.header_image}
											alt={detail.name}
											className='w-full h-full object-cover'
										/>
									) : (
										<div className='p-3 text-sm'>
											{game ? game.name : "No image"}
										</div>
									)}
								</div>
								<div>
									<h1 className='text-3xl font-bold text-cyan-300'>
										{(detail && detail.name) ||
											(game && game.name) ||
											`App ${appid}`}
									</h1>
									<div className='mt-2 text-sm text-slate-400'>
										{t("developer")}: {(detail && detail.developer) || "-"}
									</div>
									<div className='mt-2 flex items-center gap-3'>
										<button
											onClick={toggleLike}
											className='px-3 py-1 rounded bg-cyan-600'>
											{likes.likedByUser
												? t("unlike") || "Unlike"
												: t("like") || "Like"}{" "}
											({likes.count})
										</button>
										<div className='text-sm text-slate-300'>
											{detail && detail.price_overview
												? detail.price_overview.final_formatted
												: detail && detail.is_free
												? t("free")
												: ""}
										</div>
									</div>
								</div>
							</div>

							{detail &&
								detail.screenshots &&
								detail.screenshots.length > 0 && (
									<div className='mt-4 grid grid-cols-3 gap-2'>
										{detail.screenshots
											.slice(0, 6)
											.map((s: any, idx: number) => (
												<img
													key={idx}
													src={s.path_full}
													className='w-full h-36 object-cover rounded'
												/>
											))}
									</div>
								)}
						</div>

						<div className='card-tech p-4 mb-6'>
							<h2 className='text-xl font-semibold mb-2'>
								{t("reviewsHeading") || "Community Reviews"}
							</h2>
							<div className='mb-4'>
								<textarea
									value={newComment}
									onChange={(e) => setNewComment(e.target.value)}
									placeholder={
										t("writeReviewPlaceholder") || "Write your review..."
									}
									className='w-full p-3 bg-[#03171c] rounded text-sm'
								/>
								<div className='mt-2 flex items-center gap-2'>
									<select
										value={rating ?? ""}
										onChange={(e) =>
											setRating(e.target.value ? Number(e.target.value) : null)
										}
										className='bg-[#03171c] p-2 rounded text-sm'>
										<option value=''>{t("rating") || "Rating"}</option>
										<option value='5'>5</option>
										<option value='4'>4</option>
										<option value='3'>3</option>
										<option value='2'>2</option>
										<option value='1'>1</option>
									</select>
									<button
										onClick={submitComment}
										disabled={submitting}
										className='px-3 py-2 bg-cyan-600 rounded'>
										{t("submit") || "Submit"}
									</button>
								</div>
							</div>

							<div className='space-y-4'>
								{comments.map((c) => (
									<div key={c.id} className='p-3 bg-[#021a22] rounded'>
										<div className='text-sm font-semibold'>
											{c.user ? c.user.name : c.userId}
										</div>
										<div className='text-xs text-slate-400'>
											{new Date(c.createdAt).toLocaleString()}
										</div>
										<div className='mt-2 text-sm'>{c.content}</div>
									</div>
								))}
							</div>
						</div>
					</>
				)}
			</div>
		</main>
	);
}
