import { EResponseStatus, EServerErrorCodes, IHTTPResponse } from "@classfields";
import { Pool, PoolClient, PoolConfig, QueryResult } from "pg";

export default class PostgresConnector {
	private pool: Pool;
	private connCounter: number;

	constructor(config: PoolConfig) {
		this.pool = new Pool({
			connectionTimeoutMillis: 1000 * 5,
			maxLifetimeSeconds: 10 * 1000 * 60,
			...config,
		});
		this.connCounter = 0;
		this.setupEventHandlers();
	}

	private async setupEventHandlers() {
		this.pool.on("connect", () => {
			if (this.connCounter < 1) {
				console.log("[PG] => Connected to the database");
				this.connCounter++;
			}
		});

		this.pool.on("error", (err: Error) => {
			console.error("[PG] => Unexpected error on idle client", err);
			console.log("[PG] => Attempting to reconnect...");
			this.reconnect();
		});
		this.pool.query("SELECT");
	}

	private async reconnect() {
		try {
			await this.pool.end();
			this.pool = new Pool(this.pool.options);
			this.setupEventHandlers();
			console.log("[PG] => Reconnected to the database");
		} catch (err) {
			console.error("[PG] => Reconnection failed", err);
			setTimeout(() => this.reconnect(), 1000);
		}
	}

	public async getData<T>(sqlQuery: string, params?: any[]): Promise<IHTTPResponse<T>> {
		const client = await this.pool.connect();
		try {
			const result: QueryResult = await this.pool.query(sqlQuery, params);
			return { status: EResponseStatus.SUCCESS, result: result.rows as T };
		} catch (err) {
			console.error("Error executing query", err);
			return { status: EResponseStatus.ERROR, code: EServerErrorCodes.UPSTREAM, message: "error receiving data" };
		} finally {
			client.release();
		}
	}

	public async query(sqlQuery: string, params?: any[]): Promise<IHTTPResponse<QueryResult<any>>> {
		const client = await this.pool.connect();
		try {
			const res = await client.query(sqlQuery, params);
			return { status: EResponseStatus.SUCCESS, result: res };
		} catch (err) {
			console.error("Error executing query", err);
			return { status: EResponseStatus.ERROR, code: EServerErrorCodes.UPSTREAM, message: "error executing query" };
		} finally {
			client.release();
		}
	}

	public async getClient(): Promise<PoolClient> {
		return await this.pool.connect();
	}

	public async closePool() {
		await this.pool.end();
		console.log("[PG] => Database pool closed");
	}
}
