import { EClientErrorCodes, EResponseStatus, EServerErrorCodes, IHTTPResponse } from "@classfields";
import { UUID } from "crypto";
import { FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import { IMC } from "index";
import mime from "mime-types";
import path from "path";

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
export async function putFileApi(Server: IMC, req: FastifyRequest, res: FastifyReply): Promise<IHTTPResponse<IFileData>> {
	try {
		const urlParams = new URLSearchParams((req.query || {}) as any);
		const headers = (req.headers || {}) as any;

		const ContentType = headers["content-type"];
		const ContentLength = headers["content-length"];

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

		let bearer = headers?.authorization ? (headers.authorization.split(" ").length === 2 ? headers.authorization.split(" ")[1] : headers.authorization) : undefined;
		var apikey = (bearer || urlParams.get("secret") || body?.secret?.value || undefined) as string | undefined;

		if (!apikey) {
			return { status: EResponseStatus.ERROR, code: EClientErrorCodes.UNAUTHORIZED, message: "Unauthorized" };
		}
		if (apikey !== Server.web.apiKey) {
			return { status: EResponseStatus.ERROR, code: EClientErrorCodes.FORBIDDEN, message: "Forbidden" };
		}

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
			url: `/${bucket ? bucket + "/" : ""}${uuid}.${ext.trim()}`,
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
		const res = await Server.pg.getData<{ uuid: string }[]>(sql, values);
		if (res.status !== EResponseStatus.SUCCESS) {
			return { status: EResponseStatus.ERROR, code: EServerErrorCodes.UPSTREAM, message: "Database error" };
		}
		if (fileData.bucket && !fs.existsSync(path.join(Server.BUCKETS_DIR, fileData.bucket))) {
			fs.mkdirSync(path.join(Server.BUCKETS_DIR, fileData.bucket), { recursive: true });
		}
		fs.writeFileSync(path.join(Server.BUCKETS_DIR, fileData?.bucket || "", fileData.uuid + "." + fileData.file_ext), buffer);

		return { status: EResponseStatus.SUCCESS, result: fileData };
	} catch (e) {
		console.error("Put file error:");
		console.error(e);
		return { status: EResponseStatus.ERROR, code: EServerErrorCodes.UNHANDLED, message: "Unknown error" };
	}
}
