export class SafeDocxError extends Error {
    code;
    hint;
    constructor(code, message, hint) {
        super(message);
        this.code = code;
        this.hint = hint;
    }
}
//# sourceMappingURL=errors.js.map