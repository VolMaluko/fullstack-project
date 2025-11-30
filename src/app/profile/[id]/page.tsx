/** @format */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Profile {
	id: string;
	email: string;
	name: string;
	displayName: string;
	bio: string;
	avatarUrl: string;
	backgroundUrl: string;
	theme: string;
	showBadges: boolean;
	customSections: any[];
}

export default function ProfilePage() {
	const params = useParams();
	const userId = params?.id as string;
	const [profile, setProfile] = useState<Profile | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!userId) return;
		fetch(`http://localhost:3000/profiles/${userId}`)
			.then((res) => {
				if (!res.ok) throw new Error("Failed to fetch profile");
				return res.json();
			})
			.then(setProfile)
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, [userId]);

	if (loading) {
		return (
			<main className='min-h-screen bg-gradient-to-br from-[#071021] via-[#07172a] to-[#001018] flex items-center justify-center text-slate-100'>
				<div>Loading profile...</div>
			</main>
		);
	}

	if (error || !profile) {
		return (
			<main className='min-h-screen bg-gradient-to-br from-[#071021] via-[#07172a] to-[#001018] flex items-center justify-center text-slate-100'>
				<div className='text-red-400'>{error || "Profile not found"}</div>
			</main>
		);
	}

	const bgColor =
		profile.theme === "dark"
			? "from-[#0a0e27]"
			: profile.theme === "neon"
			? "from-[#1a0a2e]"
			: "from-[#071021]";
	const accentColor =
		profile.theme === "neon" ? "text-pink-400" : "text-cyan-300";

	return (
		<main className='min-h-screen bg-gradient-to-br from-[#071021] via-[#07172a] to-[#001018] text-slate-100'>
			{/* Background Banner */}
			<div className='relative h-64 w-full bg-linear-to-r from-purple-900/40 via-blue-900/40 to-cyan-900/40 overflow-hidden'>
				{profile.backgroundUrl && (
					<img
						src={profile.backgroundUrl}
						alt='Background'
						className='w-full h-full object-cover opacity-60'
					/>
				)}
				<div className='absolute inset-0 bg-linear-to-t from-[#071021] via-transparent to-transparent'></div>
			</div>

			{/* Profile Content */}
			<div className='max-w-5xl mx-auto px-4 -mt-32 relative z-10'>
				{/* Avatar + Header */}
				<div className='flex items-end gap-6 mb-8'>
					{/* Avatar */}
					<div className='w-48 h-48 rounded-3xl border-4 border-white/10 bg-linear-to-br from-white/5 to-transparent overflow-hidden shadow-2xl'>
						{profile.avatarUrl ? (
							<img
								src={profile.avatarUrl}
								alt='Avatar'
								className='w-full h-full object-cover'
							/>
						) : (
							<div className='w-full h-full bg-linear-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-4xl'>
								👤
							</div>
						)}
					</div>

					{/* Info */}
					<div className='flex-1 mb-4'>
						<h1 className={`text-4xl font-bold mb-2 ${accentColor}`}>
							{profile.displayName || profile.name || "Anonymous"}
						</h1>
						<p className='text-slate-400 text-lg mb-4'>{profile.email}</p>
						{profile.bio && (
							<p className='text-slate-300 text-base max-w-2xl'>
								{profile.bio}
							</p>
						)}

						{/* Quick Actions */}
						<div className='flex gap-3 mt-6'>
							<button className='px-6 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-semibold transition'>
								Add Friend
							</button>
							<button className='px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition border border-white/20'>
								Message
							</button>
						</div>
					</div>

					{/* Edit Button (if viewing own profile) */}
					<a
						href='/profile/edit'
						className='px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition border border-white/20 mb-4'>
						Edit Profile
					</a>
				</div>

				{/* Badges Section */}
				{profile.showBadges && (
					<div className='mb-8 p-6 rounded-2xl bg-white/5 border border-white/10'>
						<h2 className='text-xl font-semibold mb-4 text-cyan-300'>Badges</h2>
						<div className='flex flex-wrap gap-3'>
							<div className='px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-300 text-sm font-semibold'>
								🏆 Game Enthusiast
							</div>
							<div className='px-4 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-300 text-sm font-semibold'>
								⭐ Community Member
							</div>
							<div className='px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300 text-sm font-semibold'>
								✓ Verified
							</div>
						</div>
					</div>
				)}

				{/* Custom Sections */}
				{profile.customSections && profile.customSections.length > 0 && (
					<div className='space-y-6 mb-8'>
						{(profile.customSections as any[]).map(
							(section: any, idx: number) => (
								<div
									key={idx}
									className='p-6 rounded-2xl bg-white/5 border border-white/10'>
									<h3 className='text-lg font-semibold mb-3 text-cyan-300'>
										{section.title}
									</h3>
									<p className='text-slate-300 text-sm leading-relaxed'>
										{section.content}
									</p>
								</div>
							)
						)}
					</div>
				)}

				{/* Placeholder if no custom sections */}
				{(!profile.customSections || profile.customSections.length === 0) && (
					<div className='p-8 rounded-2xl bg-white/5 border border-white/10 text-center text-slate-400'>
						<p>No custom sections yet. Visit edit profile to add your own!</p>
					</div>
				)}
			</div>
		</main>
	);
}
