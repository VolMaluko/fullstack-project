/** @format */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EditProfilePage() {
	const router = useRouter();
	const [token, setToken] = useState<string | null>(null);
	const [displayName, setDisplayName] = useState("");
	const [bio, setBio] = useState("");
	const [theme, setTheme] = useState("dark");
	const [showBadges, setShowBadges] = useState(true);
	const [customSections, setCustomSections] = useState<
		{ title: string; content: string }[]
	>([]);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const storedToken = localStorage.getItem("auth_token");
		if (!storedToken) {
			router.push("/login");
			return;
		}
		setToken(storedToken);
	}, [router]);

	const handleAddSection = () => {
		setCustomSections([...customSections, { title: "", content: "" }]);
	};

	const handleSectionChange = (
		idx: number,
		field: "title" | "content",
		value: string
	) => {
		const updated = [...customSections];
		updated[idx][field] = value;
		setCustomSections(updated);
	};

	const handleRemoveSection = (idx: number) => {
		setCustomSections(customSections.filter((_, i) => i !== idx));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!token) return;

		setLoading(true);
		setMessage(null);

		try {
			// Update profile metadata
			const metaRes = await fetch("http://localhost:3000/profiles", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					displayName,
					bio,
					theme,
					showBadges,
					customSections,
				}),
			});

			if (!metaRes.ok) throw new Error("Failed to update profile metadata");

			// Upload images if provided
			if (avatarFile || backgroundFile) {
				const formData = new FormData();
				if (avatarFile) formData.append("avatar", avatarFile);
				if (backgroundFile) formData.append("background", backgroundFile);

				const uploadRes = await fetch("http://localhost:3000/profiles/upload", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
					},
					body: formData,
				});

				if (!uploadRes.ok) throw new Error("Failed to upload images");
			}

			setMessage("Profile updated successfully!");
			setTimeout(() => {
				router.push(`/profile/${(metaRes as any).user?.id || "me"}`);
			}, 1500);
		} catch (err: any) {
			setMessage(err.message || "Error updating profile");
		} finally {
			setLoading(false);
		}
	};

	if (!token) {
		return (
			<main className='min-h-screen bg-linear-to-br from-[#071021] via-[#07172a] to-[#001018] flex items-center justify-center text-slate-100'>
				<div>Redirecting to login...</div>
			</main>
		);
	}

	return (
		<main className='min-h-screen bg-linear-to-br from-[#071021] via-[#07172a] to-[#001018] text-slate-100 py-12'>
			<div className='max-w-4xl mx-auto px-4'>
				<h1 className='text-3xl font-bold mb-8 text-cyan-300'>
					Edit Your Profile
				</h1>

				<form onSubmit={handleSubmit} className='space-y-8'>
					{/* Basic Info */}
					<div className='p-6 rounded-2xl bg-white/5 border border-white/10'>
						<h2 className='text-xl font-semibold mb-4 text-cyan-300'>
							Basic Information
						</h2>
						<div className='grid gap-4'>
							<label className='block'>
								<span className='text-slate-300 text-sm mb-2 block'>
									Display Name
								</span>
								<input
									type='text'
									value={displayName}
									onChange={(e) => setDisplayName(e.target.value)}
									placeholder='Your display name'
									className='w-full px-3 py-2 rounded-lg bg-[#04121a] border border-[#0f1724] focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-100'
								/>
							</label>
							<label className='block'>
								<span className='text-slate-300 text-sm mb-2 block'>Bio</span>
								<textarea
									value={bio}
									onChange={(e) => setBio(e.target.value)}
									placeholder='Tell people about yourself'
									rows={4}
									className='w-full px-3 py-2 rounded-lg bg-[#04121a] border border-[#0f1724] focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-100 resize-none'
								/>
							</label>
						</div>
					</div>

					{/* Theme & Settings */}
					<div className='p-6 rounded-2xl bg-white/5 border border-white/10'>
						<h2 className='text-xl font-semibold mb-4 text-cyan-300'>
							Theme & Settings
						</h2>
						<div className='grid gap-4'>
							<label className='block'>
								<span className='text-slate-300 text-sm mb-2 block'>Theme</span>
								<select
									value={theme}
									onChange={(e) => setTheme(e.target.value)}
									className='w-full px-3 py-2 rounded-lg bg-[#04121a] border border-[#0f1724] focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-100'>
									<option value='dark'>Dark (Default)</option>
									<option value='neon'>Neon</option>
									<option value='light'>Light</option>
								</select>
							</label>
							<label className='flex items-center gap-3'>
								<input
									type='checkbox'
									checked={showBadges}
									onChange={(e) => setShowBadges(e.target.checked)}
									className='w-4 h-4 rounded bg-[#04121a] border border-[#0f1724]'
								/>
								<span className='text-slate-300 text-sm'>Show Badges</span>
							</label>
						</div>
					</div>

					{/* Image Uploads */}
					<div className='p-6 rounded-2xl bg-white/5 border border-white/10'>
						<h2 className='text-xl font-semibold mb-4 text-cyan-300'>Images</h2>
						<div className='grid gap-4'>
							<label className='block'>
								<span className='text-slate-300 text-sm mb-2 block'>
									Avatar Image
								</span>
								<input
									type='file'
									accept='image/*'
									onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
									className='w-full px-3 py-2 rounded-lg bg-[#04121a] border border-[#0f1724] focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-100 text-sm'
								/>
							</label>
							<label className='block'>
								<span className='text-slate-300 text-sm mb-2 block'>
									Background Image
								</span>
								<input
									type='file'
									accept='image/*'
									onChange={(e) =>
										setBackgroundFile(e.target.files?.[0] || null)
									}
									className='w-full px-3 py-2 rounded-lg bg-[#04121a] border border-[#0f1724] focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-100 text-sm'
								/>
							</label>
						</div>
					</div>

					{/* Custom Sections */}
					<div className='p-6 rounded-2xl bg-white/5 border border-white/10'>
						<div className='flex items-center justify-between mb-4'>
							<h2 className='text-xl font-semibold text-cyan-300'>
								Custom Sections
							</h2>
							<button
								type='button'
								onClick={handleAddSection}
								className='px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm font-semibold transition'>
								+ Add Section
							</button>
						</div>

						{customSections.map((section, idx) => (
							<div
								key={idx}
								className='mb-4 p-4 bg-white/3 rounded-lg border border-white/5'>
								<div className='flex justify-between items-center mb-3'>
									<span className='text-slate-400 text-sm'>
										Section {idx + 1}
									</span>
									<button
										type='button'
										onClick={() => handleRemoveSection(idx)}
										className='text-red-400 hover:text-red-300 text-sm font-semibold'>
										Remove
									</button>
								</div>
								<input
									type='text'
									placeholder='Section title'
									value={section.title}
									onChange={(e) =>
										handleSectionChange(idx, "title", e.target.value)
									}
									className='w-full px-3 py-2 rounded-lg bg-[#04121a] border border-[#0f1724] focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-100 mb-2 text-sm'
								/>
								<textarea
									placeholder='Section content'
									value={section.content}
									onChange={(e) =>
										handleSectionChange(idx, "content", e.target.value)
									}
									rows={3}
									className='w-full px-3 py-2 rounded-lg bg-[#04121a] border border-[#0f1724] focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-100 text-sm resize-none'
								/>
							</div>
						))}

						{customSections.length === 0 && (
							<p className='text-slate-400 text-sm'>
								No custom sections yet. Click "Add Section" to create one!
							</p>
						)}
					</div>

					{/* Submit */}
					<button
						type='submit'
						disabled={loading}
						className='w-full py-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 rounded-lg font-semibold transition'>
						{loading ? "Saving..." : "Save Profile"}
					</button>

					{message && (
						<div
							className={`p-3 rounded-lg text-sm ${
								message.includes("success")
									? "bg-green-500/20 text-green-300 border border-green-500/50"
									: "bg-red-500/20 text-red-300 border border-red-500/50"
							}`}>
							{message}
						</div>
					)}
				</form>
			</div>
		</main>
	);
}
