/**
 * LLM Chat Application Template
 *
 * A simple chat application using Cloudflare Workers AI.
 * This template demonstrates how to implement an LLM-powered chat interface with
 * streaming responses using Server-Sent Events (SSE).
 *
 * @license MIT
 */
import { Env, ChatMessage } from "./types";
import { generateSessionToken, verifySessionToken } from "./sessionToken";
import { checkRateLimit } from "./rateLimit";

// Model ID for Workers AI model
// https://developers.cloudflare.com/workers-ai/models/
const MODEL_ID = "@cf/meta/llama-3.1-8b-instruct-fp8";

// Default system prompt
const SYSTEM_PROMPT =
	"You are a helpful, friendly assistant. Provide concise and accurate responses.";

export default {
	/**
	 * Main request handler for the Worker
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext,
	): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets (frontend)
		if (url.pathname === "/" || !url.pathname.startsWith("/api/")) {
			return env.ASSETS.fetch(request);
		}

		// API Routes
		if (url.pathname === "/api/session-token/generate") {
			if (request.method === 'GET') {
				const oldToken = request.headers.get('Session-Token') || '';
				const token = generateSessionToken(oldToken);
				return new Response(
					JSON.stringify({ token }),
					{
						headers: { "content-type": "application/json" },
					},
				);
			}
		}

		else if (url.pathname === "/api/chat") {
			const token = request.headers.get('Session-Token') || '';
			const isValidSession = await verifySessionToken(token, env);
			if (!isValidSession) {
				return new Response("Invalid session token", { status: 401 });
			}

			const isRateLimited = await checkRateLimit(
				token,
				env
			);
			if (isRateLimited) {
				return new Response("Too many requests", { status: 429 });
			}

			// Handle POST requests for chat
			if (request.method === "POST") {
				return handleChatRequest(request, env);
			}

			// Method not allowed for other request types
			return new Response("Method not allowed", { status: 405 });
		}

		// Handle 404 for unmatched routes
		return new Response("Not found", { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Handles chat API requests
 */
async function handleChatRequest(
	request: Request,
	env: Env,
): Promise<Response> {
	try {
		// Parse JSON request body
		const { messages = [] } = (await request.json()) as {
			messages: ChatMessage[];
		};

		// Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}
		let stream;
		if (env.ENVIRONMENT === 'production') {
			stream = await env.AI.run(
				MODEL_ID,
				{
					messages,
					max_tokens: 1024,
					stream: true,
				},
				{
					// Uncomment to use AI Gateway
					// gateway: {
					//   id: "YOUR_GATEWAY_ID", // Replace with your AI Gateway ID
					//   skipCache: false,      // Set to true to bypass cache
					//   cacheTtl: 3600,        // Cache time-to-live in seconds
					// },
				},
			);
		} else if (env.ENVIRONMENT === 'development') {
			// Mock stream for local development
			stream = new ReadableStream<any>({
				async start(controller) {
					const encoder = new TextEncoder();
					// Send multiple SSE messages
					controller.enqueue(encoder.encode("data: {\"response\": \"Hello from custom stream\"}\n\n"));
					await new Promise(resolve => setTimeout(resolve, 1000));
					controller.enqueue(encoder.encode("data: {\"response\": \" Testing setup locally\"}\n\n"));
					await new Promise(resolve => setTimeout(resolve, 1000));
					controller.enqueue(encoder.encode("data: {\"response\": \". Done!\"}\n\n"));
					await new Promise(resolve => setTimeout(resolve, 1000));
					controller.enqueue(encoder.encode("[DONE]"));
					controller.close();
				},
			});
		}

		return new Response(stream, {
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache",
				connection: "keep-alive",
			},
		});
	} catch (error) {
		console.error("Error processing chat request:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process request" }),
			{
				status: 500,
				headers: { "content-type": "application/json" },
			},
		);
	}
}
