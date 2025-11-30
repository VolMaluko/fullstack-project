/** @format */

import express from "express";
import http from "http";
import cors from "cors";
import { Server as IOServer } from "socket.io";
import pkg from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";
import dotenv from "dotenv";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();

dotenv.config();

const STEAM_KEY = process.env.STEAM_API_KEY;

// Try to connect Prisma early and log result; don't crash the process on failure
prisma
	.$connect()
	.then(() => console.log("Prisma connected"))
	.catch((err) => {
		console.warn(
			"Prisma connection failed (continuing without DB):",
			err && err.message ? err.message : err
		);
	});

const STEAM_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
	Accept:
		"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
	"Accept-Language": "en-US,en;q=0.9, br;q=0.8",
	"Accept-Encoding": "gzip, deflate, br",
	Connection: "keep-alive",
	Referer: "https://store.steampowered.com/",
	Host: "store.steampowered.com",
	Pragma: "no-cache",
	"Cache-Control": "no-cache",
};

const app = express();
app.use(cors());
app.use(express.json());

// Ensure upload directory exists and serve uploads
const UPLOAD_DIR = "public/uploads";
try {
	fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {}
app.use("/uploads", express.static(UPLOAD_DIR));

// Multer storage
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, UPLOAD_DIR);
	},
	filename: function (req, file, cb) {
		const ext = (file.originalname || "").split(".").pop();
		cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`);
	},
});
const upload = multer({ storage });

// Admin endpoint: upload JSON file to import Steam apps into DB
const adminUpload = multer({ dest: "data/" });
app.post(
	"/admin/import-apps-json",
	adminUpload.single("file"),
	async (req, res) => {
		try {
			if (!req.file) return res.status(400).json({ error: "No file uploaded" });
			const raw = fs.readFileSync(req.file.path, "utf-8");
			let list = [];
			try {
				list = JSON.parse(raw);
			} catch (e) {
				return res.status(400).json({ error: "Invalid JSON" });
			}
			if (!Array.isArray(list))
				return res.status(400).json({ error: "JSON must be an array" });
			// Each item: { appid: number, name: string }
			const toInsert = list
				.filter(
					(a) => a && typeof a.appid === "number" && typeof a.name === "string"
				)
				.map((a) => ({ steamAppId: a.appid, name: a.name }));
			if (toInsert.length === 0) return res.json({ inserted: 0 });
			// Insert in chunks
			const chunkSize = 2000;
			let inserted = 0;
			for (let i = 0; i < toInsert.length; i += chunkSize) {
				const chunk = toInsert.slice(i, i + chunkSize);
				try {
					const result = await prisma.game.createMany({
						data: chunk,
						skipDuplicates: true,
					});
					if (result && result.count) inserted += result.count;
				} catch (e) {
					console.warn("Error inserting chunk", e && e.message ? e.message : e);
				}
			}
			res.json({ inserted });
		} catch (err) {
			console.error(err);
			res.status(500).json({ error: "Internal server error" });
		} finally {
			// Clean up uploaded file
			if (req.file && req.file.path) {
				try {
					fs.unlinkSync(req.file.path);
				} catch (e) {}
			}
		}
	}
);

/** @format */

// --- Simple persistent storage for per-user game lists (played / wishlist)
const LISTS_DIR = "data";
const LISTS_FILE = `${LISTS_DIR}/user_game_lists.json`;
try {
	fs.mkdirSync(LISTS_DIR, { recursive: true });
} catch (e) {}

function _readLists() {
	try {
		const raw = fs.readFileSync(LISTS_FILE, "utf-8");
		return JSON.parse(raw || "{}");
	} catch (e) {
		return {};
	}
}

function _writeLists(obj) {
	try {
		fs.writeFileSync(LISTS_FILE, JSON.stringify(obj, null, 2), "utf-8");
	} catch (e) {
		console.error("Failed to write user lists file", e);
	}
}

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "replace_this_in_prod";

function verifyToken(req, res, next) {
	const h = req.headers["authorization"] || req.headers["Authorization"];
	if (!h) return res.status(401).json({ error: "Missing Authorization" });
	const parts = h.split(" ");
	if (parts.length !== 2)
		return res.status(401).json({ error: "Malformed Authorization" });
	const token = parts[1];
	try {
		const payload = jwt.verify(token, JWT_SECRET);
		req.user = payload;
		next();
	} catch (err) {
		return res.status(401).json({ error: "Invalid token" });
	}
}

const httpServer = http.createServer(app);
const io = new IOServer(httpServer, { cors: { origin: "*" } });

app.use(
	cors({
		origin: "http://localhost:3000",
	})
);
// --- Socket.IO authentication and events ---
io.use((socket, next) => {
	try {
		const token = socket.handshake.auth && socket.handshake.auth.token;
		if (!token) return next(new Error("Missing token"));
		const payload = jwt.verify(token, JWT_SECRET);
		socket.user = payload;
		return next();
	} catch (err) {
		return next(new Error("Invalid token"));
	}
});

io.on("connection", (socket) => {
	const uid = socket.user && socket.user.id;
	if (uid) socket.join(`user:${uid}`);

	socket.on("join_community", () => socket.join("community"));

	socket.on("community_message", async (data) => {
		const { text } = data || {};
		if (!text) return;
		io.to("community").emit("community_message", {
			from: uid,
			text,
			createdAt: new Date(),
		});
	});

	socket.on("direct_message", async (data) => {
		try {
			const { toId, text } = data || {};
			if (!toId || !text) return;
			const msg = await prisma.message.create({
				data: { fromId: uid, toId, content: text },
			});
			io.to(`user:${toId}`).emit("direct_message", msg);
			io.to(`user:${uid}`).emit("direct_message", msg);
		} catch (err) {
			console.error("Error saving direct message", err);
		}
	});
});

// Global process handlers to log unhandled errors and try to shutdown gracefully
process.on("unhandledRejection", (reason, p) => {
	console.error("Unhandled Rejection at:", p, "reason:", reason);
});

process.on("uncaughtException", (err) => {
	console.error("Uncaught Exception:", err);
	try {
		console.log(
			"Attempting graceful shutdown after uncaughtException (will NOT force-exit)..."
		);
		// Try to close server and disconnect Prisma but do not call process.exit
		httpServer.close(() => {
			prisma
				.$disconnect()
				.then(() => console.log("Prisma disconnected after uncaughtException"))
				.catch((e) =>
					console.error("Error disconnecting Prisma after uncaughtException", e)
				);
		});
		// give time for cleanup; do NOT call process.exit to allow investigation
	} catch (e) {
		console.error("Error during uncaughtException cleanup", e);
	}
});

httpServer.on("error", (err) => {
	console.error("HTTP server error:", err);
});

process.on("beforeExit", (code) => {
	console.log("process beforeExit, code=", code);
});

process.on("exit", (code) => {
	console.log("process exit, code=", code);
});

// Express error handler (catch-all) to avoid crashing on route handler errors
app.use((err, req, res, next) => {
	console.error("Express handler error:", err);
	if (res.headersSent) return next(err);
	try {
		res.status(500).json({ error: "Internal server error" });
	} catch (e) {
		console.error("Failed to send error response", e);
	}
});

// Handle SIGTERM to allow graceful shutdown in containerized environments
process.on("SIGTERM", async () => {
	console.log("SIGTERM received: shutting down gracefully...");
	try {
		httpServer.close(() => {
			prisma.$disconnect().finally(() => process.exit(0));
		});
	} catch (e) {
		console.error("Error during SIGTERM shutdown", e);
		process.exit(1);
	}
});

// --- Games ---
app.get("/games", async (req, res) => {
	try {
		const {
			search,
			isFree,
			sort,
			page,
			perPage,
			platform,
			minPrice,
			maxPrice,
		} = req.query;
		const pageNum = Math.max(parseInt(page) || 1, 1);
		const per = Math.min(Math.max(parseInt(perPage) || 24, 1), 200);

		const where = {};
		if (search) {
			// case-insensitive name contains
			where.name = { contains: String(search), mode: "insensitive" };
		}
		if (typeof isFree !== "undefined") {
			const v = String(isFree).toLowerCase();
			if (v === "true") where.isFree = true;
			else if (v === "false") where.isFree = false;
		}
		if (platform && String(platform).toLowerCase() !== "all") {
			// platforms is a String[] field
			where.platforms = { has: String(platform).toLowerCase() };
		}
		if (minPrice) {
			const minC = parseInt(minPrice);
			if (!where.priceFinal) where.priceFinal = {};
			where.priceFinal.gte = minC;
		}
		if (maxPrice) {
			const maxC = parseInt(maxPrice);
			if (!where.priceFinal) where.priceFinal = {};
			where.priceFinal.lte = maxC;
		}

		let orderBy = { createdAt: "desc" };
		if (sort === "name") orderBy = { name: "asc" };
		else if (sort === "oldest") orderBy = { createdAt: "asc" };
		else if (sort === "price_asc") orderBy = { priceFinal: "asc" };
		else if (sort === "price_desc") orderBy = { priceFinal: "desc" };

		const total = await prisma.game.count({ where });
		const results = await prisma.game.findMany({
			where,
			orderBy,
			skip: (pageNum - 1) * per,
			take: per,
		});

		res.json({ total, page: pageNum, perPage: per, results });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// --- Profiles ---
app.get("/profiles/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const user = await prisma.user.findUnique({
			where: { id },
			select: {
				id: true,
				email: true,
				name: true,
				displayName: true,
				bio: true,
				avatarUrl: true,
				backgroundUrl: true,
				theme: true,
				showBadges: true,
				customSections: true,
			},
		});
		if (!user) return res.status(404).json({ error: "User not found" });
		res.json(user);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Current authenticated user's profile
app.get("/profiles/me", verifyToken, async (req, res) => {
	try {
		const userId = req.user.id;
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				email: true,
				name: true,
				displayName: true,
				bio: true,
				avatarUrl: true,
				backgroundUrl: true,
				theme: true,
				showBadges: true,
				customSections: true,
			},
		});
		if (!user) return res.status(404).json({ error: "User not found" });
		res.json(user);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Update profile metadata (json)
app.patch("/profiles", verifyToken, async (req, res) => {
	try {
		const userId = req.user.id;
		const { displayName, bio, theme, showBadges, customSections } = req.body;
		const data = {};
		if (displayName !== undefined) data.displayName = displayName;
		if (bio !== undefined) data.bio = bio;
		if (theme !== undefined) data.theme = theme;
		if (showBadges !== undefined) data.showBadges = showBadges;
		if (customSections !== undefined) data.customSections = customSections;
		const updated = await prisma.user.update({ where: { id: userId }, data });
		res.json(updated);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Upload avatar/background (multipart/form-data)
app.post(
	"/profiles/upload",
	verifyToken,
	upload.fields([{ name: "avatar" }, { name: "background" }]),
	async (req, res) => {
		try {
			const userId = req.user.id;
			const files = req.files || {};
			const data = {};
			if (files.avatar && files.avatar[0]) {
				data.avatarUrl = `/uploads/${files.avatar[0].filename}`;
			}
			if (files.background && files.background[0]) {
				data.backgroundUrl = `/uploads/${files.background[0].filename}`;
			}
			const updated = await prisma.user.update({ where: { id: userId }, data });
			res.json(updated);
		} catch (err) {
			console.error(err);
			res.status(500).json({ error: "Internal server error" });
		}
	}
);
app.get("/steam/apps", async (req, res) => {
	try {
		const maxResults = 30; // Limite de jogos por requisição
		let lastAppid = 0; // O primeiro appid para começar a buscar
		let allApps = []; // Array para armazenar os jogos encontrados
		let hasMoreApps = true; // Flag para verificar se existem mais jogos para carregar
		let totalLoaded = 0; // Número total de jogos carregados até agora

		// Verifica se existem jogos armazenados no banco e retorna esses jogos
		const storedApps = await prisma.game.findMany();
		if (storedApps.length > 0) {
			allApps = storedApps;
			console.log(
				`Retornando jogos armazenados do banco de dados (${storedApps.length} jogos encontrados)`
			);
			return res.json({ applist: { apps: allApps } });
		}

		// Lógica de requisições paginadas para buscar jogos da Steam
		while (hasMoreApps) {
			const response = await fetch(
				`https://api.steampowered.com/IStoreService/GetAppList/v1/?key=${STEAM_KEY}&max_results=${maxResults}&last_appid=${lastAppid}&include_games=1`
			);

			if (!response.ok) {
				throw new Error("Falha ao obter dados da Steam API");
			}

			const data = await response.json();

			if (data && data.response && Array.isArray(data.response.apps)) {
				const apps = data.response.apps.map((app) => ({
					appid: app.appid,
					name: app.name,
				}));

				// Acumula os jogos
				allApps = [...allApps, ...apps];

				// Verifica se há mais jogos para carregar
				hasMoreApps = data.response.have_more_results;

				if (hasMoreApps) {
					lastAppid = data.response.last_appid; // Atualiza o last_appid para próxima requisição
				}

				// Armazenando os jogos no banco (evitando duplicação)
				for (const app of apps) {
					await prisma.game.upsert({
						where: { appid: app.appid }, // Verifica se o app já existe
						update: {}, // Não faz atualização
						create: {
							// Se não existir, cria um novo registro
							appid: app.appid,
							name: app.name,
						},
					});
				}

				totalLoaded += apps.length;

				// Se atingiu a quantidade desejada, podemos parar (opcional, caso queira limitar a carga)
				if (totalLoaded >= 100) {
					// Limite máximo de 100 jogos para carregar
					break;
				}
			} else {
				console.error("Resposta da API não contém a estrutura esperada:", data);
				throw new Error("Estrutura de dados inesperada da Steam API");
			}
		}

		// Retorna os jogos acumulados
		console.log(`Carregados ${totalLoaded} jogos`);
		res.json({ applist: { apps: allApps } });
	} catch (err) {
		console.error("Erro ao buscar jogos: ", err);
		res.status(500).send("Erro ao buscar jogos");
	}
});
app.get("/steam/details/:appid", async (req, res) => {
	try {
		const appid = parseInt(req.params.appid, 10);

		// Verificar se o appid é válido
		if (!appid) {
			return res.status(400).send("Invalid appid");
		}

		// Buscar o jogo no banco de dados
		const game = await prisma.game.findUnique({
			where: { appid: appid },
		});

		// Verificar se o jogo existe no banco
		if (!game) {
			return res.status(404).send("Jogo não encontrado");
		}

		// Continuar com a busca dos detalhes do jogo
		const response = await fetch(
			`https://api.steampowered.com/IStoreService/GetAppDetails/v1/?key=${STEAM_KEY}&appid=${appid}`
		);

		if (!response.ok) {
			throw new Error("Falha ao obter detalhes do jogo");
		}

		const data = await response.json();
		const gameDetails = data.response?.game_details;

		// Verificar se os detalhes do jogo estão presentes
		if (!gameDetails) {
			throw new Error("Detalhes do jogo não encontrados");
		}

		res.json(gameDetails);
	} catch (err) {
		console.error("Erro ao buscar detalhes: ", err);
		res.status(500).send("Erro ao buscar detalhes do jogo");
	}
});

app.get("/steam/uptodate", async (req, res) => {
	const { appid, version } = req.query;

	if (!appid || !version)
		return res.status(400).json({
			error: "Parâmetros obrigatórios: ?appid=<id>&version=<build_version>",
		});

	try {
		const url =
			`https://api.steampowered.com/ISteamApps/UpToDateCheck/v1/?` +
			`appid=${appid}&version=${version}&key=${STEAM_KEY}`;

		const resp = await fetch(url);
		const json = await resp.json();

		res.json(json);
	} catch (err) {
		res
			.status(500)
			.json({ error: "Erro ao verificar versão", detail: err.message });
	}
});

app.post("/games/fetch", async (req, res) => {
	try {
		const { steamAppId } = req.body;
		if (!steamAppId)
			return res.status(400).json({ error: "steamAppId required" });

		let game = await prisma.game.findUnique({ where: { steamAppId } });
		if (!game) {
			const resp = await fetch(
				`https://store.steampowered.com/api/appdetails?appids=${steamAppId}&l=en`
			);
			const json = await resp.json();
			const data = json[steamAppId] && json[steamAppId].data;
			if (!data) return res.status(404).json({ error: "Steam app not found" });
			const name = data.name || `App ${steamAppId}`;
			const image =
				data.header_image ||
				(data.screenshots &&
					data.screenshots[0] &&
					data.screenshots[0].path_full) ||
				null;
			const required_age = parseInt(data.required_age || "0", 10) || 0;
			const ageRestricted =
				required_age >= 18 ||
				(data.categories &&
					data.categories.some((c) => /mature|adult/i.test(c.description)));

			// Extract platforms and price overview for improved filtering
			const platforms = data.platforms || null;
			const priceOverview = data.price_overview || null;
			const isFree = priceOverview ? Number(priceOverview.final) === 0 : false;

			game = await prisma.game.create({
				data: {
					steamAppId,
					name,
					image,
					ageRestricted,
					platforms,
					priceOverview,
					isFree,
				},
			});
		}
		res.json(game);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.get("/games/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const game = await prisma.game.findUnique({ where: { id } });
		if (!game) return res.status(404).json({ error: "Game not found" });
		res.json(game);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Get game by Steam AppID with Steam details merged
app.get("/games/steam/:steamAppId", async (req, res) => {
	try {
		const { steamAppId } = req.params;
		if (!steamAppId)
			return res.status(400).json({ error: "steamAppId required" });
		const idNum = Number(steamAppId);
		if (!Number.isFinite(idNum))
			return res.status(400).json({ error: "invalid steamAppId" });
		const idStr = String(idNum);
		// find local DB record if exists
		let game = await prisma.game.findUnique({
			where: { steamAppId: Number(steamAppId) },
		});

		// get steam detail from cache
		try {
			const resp = await fetch(
				`https://store.steampowered.com/api/appdetails?appids=${idStr}&l=en`
			);
			if (resp && resp.ok) {
				const json = await resp.json();
				const detail = json && json[idStr] ? json[idStr] : null;
				return res.json({ game, detail });
			}
		} catch (e) {
			// ignore steam detail errors, return db record if available
		}

		return res.json({ game, detail: null });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.get("/steam/importar", async (req, res) => {
	try {
		const maxResults = 30; // Número de jogos por requisição
		let lastAppid = 0; // O primeiro appid para começar
		let hasMoreApps = true;

		while (hasMoreApps) {
			const response = await fetch(
				`https://api.steampowered.com/IStoreService/GetAppList/v1/?key=${STEAM_KEY}&max_results=${maxResults}&last_appid=${lastAppid}&include_games=1`
			);

			if (!response.ok) {
				throw new Error("Falha ao obter dados da Steam API");
			}

			const data = await response.json();

			if (data && data.response && Array.isArray(data.response.apps)) {
				for (const app of data.response.apps) {
					const { appid, name } = app;

					// Verificar se o jogo já existe no banco
					const existingGame = await prisma.game.findUnique({
						where: { steamAppId: appid },
					});

					if (!existingGame) {
						// Buscar detalhes do jogo usando GetAppDetails
						const gameDetailsResponse = await fetch(
							`https://store.steampowered.com/api/appdetails?appids=${appid}&key=${STEAM_KEY}`
						);
						const gameDetailsData = await gameDetailsResponse.json();

						const gameDetails = gameDetailsData[appid]?.data;
						if (gameDetails) {
							const description = gameDetails.short_description || "";
							const image = gameDetails.header_image || "URL_DEFAULT_IMAGE"; // Defina uma imagem padrão
							const genres = gameDetails.genres
								? gameDetails.genres.map((genre) => genre.description)
								: [];
							const platforms = gameDetails.platforms
								? Object.keys(gameDetails.platforms).filter(
										(platform) => gameDetails.platforms[platform]
								  )
								: [];
							const releaseDate = gameDetails.release_date?.date
								? new Date(gameDetails.release_date.date)
								: null;
							const price = gameDetails.is_free
								? 0
								: gameDetails.price_overview?.final_formatted
								? parseFloat(
										gameDetails.price_overview.final_formatted.replace(
											/[^\d.-]/g,
											""
										)
								  )
								: 0;

							// Inserir o jogo no banco com todos os detalhes
							await prisma.game.create({
								data: {
									steamAppId: appid,
									name,
									description,
									image,
									genres,
									platforms,
									releaseDate,
									priceOverview: gameDetails.price_overview || {},
									priceFinal: price,
									isFree: gameDetails.is_free,
								},
							});

							console.log(`Jogo adicionado: ${name}`);
						}
					}
				}

				// Atualize o `lastAppid` para a próxima requisição
				hasMoreApps = data.response.have_more_results;
				if (hasMoreApps) {
					lastAppid = data.response.last_appid;
				}
			} else {
				console.error("Resposta da API não contém a estrutura esperada:", data);
				throw new Error("Estrutura de dados inesperada da Steam API");
			}
		}

		res.status(200).send("Jogos importados com sucesso!");
	} catch (err) {
		console.error("Erro ao buscar jogos: ", err);
		res.status(500).send("Erro ao importar jogos");
	}
});

// Helper to ensure a game exists in DB for a steamAppId, creating it from Steam details if necessary
async function ensureGameBySteamId(steamAppId) {
	let game = await prisma.game.findUnique({
		where: { steamAppId: Number(steamAppId) },
	});
	if (game) return game;
	try {
		const resp = await fetch(
			`https://store.steampowered.com/api/appdetails?appids=${steamAppId}&l=en`
		);
		if (!resp.ok) return null;
		const json = await resp.json();
		const data = json && json[steamAppId] && json[steamAppId].data;
		if (!data) return null;
		const name = data.name || `App ${steamAppId}`;
		const image =
			data.header_image ||
			(data.screenshots &&
				data.screenshots[0] &&
				data.screenshots[0].path_full) ||
			null;
		const required_age = parseInt(data.required_age || "0", 10) || 0;
		const ageRestricted =
			required_age >= 18 ||
			(data.categories &&
				data.categories.some((c) => /mature|adult/i.test(c.description)));
		const platforms = data.platforms || null;
		const priceOverview = data.price_overview || null;
		const isFree = priceOverview ? Number(priceOverview.final) === 0 : false;

		game = await prisma.game.create({
			data: {
				steamAppId: Number(steamAppId),
				name,
				image,
				ageRestricted,
				platforms,
				priceOverview,
				isFree,
			},
		});
		return game;
	} catch (e) {
		console.warn(
			"Failed to ensure game by steam id",
			e && e.message ? e.message : e
		);
		return null;
	}
}

// Comments by Steam AppID (maps to internal game id)
app.get("/games/steam/:steamAppId/comments", async (req, res) => {
	try {
		const { steamAppId } = req.params;
		const game = await prisma.game.findUnique({
			where: { steamAppId: Number(steamAppId) },
		});
		if (!game) return res.json([]);
		const comments = await prisma.comment.findMany({
			where: { gameId: game.id },
			include: { user: { select: { id: true, name: true } } },
			orderBy: { createdAt: "desc" },
		});
		res.json(comments);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.post("/games/steam/:steamAppId/comments", verifyToken, async (req, res) => {
	try {
		const { steamAppId } = req.params;
		const userId = req.user.id;
		const { content, rating } = req.body;
		if (!content) return res.status(400).json({ error: "content required" });
		let game = await prisma.game.findUnique({
			where: { steamAppId: Number(steamAppId) },
		});
		if (!game) {
			game = await ensureGameBySteamId(steamAppId);
			if (!game) return res.status(404).json({ error: "Game not found" });
		}
		const comment = await prisma.comment.create({
			data: {
				userId,
				gameId: game.id,
				content,
				rating: rating ? Number(rating) : null,
			},
		});
		res.status(201).json(comment);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Likes storage in a simple JSON file mapping steamAppId -> array of userIds
const LIKES_FILE = `${LISTS_DIR}/game_likes.json`;
function _readLikes() {
	try {
		const raw = fs.readFileSync(LIKES_FILE, "utf-8");
		return JSON.parse(raw || "{}");
	} catch (e) {
		return {};
	}
}
function _writeLikes(obj) {
	try {
		fs.writeFileSync(LIKES_FILE, JSON.stringify(obj, null, 2), "utf-8");
	} catch (e) {
		console.error("Failed to write likes file", e);
	}
}

app.get("/games/steam/:steamAppId/likes", async (req, res) => {
	try {
		const { steamAppId } = req.params;
		const likes = _readLikes();
		const arr = likes[steamAppId] || [];
		const userId = (req.headers["authorization"] || "").split(" ")[1]
			? (() => {
					try {
						const payload = jwt.verify(
							(req.headers["authorization"] || "").split(" ")[1],
							JWT_SECRET
						);
						return payload.id;
					} catch (e) {
						return null;
					}
			  })()
			: null;
		res.json({
			count: arr.length,
			likedByUser: userId ? arr.includes(userId) : false,
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.post("/games/steam/:steamAppId/likes", verifyToken, async (req, res) => {
	try {
		const { steamAppId } = req.params;
		const userId = req.user.id;
		const likes = _readLikes();
		const arr = likes[steamAppId] || [];
		const idx = arr.indexOf(userId);
		let action = null;
		if (idx === -1) {
			arr.push(userId);
			action = "liked";
		} else {
			arr.splice(idx, 1);
			action = "unliked";
		}
		likes[steamAppId] = arr;
		_writeLikes(likes);
		res.json({ action, count: arr.length });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// --- Steam proxy & cache ---
const steamCache = { data: null, ts: 0 };
const STEAM_TTL = 1000 * 60 * 5; // 5 minutes

app.get("/steam/featuredcategories", async (req, res) => {
	const UA =
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

	try {
		const response = await fetch(
			"https://store.steampowered.com/api/featuredcategories",
			{
				headers: {
					"User-Agent": UA,
					Referer: "https://store.steampowered.com",
					Accept: "application/json",
				},
			}
		);

		if (!response.ok) {
			const text = await response.text();
			console.log("Steam fetch non-ok", response.status, text.slice(0, 200));
			return res.status(response.status).send("Steam search failed");
		}

		res.json(await response.json());
	} catch (err) {
		res.status(500).json({ error: "Steam error", detail: err.message });
	}
});

// --- Steam app list (GetAppList) proxy + cache (large, cache long)
const steamAppsCache = { data: null, ts: 0 };
const STEAM_APPS_TTL = 1000 * 60 * 60 * 24; // 24 hours

app.get("/steam/search", async (req, res) => {
	const q = req.query.q;
	if (!q) return res.json({ total: 0, items: [] });

	const UA =
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

	try {
		const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(
			q
		)}&l=english&cc=us`;

		const response = await fetch(url, {
			headers: {
				"User-Agent": UA,
				Referer: "https://store.steampowered.com",
				Accept: "application/json",
			},
		});

		if (!response.ok) {
			const text = await response.text();
			console.log("Steam fetch non-ok", response.status, text.slice(0, 200));
			return res.status(response.status).send("Steam search failed");
		}

		const data = await response.json();
		res.json(data);
	} catch (err) {
		res.status(500).json({ error: "Search failed", detail: err.message });
	}
});

// --- Steam app details (batch) with short cache per app
const steamDetailsCache = {}; // { [appid]: { ts, data } }
const STEAM_DETAILS_TTL = 1000 * 60 * 60; // 1 hour

app.get("/steam/appdetails", async (req, res) => {
	try {
		const appidsParam = req.query.appids;
		if (!appidsParam)
			return res.status(400).json({ error: "appids query required" });
		const ids = String(appidsParam)
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
		const out = {};

		await Promise.all(
			ids.map(async (id) => {
				try {
					const now = Date.now();
					const cached = steamDetailsCache[id];
					if (cached && now - cached.ts < STEAM_DETAILS_TTL) {
						out[id] = cached.data;
						return;
					}
					const resp = await fetch(
						`https://store.steampowered.com/api/appdetails?appids=${id}&l=en`
					);
					if (!resp.ok) {
						out[id] = null;
						return;
					}
					const json = await resp.json();
					const data = json[id] && json[id].data;
					if (!data) {
						out[id] = null;
						return;
					}
					const detail = {
						header_image: data.header_image || null,
						screenshots: data.screenshots || null,
						price_overview: data.price_overview || null,
						is_free: data.is_free || false,
						name: data.name || null,
					};
					steamDetailsCache[id] = { ts: now, data: detail };
					out[id] = detail;
				} catch (err) {
					out[id] = null;
				}
			})
		);

		res.json(out);
	} catch (err) {
		console.error("Error in /steam/appdetails", err);
		res.status(500).json({ error: "Internal" });
	}
});

// --- Recommendations ---
app.post("/recommendations", verifyToken, async (req, res) => {
	try {
		const fromId = req.user.id;
		const { toId, steamAppId, reason } = req.body;
		if (!toId || !steamAppId)
			return res.status(400).json({ error: "toId and steamAppId required" });

		let game = await prisma.game.findUnique({ where: { steamAppId } });
		if (!game) {
			const resp = await fetch(
				`https://store.steampowered.com/api/appdetails?appids=${steamAppId}&l=en`
			);
			const json = await resp.json();
			const data = json[steamAppId] && json[steamAppId].data;
			if (!data) return res.status(404).json({ error: "Steam app not found" });
			const name = data.name || `App ${steamAppId}`;
			const image =
				data.header_image ||
				(data.screenshots &&
					data.screenshots[0] &&
					data.screenshots[0].path_full) ||
				null;
			const required_age = parseInt(data.required_age || "0", 10) || 0;
			const ageRestricted =
				required_age >= 18 ||
				(data.categories &&
					data.categories.some((c) => /mature|adult/i.test(c.description)));

			const platforms = data.platforms || null;
			const priceOverview = data.price_overview || null;
			const isFree = priceOverview ? Number(priceOverview.final) === 0 : false;

			game = await prisma.game.create({
				data: {
					steamAppId,
					name,
					image,
					ageRestricted,
					platforms,
					priceOverview,
					isFree,
				},
			});
		}

		// Prevent duplicate recommendation if one already exists for this user+game
		const existingRec = await prisma.recommendation.findFirst({
			where: { toId, gameId: game.id },
		});
		if (existingRec)
			return res.status(409).json({
				error: "Recommendation already exists for this user and game",
			});

		// Check recipient's lists (played / wishlist) stored in file
		try {
			const lists = _readLists();
			const target = lists[toId] || { played: [], wishlist: [] };
			if (target.played && target.played.includes(Number(steamAppId))) {
				return res.status(400).json({ error: "User already played this game" });
			}
			if (target.wishlist && target.wishlist.includes(Number(steamAppId))) {
				return res
					.status(400)
					.json({ error: "User already has this game in wishlist" });
			}
		} catch (e) {
			console.warn("Could not read user lists for recommendation checks", e);
		}

		const rec = await prisma.recommendation.create({
			data: { fromId, toId, gameId: game.id, reason },
		});
		res.status(201).json(rec);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.get("/users/:id/recommendations", async (req, res) => {
	try {
		const { id } = req.params;
		const recs = await prisma.recommendation.findMany({
			where: { toId: id },
			include: {
				game: true,
				from: { select: { id: true, name: true, email: true } },
			},
			orderBy: { createdAt: "desc" },
		});
		res.json(recs);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.patch("/recommendations/:id", verifyToken, async (req, res) => {
	try {
		const { id } = req.params;
		const { status } = req.body;
		const updated = await prisma.recommendation.update({
			where: { id },
			data: { status },
		});
		res.json(updated);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// --- Comments & ratings ---
app.post("/games/:id/comments", verifyToken, async (req, res) => {
	try {
		const { id } = req.params;
		const userId = req.user.id;
		const { content, rating } = req.body;
		if (!content) return res.status(400).json({ error: "content required" });
		const comment = await prisma.comment.create({
			data: {
				userId,
				gameId: id,
				content,
				rating: rating ? Number(rating) : null,
			},
		});
		res.status(201).json(comment);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.get("/games/:id/comments", async (req, res) => {
	try {
		const { id } = req.params;
		const comments = await prisma.comment.findMany({
			where: { gameId: id },
			include: { user: { select: { id: true, name: true } } },
			orderBy: { createdAt: "desc" },
		});
		res.json(comments);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// --- Friends ---
app.post("/friends/request", verifyToken, async (req, res) => {
	try {
		const fromId = req.user.id;
		const { toId } = req.body;
		if (!toId) return res.status(400).json({ error: "toId required" });
		const friend = await prisma.friend.create({
			data: { userAId: fromId, userBId: toId, status: "PENDING" },
		});
		res.status(201).json(friend);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.post("/friends/:id/accept", verifyToken, async (req, res) => {
	try {
		const { id } = req.params;
		const f = await prisma.friend.update({
			where: { id },
			data: { status: "ACCEPTED" },
		});
		res.json(f);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.post("/friends/:id/block", verifyToken, async (req, res) => {
	try {
		const { id } = req.params;
		const f = await prisma.friend.update({
			where: { id },
			data: { status: "BLOCKED" },
		});
		res.json(f);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// --- User game lists API (played / wishlist) stored in data/user_game_lists.json ---
app.get("/me/games", verifyToken, async (req, res) => {
	try {
		const userId = req.user.id;
		const lists = _readLists();
		const target = lists[userId] || { played: [], wishlist: [] };
		res.json(target);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.post("/me/games/played", verifyToken, async (req, res) => {
	try {
		const userId = req.user.id;
		const { steamAppId } = req.body;
		if (!steamAppId)
			return res.status(400).json({ error: "steamAppId required" });
		const lists = _readLists();
		const target = lists[userId] || { played: [], wishlist: [] };
		const idNum = Number(steamAppId);
		if (target.played && target.played.includes(idNum)) {
			return res.status(409).json({ error: "Game already in played list" });
		}
		// remove from wishlist if present
		target.wishlist = (target.wishlist || []).filter((x) => x !== idNum);
		target.played = target.played || [];
		target.played.push(idNum);
		lists[userId] = target;
		_writeLists(lists);
		res.status(201).json(target);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.post("/me/games/wishlist", verifyToken, async (req, res) => {
	try {
		const userId = req.user.id;
		const { steamAppId } = req.body;
		if (!steamAppId)
			return res.status(400).json({ error: "steamAppId required" });
		const lists = _readLists();
		const target = lists[userId] || { played: [], wishlist: [] };
		const idNum = Number(steamAppId);
		if (target.wishlist && target.wishlist.includes(idNum)) {
			return res.status(409).json({ error: "Game already in wishlist" });
		}
		target.wishlist = target.wishlist || [];
		// don't add to wishlist if already in played
		if (target.played && target.played.includes(idNum)) {
			return res.status(400).json({ error: "User already played this game" });
		}
		target.wishlist.push(idNum);
		lists[userId] = target;
		_writeLists(lists);
		res.status(201).json(target);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.get("/users/:id/friends", async (req, res) => {
	try {
		const { id } = req.params;
		const friends = await prisma.friend.findMany({
			where: {
				OR: [{ userAId: id }, { userBId: id }],
				AND: { status: "ACCEPTED" },
			},
		});
		res.json(friends);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Messages listing for a user (both sent and received)
app.get("/users/:id/messages", verifyToken, async (req, res) => {
	try {
		const { id } = req.params;
		const msgs = await prisma.message.findMany({
			where: { OR: [{ fromId: id }, { toId: id }] },
			orderBy: { createdAt: "asc" },
		});
		res.json(msgs);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// --- Auth: register / login / forgot ---
app.post("/register", async (req, res) => {
	try {
		const { email, name, password } = req.body;
		if (!email || !password)
			return res.status(400).json({ error: "Email and password required" });
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing)
			return res.status(409).json({ error: "Email already registered" });
		const hash = await bcrypt.hash(password, 10);
		const user = await prisma.user.create({
			data: { email, name, password: hash },
		});
		const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
			expiresIn: "7d",
		});
		res.status(201).json({ id: user.id, email: user.email, token });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.post("/login", async (req, res) => {
	try {
		const { email, password } = req.body;
		if (!email) return res.status(400).json({ error: "Email is required" });
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) return res.status(401).json({ error: "Invalid credentials" });
		if (user.password) {
			if (!password)
				return res.status(400).json({ error: "Password required" });
			const ok = await bcrypt.compare(password, user.password);
			if (!ok) return res.status(401).json({ error: "Invalid credentials" });
		}
		const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
			expiresIn: "7d",
		});
		res.json({
			message: "Login successful",
			token,
			user: { id: user.id, email: user.email, name: user.name },
		});
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.post("/forgot", async (req, res) => {
	try {
		const { email } = req.body;
		if (!email) return res.status(400).json({ error: "Email is required" });
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) return res.status(404).json({ error: "User not found" });
		res.json({ message: "Reset link sent (mock)" });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Basic users CRUD (kept for compatibility)
app.get("/users", async (req, res) => {
	try {
		const users = await prisma.user.findMany();
		res.json(users);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.put("/users/:id", verifyToken, async (req, res) => {
	try {
		const { id } = req.params;
		const { email, name } = req.body;
		const updated = await prisma.user.update({
			where: { id },
			data: { email, name },
		});
		res.json(updated);
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.delete("/users/:id", verifyToken, async (req, res) => {
	try {
		const { id } = req.params;
		await prisma.user.delete({ where: { id } });
		res.json({ message: "User deleted" });
	} catch (err) {
		console.error(err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// Add 404 handler to catch undefined routes
app.use((req, res) => {
	res.status(404).json({ error: "Not found" });
});

// Small delay to ensure all async tasks start properly before listening
setTimeout(() => {
	httpServer.listen(PORT, () => {
		console.log(`Server running on http://localhost:${PORT}`);
	});
}, 100);

// Add keep-alive handler to prevent Node from exiting when no active handlers exist
setInterval(() => {
	// This keeps the event loop active
}, 30000);

// NOTE: SIGINT handler removed to avoid premature shutdown in some terminal environments.
// Keep process-level error handlers above which attempt graceful shutdown on uncaught errors.

// export default app;  // Removed to avoid potential ESM export issues
