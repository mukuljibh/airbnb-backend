
class ApiResponse<T> {
    statusCode: number;
    data?: T;
    message: string;
    success: boolean;

    constructor(statusCode: number, message: string = "Success", data?: T,) {
        this.statusCode = statusCode;
        this.success = statusCode < 400;
        this.message = message;
        if (data !== undefined) {
            this.data = data;
        }

    }
}

export { ApiResponse };