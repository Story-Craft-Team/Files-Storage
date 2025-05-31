import PostgresConnector from "@modules/postgresConnector";
import { config as dotenv } from "dotenv";
import fastify, { FastifyInstance } from "fastify";
import path from "path";
import web from "web";

dotenv({ path: ".env" });

const PORT = Number(process.env.PORT);
if (!PORT) throw new Error("PORT incorrect in .env");
const API_KEY: string = process.env.API_KEY || "";
if (!API_KEY) throw new Error("API_KEY incorrect in .env");

export class IMC {
	pg: PostgresConnector;
	fastify: FastifyInstance;

	ROOT_DIR: string;
	BUCKETS_DIR: string;
	web: {
		port: number;
		apiKey: string;
	};

	constructor() {
		(this.ROOT_DIR = __dirname), (this.BUCKETS_DIR = path.join(__dirname, "buckets"));
		this.web = {
			port: PORT,
			apiKey: API_KEY,
		};

		this.init();
	}

	private async init() {
		this.fastify = fastify({ logger: false });
        await this.dbConnect();

        web(this)
	}

	private async dbConnect() {
		this.pg = new PostgresConnector({
			host: process.env.DB_HOST,
			user: process.env.DB_USER,
			database: process.env.DB_NAME,
			password: process.env.DB_PASSWORD,
			port: Number(process.env.DB_PORT),
		});
		if ((await this.pg.query("SELECT")).status == 0) {
			throw new Error("Postgres health check failed; Check .env file");
		}
	}
}

new IMC();