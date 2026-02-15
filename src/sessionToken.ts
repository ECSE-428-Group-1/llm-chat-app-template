import { Env } from "./types";

export function generateSessionToken(oldToken:string): string {
    // Function that generates a new session token. If an old token is provided,
    // its validity will be checked and returned if valid, otherwise new one will be generated.
    if (verifySessionToken(oldToken, {} as Env)) {
        return oldToken;
    }
    
    const now = Date.now()
    const expirationTime = now + 24 * 60 * 60 * 1000;
    const id = crypto.randomUUID();

    const tokenData = {
        id,
        generatedTime: now,
        expirationTime: expirationTime
    }
    
    const tokenString = btoa(JSON.stringify(tokenData));
    return tokenString;
}

export function verifySessionToken(
    token: string,
    env: Env,
): boolean {
    try {
        const tokenData = JSON.parse(atob(token));
        const now = Date.now();
        if (tokenData.expirationTime < now || !tokenData.id || tokenData.generatedTime > now) {
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}