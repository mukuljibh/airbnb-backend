//deprecated
import { Request, Response, NextFunction } from 'express';

type HandlerType = (req: Request, res: Response, next: NextFunction) => Promise<Response | void>;

function globalErrorHandler(fn: HandlerType) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

export function withErrorHandling<T extends Record<string, HandlerType>>(controllerObject: T): T {
    const wrapped = {} as T;

    for (const key in controllerObject) {
        const controller = controllerObject[key];
        if (typeof controller === "function") {
            wrapped[key] = globalErrorHandler(controller as HandlerType) as T[typeof key];
        } else {
            wrapped[key] = controller;
        }
    }

    return wrapped;
}