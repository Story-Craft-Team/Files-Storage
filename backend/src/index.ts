import { EClientErrorCodes, EResponseStatus, EServerErrorCodes, IHTTPResponse, InternalCodeToHTTP } from "@classfields";
import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import PostgresConnector from "@modules/postgresConnector";
import { UUID } from "crypto";
import { config as dotenv } from "dotenv";
import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import mime from "mime-types";
import path from "path";

dotenv({ path: ".env" });

const PORT = Number(process.env.PORT);
if (!PORT) throw new Error("PORT incorrect in .env");

async function postgresConnect() {
	return new PostgresConnector({
		host: process.env.DB_HOST,
		user: process.env.DB_USER,
		database: process.env.DB_NAME,
		password: process.env.DB_PASSWORD,
		port: Number(process.env.DB_PORT),
	});
}

const BUCKETS_DIR = path.join(__dirname, "buckets");

async function start() {
	const pg = await postgresConnect();
	const app = fastify({ logger: false });
	hooks(app);
	api({ pg, app, bucketsDir: BUCKETS_DIR });
	app.listen({ port: PORT }, (e, address) => {
		if (e) throw e;
		console.log("Start HTTP (fastify) on", address.replaceAll("[::1]", "localhost"));
	});

	if ((await pg.query("SELECT")).status == 0) {
		throw new Error("Postgres health check failed; Check .env file");
	}
}
function hooks(app: FastifyInstance) {
	app.register(fastifyCookie, {
		hook: "onRequest",
		parseOptions: {},
	});
	if (!fs.existsSync(BUCKETS_DIR)) fs.mkdirSync(BUCKETS_DIR, { recursive: true });
	fastifyStatic(app, { root: BUCKETS_DIR });
	app.register(fastifyMultipart, {
		attachFieldsToBody: true,
		limits: {
			fieldNameSize: 36, // Max field name size in bytes
			fieldSize: 100, // Max field value size in bytes
			fields: 10, // Max number of non-file fields
			fileSize: 1024 * 1024 * 200, // 200MB; For multipart forms, the max file size in bytes
			files: 1, // Max number of file fields
			headerPairs: 2000, // Max number of header key => value pairs
		},
	});
}

interface IDepends {
	pg: PostgresConnector;
	app: FastifyInstance;
	bucketsDir: string;
}

async function api(depends: IDepends) {
	const app = depends.app;
	app.get("/", (_, res) => {
		return res.status(200).send("OK");
	});
	app.get("/health", (_, res) => {
		return res.status(200).send("OK");
	});

	app.post("/v1/putFile", async (req, res) => {
		var r = await putFileApi(depends, req, res);
		if (r.status == 0) {
			return res.code(InternalCodeToHTTP(r.code)).send(r);
		}
		return res.code(201).send(r);
	});
}

interface IFileData {
	uuid: UUID;
	bucket?: string | "";
	url: string;
	file_name: string;
	file_mimetype: string;
	file_ext: string;
	file_size: number;
	created_at?: Date;
}
async function putFileApi(depends: IDepends, req: FastifyRequest, res: FastifyReply): Promise<IHTTPResponse<IFileData>> {
	try {
		const urlParams = new URLSearchParams((req.query || {}) as any);

		const ContentType = req.headers["content-type"];
		const ContentLength = req.headers["content-length"];

		if (!ContentType || ContentLength == "0") {
			return { status: EResponseStatus.ERROR, code: EClientErrorCodes.NULL, message: "Content is empty" };
		}
		if (!ContentType.startsWith("multipart/form-data")) {
			return {
				status: EResponseStatus.ERROR,
				code: EClientErrorCodes.INVALID_TYPE,
				message: "Invalid content type, expected multipart/form-data",
			};
		}
		let body = req.body as any;
		if (body == null) return { status: EResponseStatus.ERROR, code: EClientErrorCodes.NULL, message: "Body is empty" };
		var file = (body["file"] || body["files"]) as any;
		if (file == null) return { status: EResponseStatus.ERROR, code: EClientErrorCodes.NULL, message: "'file' or 'files' field is empty" };

		if (Array.isArray(file) && file.length > 1) {
			return { status: EResponseStatus.ERROR, code: EClientErrorCodes.INCORRECT, message: "Only one file is allowed" };
		}
		if (Array.isArray(file) && file.length < 0) {
			return { status: EResponseStatus.ERROR, code: EClientErrorCodes.NULL, message: "Files array empty" };
		}
		if (Array.isArray(file) && file.length === 1) {
			file = file[0];
		}

		const filename = file["filename"] as string;
		var mimetype: string | false = file["mimetype"] as string;
		var bucket = (urlParams.get("bucket") || body?.bucket?.value || undefined) as string | undefined;
		const buffer = file["_buf"] as Buffer;
		if (filename == null) return { status: EResponseStatus.ERROR, code: EClientErrorCodes.NULL, message: "Filename is empty" };
		if (mimetype == null) return { status: EResponseStatus.ERROR, code: EClientErrorCodes.NULL, message: "Mimetype is empty" };
		if (buffer == null) return { status: EResponseStatus.ERROR, code: EClientErrorCodes.INCORRECT, message: "File incorrect" };
		var ext: string | false = path.extname(filename.trim()).trim().replaceAll(".", "");
		if (ext == null) return { status: EResponseStatus.ERROR, code: EClientErrorCodes.NULL, message: "Invalid file extension" };

		mimetype = mime.contentType(mimetype);
		if (mimetype == false || mime.contentType(ext) == false) {
			return { status: EResponseStatus.ERROR, code: EClientErrorCodes.INCORRECT, message: "Invalid mimetype of extension" };
		}
		if (mimetype !== mime.contentType(ext)) {
			return { status: EResponseStatus.ERROR, code: EClientErrorCodes.INCORRECT, message: "The mime type and the extension do not match the file type" };
		}
		if (bucket || bucket === "") {
			if (typeof bucket !== "string" || bucket.trim().length < 1) {
				return { status: EResponseStatus.ERROR, code: EClientErrorCodes.INCORRECT, message: "Field 'bucket' must be a non-empty string" };
			}
			bucket = bucket.toLowerCase().trim();
			if (!/^[a-z]+$/.test(bucket)) {
				return { status: EResponseStatus.ERROR, code: EClientErrorCodes.INCORRECT, message: "Field 'bucket' can only contain letters a-z" };
			}
		}
		bucket = bucket || "";

		const uuid = crypto.randomUUID();

		const fileData: IFileData = {
			uuid: uuid,
			bucket: bucket,
			url: `${bucket ? "/" + bucket : "/"}${uuid}/`,
			file_mimetype: mimetype,
			file_ext: ext.trim(),
			file_name: filename.trim(),
			file_size: buffer.length,
		};
		if (fileData.bucket === "") {
			delete fileData.bucket;
		}

		const entries = Object.entries(fileData);
		const placeholders = entries.map((_, index) => `$${index + 1}` as const);
		const keys = entries.map(([key]) => key);
		const values = entries.map(([, value]) => value);

		const sql = `INSERT INTO files (${keys.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING uuid;`;
		const res = await depends.pg.getData<{ uuid: string }[]>(sql, values);
		if (res.status !== EResponseStatus.SUCCESS) {
			return { status: EResponseStatus.ERROR, code: EServerErrorCodes.UPSTREAM, message: "Database error" };
		}
		if (fileData.bucket && !fs.existsSync(path.join(depends.bucketsDir, fileData.bucket))) {
			fs.mkdirSync(path.join(depends.bucketsDir, fileData.bucket), { recursive: true });
		}
		fs.writeFileSync(path.join(depends.bucketsDir, fileData?.bucket || "", fileData.uuid + "." + fileData.file_ext), buffer);

		return { status: EResponseStatus.SUCCESS, result: fileData };
	} catch (e) {
		console.error("Put file error:");
		console.error(e);
		return { status: EResponseStatus.ERROR, code: EServerErrorCodes.UNHANDLED, message: "Unknown error" };
	}
}
start();
