import fastifyCookie from "@fastify/cookie";
import fastifyMultipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import fs from "fs";
import { IMC } from "index";

function hooks(Server: IMC) {
	const fastify = Server.fastify;

	fastify.register(fastifyCookie, {
		hook: "onRequest",
		parseOptions: {},
	});
	if (!fs.existsSync(Server.BUCKETS_DIR)) fs.mkdirSync(Server.BUCKETS_DIR, { recursive: true });
	fastifyStatic(fastify, { root: Server.BUCKETS_DIR });
	fastify.register(fastifyMultipart, {
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

export default (Server: IMC): void => {
	hooks(Server);

	Server.fastify.listen({ port: Server.web.port }, (e, address) => {
		if (e) throw e;
		console.log("Start HTTP (fastify) on", address.replaceAll("[::1]", "localhost"));
	});
};
