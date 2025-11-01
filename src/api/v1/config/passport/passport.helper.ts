
import { Application } from "express";
import passport from "passport";
import { passportStrategies } from "./passport.strategy";



export function createPassportSessionhandler(app: Application) {


    function intializePassportStrategies() {
        passportStrategies();
    }

    function registerMainPassportSession() {
        app.use(passport.initialize());
        app.use(passport.session());
    }

    return {
        intializePassportStrategies,
        registerMainPassportSession
    }
}

export type PassportSessionHandlerType = ReturnType<typeof createPassportSessionhandler>;
