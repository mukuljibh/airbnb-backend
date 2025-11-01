import { matchedData, validationResult } from 'express-validator';
import { ValidationChain } from 'express-validator';

export async function validatePayload<T>(payload: T, validators: ValidationChain[]) {

    const req = { body: payload };

    for (const validator of validators) {
        await validator.run(req);
    }

    const result = validationResult(req);

    if (!result.isEmpty()) {
        return { valid: false, errors: result.array() };
    }

    const whitelistedData = matchedData(req, { locations: ['body'] });

    Object.keys(whitelistedData).forEach((key) => {
        if (whitelistedData[key] === null || whitelistedData[key] === undefined) {
            delete whitelistedData[key];
        }
    });
    return { valid: true, data: whitelistedData };
};
