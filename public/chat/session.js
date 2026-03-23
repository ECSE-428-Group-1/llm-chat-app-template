/**
 * Session token management
 */

export async function updateAndSetToken() {
    const response = await fetch("/api/session-token/generate", {
        method: "GET",
        headers: {
            "Session-Token": localStorage.getItem("sessionToken") || "",
        },
    });
    if (!response.ok) {
        throw new Error("Failed to get session token");
    }
    const token = (await response.json())["token"];
    localStorage.setItem("sessionToken", token);
    return token;
}

export function getSessionToken() {
    return localStorage.getItem("sessionToken") || "";
}

export function hasSessionToken() {
    return !!localStorage.getItem("sessionToken");
}
