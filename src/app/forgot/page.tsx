/** @format */

"use client";

import { useState } from "react";

export default function ForgotPage() {
	const [email, setEmail] = useState("");
	const [message, setMessage] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setMessage(null);
		try {
			const res = await fetch("http://localhost:3000/forgot", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Request failed");
			setMessage(data.message || "Check your email");
		} catch (err: any) {
			setMessage(err.message || "Request failed");
		}
	}

	return (
		<main className='min-h-screen flex items-center justify-center bg-gradient-to-br from-[#071021] via-[#07172a] to-[#001018] text-slate-100'>
			<div className='w-full max-w-sm mx-4'>
				<div className='p-8 rounded-2xl bg-linear-to-tr from-white/3 via-white/2 to-white/2 backdrop-blur border border-white/6 shadow-lg'>
					<h1 className='text-2xl font-semibold tracking-wide mb-4 text-cyan-300'>
						Reset password
					</h1>

					<form onSubmit={handleSubmit} className='grid gap-4'>
						<label className='block text-sm text-slate-300'>
							<span className='mb-1 block'>Email</span>
							<input
								className='w-full px-3 py-2 rounded-lg bg-[#04121a] border border-[#0f1724] focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-100'
								type='email'
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
							/>
						</label>

						<button className='mt-2 w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-[#021018] font-semibold transition'>
							Send reset link
						</button>
					</form>

					{message && (
						<div className='mt-4 p-3 rounded-md bg-white/5 text-sm text-slate-200 border border-white/6'>
							{message}
						</div>
					)}

					<p className='mt-4 text-xs text-slate-400'>
						Remembered your password?{" "}
						<a href='/login' className='text-cyan-300 underline'>
							Sign in
						</a>
					</p>
				</div>
			</div>
		</main>
	);
}
