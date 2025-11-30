/** @format */

"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

type Friend = { id: string; userAId: string; userBId: string; status: string };
type Message = {
	id: string;
	fromId: string;
	toId: string;
	content: string;
	createdAt: string;
};

export default function FriendsPage() {
	const [userId, setUserId] = useState<string>("");
	const [friends, setFriends] = useState<Friend[]>([]);
	const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [text, setText] = useState("");
	const socketRef = useRef<Socket | null>(null);

	useEffect(() => {
		if (!userId) return;
		fetch(`http://localhost:3000/users/${userId}/friends`)
			.then((r) => r.json())
			.then(setFriends)
			.catch(console.error);
		fetch(`http://localhost:3000/users/${userId}/messages`)
			.then((r) => r.json())
			.then(setMessages)
			.catch(console.error);

		const s = io("http://localhost:3000");
		socketRef.current = s;
		s.on("connect", () => {
			s.emit("join", userId);
		});
		s.on("direct_message", (msg: Message) => {
			setMessages((m) => [...m, msg]);
		});
		return () => {
			s.disconnect();
		};
	}, [userId]);

	function openChat(friend: Friend) {
		setSelectedFriend(friend);
	}

	async function sendMessage() {
		if (!socketRef.current || !selectedFriend) return;
		const toId =
			selectedFriend.userAId === userId
				? selectedFriend.userBId
				: selectedFriend.userAId;
		const payload = { fromId: userId, toId, content: text };
		socketRef.current.emit("direct_message", payload);
		setText("");
	}

	const chatWith = (f: Friend) =>
		f.userAId === userId ? f.userBId : f.userAId;

	return (
		<main className='min-h-screen bg-linear-to-br from-[#071021] via-[#07172a] to-[#001018] text-slate-100 p-8'>
			<div className='max-w-5xl mx-auto grid grid-cols-3 gap-6'>
				<div className='col-span-1'>
					<h2 className='text-cyan-300 text-lg mb-2'>Your ID</h2>
					<input
						className='w-full p-2 rounded bg-[#04121a] mb-4'
						placeholder='Enter your userId'
						value={userId}
						onChange={(e) => setUserId(e.target.value)}
					/>
					<h3 className='text-slate-200 mb-2'>Friends</h3>
					<div className='space-y-2'>
						{friends.map((f) => (
							<div
								key={f.id}
								className='p-3 rounded bg-[#021018] cursor-pointer'
								onClick={() => openChat(f)}>
								<div className='font-semibold'>{chatWith(f)}</div>
								<div className='text-xs text-slate-400'>{f.status}</div>
							</div>
						))}
					</div>
				</div>

				<div className='col-span-2'>
					<h2 className='text-cyan-300 text-lg mb-2'>Chat</h2>
					{selectedFriend ? (
						<div className='flex flex-col h-[60vh] bg-[#021018] rounded p-3'>
							<div className='flex-1 overflow-auto mb-2'>
								{messages
									.filter(
										(m) =>
											(m.fromId === userId &&
												m.toId === chatWith(selectedFriend)) ||
											(m.toId === userId &&
												m.fromId === chatWith(selectedFriend))
									)
									.map((m) => (
										<div
											key={m.id}
											className={`mb-2 p-2 rounded ${
												m.fromId === userId
													? "bg-cyan-600 self-end text-[#021018]"
													: "bg-white/5"
											}`}>
											<div className='text-xs text-slate-300'>{m.fromId}</div>
											<div>{m.content}</div>
											<div className='text-xs text-slate-400'>
												{new Date(m.createdAt).toLocaleTimeString()}
											</div>
										</div>
									))}
							</div>
							<div className='flex gap-2'>
								<input
									className='flex-1 p-2 rounded bg-[#04121a]'
									value={text}
									onChange={(e) => setText(e.target.value)}
								/>
								<button
									onClick={sendMessage}
									className='px-3 py-2 rounded bg-cyan-500 text-[#021018]'>
									Send
								</button>
							</div>
						</div>
					) : (
						<div className='p-6 rounded bg-white/3'>
							Select a friend to chat
						</div>
					)}
				</div>
			</div>
		</main>
	);
}
