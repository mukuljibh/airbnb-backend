const errorKeys = {
   401: {
      TOKEN_EXPIRED: {
         key: 'TOKEN_EXPIRED',
         message: 'Your login session has been expired',
      },
      INVALID_OTP: {
         key: 'INVALID_OTP',
         message: 'Your OTP is incorrect.',
      },
   },
};
type statusCodeType = keyof typeof errorKeys;
export function errorKeysGenerator<T extends statusCodeType>(
   statusCode: T,
   key: keyof (typeof errorKeys)[T],
) {
   return (
      errorKeys[statusCode]?.[key] || {
         key: 'UNKNOWN_ERROR',
         message: 'An unknown error occurred.',
      }
   );
}
