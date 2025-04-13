export type CriteriaType = 'EMAIL' | 'PHONE';
export type OperationType = 'SIGN_UP_OTP' | 'FORGET_PASSWORD_OTP' | 'UPDATE';

export type PhoneType = {
   country: string;
   countryCallingCode: string;
   number: string;
};

export type sendOtpRequestType = {
   criteria: CriteriaType;
   email: string;
   phone: PhoneType;
   type: OperationType;
};
