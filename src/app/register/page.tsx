/** @format */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "../../lib/i18n";
import Link from "next/link";

export default function RegisterPage() {
	useEffect(() => {
		window.scrollTo(0, 0);
		if ("scrollRestoration" in window.history) {
			window.history.scrollRestoration = "manual";
		}
	}, []);

	const router = useRouter();
	const { t } = useI18n();
	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		// Validate passwords match
		if (password !== confirmPassword) {
			setError(t("passwordsDoNotMatch") || "Passwords do not match");
			return;
		}

		if (password.length < 6) {
			setError(
				t("passwordTooShort") || "Password must be at least 6 characters"
			);
			return;
		}

		setLoading(true);

		try {
			const response = await fetch("http://localhost:3001/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, displayName: name, password }),
			});

			const data = await response.json();

			if (!response.ok) {
				setError(data.message || "Registration failed");
				setLoading(false);
				return;
			}

			// Auto-login after successful registration
			if (data.token) {
				localStorage.setItem("auth_token", data.token);
				localStorage.setItem("user_id", data.user?.id || "");
				localStorage.setItem("user_name", data.user?.displayName || "");
				router.push("/dashboard");
			}
		} catch (err) {
			setError("Server error. Please try again.");
			console.error(err);
			setLoading(false);
		}
	};

	return (
		<div className='min-h-screen flex items-center justify-center px-4 bg-gradient-to-b from-[#000814] via-[#001d2a] to-[#000814]'>
			<div className='w-full max-w-md'>
				<div className='card-tech p-8 space-y-6'>
					<div className='text-center'>
						<h1 className='text-3xl font-bold text-cyan-300 mb-2'>
							{t("createAccount") || "Create Account"}
						</h1>
						<p className='text-slate-400 text-sm'>
							{t("joinCommunity") || "Join our gaming community"}
						</p>
					</div>

					{error && (
						<div className='bg-red-500/10 border border-red-500/30 rounded p-3 text-red-400 text-sm'>
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit} className='space-y-4'>
						<div>
							<label
								htmlFor='email'
								className='block text-sm font-medium text-cyan-300 mb-2'>
								{t("email")}
							</label>
							<input
								id='email'
								type='email'
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								className='input-hi w-full'
								placeholder='you@example.com'
							/>
						</div>

						<div>
							<label
								htmlFor='name'
								className='block text-sm font-medium text-cyan-300 mb-2'>
								{t("displayName") || "Display Name"}
							</label>
							<input
								id='name'
								type='text'
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								className='input-hi w-full'
								placeholder='Your gaming name'
							/>
						</div>

						<div>
							<label
								htmlFor='password'
								className='block text-sm font-medium text-cyan-300 mb-2'>
								{t("password")}
							</label>
							<input
								id='password'
								type='password'
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								className='input-hi w-full'
								placeholder='••••••••'
							/>
						</div>

						<div>
							<label
								htmlFor='confirmPassword'
								className='block text-sm font-medium text-cyan-300 mb-2'>
								{t("confirmPassword")}
							</label>
							<input
								id='confirmPassword'
								type='password'
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
								className='input-hi w-full'
								placeholder='••••••••'
							/>
						</div>

						<button
							type='submit'
							disabled={loading}
							className='btn-hi w-full bg-cyan-600 text-[#021018] font-semibold disabled:opacity-50 disabled:cursor-not-allowed'>
							{loading ? t("creatingAccount") || "Creating..." : t("register")}
						</button>
					</form>

					<div className='text-center text-sm text-slate-400'>
						{t("haveAccount") || "Already have an account?"}{" "}
						<Link
							href='/login'
							className='text-cyan-400 hover:text-cyan-300 font-semibold'>
							{t("login")}
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
