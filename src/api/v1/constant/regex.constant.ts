export const nameRegex = /^[A-Za-z]{2,20}( [A-Za-z]{2,20})*$/;

export const emailRegix = /^[^@]+@[^@]+\.[^@]+$/;

export const passwordRegex =
   /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@.#$!%*?&])[A-Za-z\d@.#$!%*?&]{8,15}$/;

export const phoneRegex = /^[1-9]{1}[0-9]{9}$/;

export const usernameRegix = /^[a-zA-Z0-9_]{3,16}$/;

export const DobRegix = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/;

export const criteriaRegix = /^(PHONE|EMAIL)$/;

export const typeRegex =
   /^(SIGN_UP_OTP|WELCOME|ORDER_CONFIRMATION|FORGET_PASSWORD_OTP)$/;

export const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
