export type SafeDocxErrorCode = 'FILE_NOT_FOUND' | 'INVALID_FILE_TYPE' | 'FILE_READ_ERROR' | 'INVALID_ARGUMENT' | 'PERMISSION_DENIED' | 'SESSION_NOT_FOUND' | 'SESSION_EXPIRED' | 'INVALID_SESSION_ID' | 'UNSUPPORTED_EDIT' | 'UNSAFE_CONTAINER_BOUNDARY' | 'EDIT_FAILED' | 'SAVE_ERROR';
export declare class SafeDocxError extends Error {
    readonly code: SafeDocxErrorCode;
    readonly hint?: string;
    constructor(code: SafeDocxErrorCode, message: string, hint?: string);
}
//# sourceMappingURL=errors.d.ts.map