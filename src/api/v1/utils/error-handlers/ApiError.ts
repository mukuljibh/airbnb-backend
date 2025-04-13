class ApiError extends Error {
   statusCode: number;
   data: unknown;
   success: boolean;
   errorKey: unknown;

   constructor(
      statusCode: number,
      message: string = 'Something went wrong...',
      data?: unknown,
      errorKey?: unknown,
      stack: string = '',
   ) {
      super(message);
      this.statusCode = statusCode;
      this.data = data;
      this.success = false;
      this.errorKey = errorKey;
      if (stack) {
         this.stack = stack;
      } else {
         Error.captureStackTrace(this, this.constructor);
      }
   }
}

export { ApiError };
