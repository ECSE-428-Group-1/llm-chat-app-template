import { Env } from "./types";

export async function checkRateLimit(
    key: string,
    env: Env
): Promise<boolean> {
    const {success} = await env.NASAQ_RATE_LIMIT.limit({'key': key});
    return !success;
}