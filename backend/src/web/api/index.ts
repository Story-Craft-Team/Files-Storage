import { InternalCodeToHTTP } from "@classfields";
import { IMC } from "index";
import { putFileApi } from "./putFile";

export default (Server: IMC) => {
	const app = Server.fastify;
	app.get("/", (_, res) => {
		return res.status(200).send("OK");
	});
	app.get("/health", (_, res) => {
		return res.status(200).send("OK");
	});

	app.post("/v1/putFile", async (req, res) => {
		var r = await putFileApi(Server, req, res);
		if (r.status == 0) {
			return res.code(InternalCodeToHTTP(r.code)).send(r);
		}
		return res.code(201).send(r);
	});
};
