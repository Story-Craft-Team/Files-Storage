export enum EClientErrorCodes {
	UNKNOWN = "UNKNOWN",
	NULL = "IS_NULL",
	INVALID_TYPE = "INVALID_TYPE",
	INCORRECT = "INCORRECT",
	NOT_FOUND = "NOT_FOUND",
	INVEST = "NESTED_INCORRECT",
	UNAUTHORIZED = "UNAUTHORIZED",
	FORBIDDEN = "FORBIDDEN",
	NETWORK_ERROR = "NETWORK_ERROR",
}

export enum EServerErrorCodes {
	INTERNAL = "UNKNOWN_INTERNAL_ERROR",
	UPSTREAM = "UPSTREAM_SERVER_ERROR",
	UNHANDLED = "UNHANDLED_ERROR",
	EXTERNAL = "EXTERNAL_SERVER_ERROR",
	EXTERNALAPI = "EXTERNAL_API_ERROR",
}

export type TErrorCodes = EClientErrorCodes | EServerErrorCodes;

export const InternalCodeToHTTP = (code: TErrorCodes): number => {
	const codesToHttp: Record<TErrorCodes, number> = {
		[EClientErrorCodes.UNKNOWN]: 500,
		[EClientErrorCodes.NULL]: 400,
		[EClientErrorCodes.INVALID_TYPE]: 400,
		[EClientErrorCodes.INCORRECT]: 400,
		[EClientErrorCodes.NOT_FOUND]: 404,
		[EClientErrorCodes.INVEST]: 400,
		[EClientErrorCodes.UNAUTHORIZED]: 401,
		[EClientErrorCodes.NETWORK_ERROR]: 418,
		[EClientErrorCodes.FORBIDDEN]: 403,
		[EServerErrorCodes.INTERNAL]: 500,
		[EServerErrorCodes.UPSTREAM]: 502,
		[EServerErrorCodes.UNHANDLED]: 500,
		[EServerErrorCodes.EXTERNAL]: 502,
		[EServerErrorCodes.EXTERNALAPI]: 502,
	};
	return codesToHttp[code] ?? 500;
};

export enum EResponseStatus {
	SUCCESS = 1,
	ERROR = 0,
}

export interface IHTTPSuccessResponse<T> {
	status: EResponseStatus.SUCCESS;
	result: T;
}

export interface IErrorDetail {
	message: string;
	code?: number | string | TErrorCodes;
	value?: unknown;
}

export interface IHTTPFailedResponse {
	status: EResponseStatus.ERROR;
	code: TErrorCodes;
	message: string;
	details?: IErrorDetail | IErrorDetail[];
	more?: unknown;
}

export type IHTTPResponse<T> = IHTTPSuccessResponse<T> | IHTTPFailedResponse;
export type IHTTPResponseNoData = Pick<IHTTPSuccessResponse<void>, "status"> | IHTTPFailedResponse;
