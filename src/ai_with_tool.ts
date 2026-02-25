import { env } from "cloudflare:workers";
import { ChatMessage } from "./types";
import OpenAI from 'openai';

const SYSTEM_PROMPT = 
`Act as a legal helper chatbot. When a user asks a question, always search the provided vector database using the tool query_articles to find relevant legal articles. Carefully review the returned articles for relevance. Only answer if you find at least one clearly relevant article—cite it directly and explain how it supports your answer. If no relevant article is found, politely inform the user that you cannot answer due to insufficient information.
Follow these steps:
1. Search for relevant articles with query_articles using the user's question.
1.1. If no relevant articles are found, search with different keywords or broader terms.
2. Fetch the full content of any potentially relevant articles using fetch_article. 
3. Review and reason through each article's content for relevance.
4. If relevant, answer based on the article(s), citing and explaining relevance.
5. If none are relevant, state you cannot answer.
Output format:
- REASONING: Your reasoning about the (ir)relevance of search results.
- ANSWER: Your final answer, or a polite refusal if no relevant information is found.
- CITATION: At least one supporting article (if applicable).
`

const TOOLS = [
          {
            name: "fetch_articles_remote",
            description: "Fetch the full content of an article by its file_id",
            parameters: {
                type: "object",
                properties: {
                  file_id: {
                      type: "string",
                      description: "The file_id of the article to retrieve content for",
                  },
            },
            required: ["file_id"],
            }
          },
          {
            name: "query_articles",
            description: "Query the articles based on a question",
            parameters: {
                type: "object",
                properties: {
                    question: {
                        type: "string",
                        description: "The user's question to search articles for",
                    },
                },
                required: ["question"],
                }
            }
        ];


let cachedStoreId: string | null = null;
async function getStoreId(openai: OpenAI) {
  if (cachedStoreId) return cachedStoreId;

  const stores = await openai.vectorStores.list();
  const store = stores.data.find(s => s.name === "Law Stuff");
  if (!store) {
    throw new Error("Vector store 'Law Stuff' not found");
  }
  cachedStoreId = store.id;
  return cachedStoreId;
}


export default async function generate_answer(messages: ChatMessage[]) {
    const openai = new OpenAI();
		const storeId = await getStoreId(openai);


    async function fetch_articles_remote(file_id: any) {
      const fileContent = await openai.vectorStores.files.content(file_id, {vector_store_id: storeId});
      const text = fileContent.data
        .map(chunk => chunk.text)
        .join("\n");
      
      return text;
    };

    async function query_articles(question: string) {
      const docs = await openai.vectorStores
        .search(storeId, {
          query: question,
        })
        .then((r) => r.data);
      return JSON.stringify(
        docs.map((doc) => ({
          code: doc.attributes!.code,
          title: doc.attributes!.title,
          breadcrumb: doc.attributes!.breadcrumb,
          score: doc.score,
          file_id: doc.file_id,
        })),
        null,
        1,
      );
    }

    // Map tool calls to actual functions
    async function executeToolCall(tool_call: AiTextGenerationToolOutput | AiTextGenerationToolLegacyOutput) {
        try {
            const name = tool_call?.function?.name || tool_call?.name || "unknown_tool";
            const raw_args = tool_call?.function?.arguments || tool_call?.arguments || "{}";
            
            let args;
            if (typeof raw_args === "string") {
              try {
                args = JSON.parse(raw_args);
              } catch (e) {
                throw new Error(`Invalid JSON in tool arguments: ${raw_args}`);
              }
            } else if (typeof raw_args === "object") {
              args = raw_args;
            } else {
              throw new Error(`Unexpected format for tool arguments: ${raw_args}`);
            }

            
            let tool_res= '';
            if (name === "fetch_articles_remote") {
                tool_res = await fetch_articles_remote(args.file_id);
            } else if (name === "query_articles") {
                tool_res = await query_articles(args.question);
            } else {
                console.error(`Unknown tool call: ${name}`);
            }
            
            return {
              name: name,
              response: tool_res,
            }
          } catch (e) {
            return `Error executing tool: ${e}`;
        }

    }

    
    // Add system prompt if not present
		if (!messages.some((msg) => msg.role === "system")) {
			messages.unshift({ role: "system", content: SYSTEM_PROMPT });
		}

    // Start actually making the calls/response
    const MODEL_ID = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    const response = await env.AI.run(
      MODEL_ID,
      {
        messages: messages,
        tools: TOOLS,
      },
    );


    let selected_tools = response.tool_calls ?? [];
    let loop_count = 0;
    while (selected_tools.length > 0 && loop_count < 4) { // prevent infinite loops, max 20 messages
      for (const tool_call of selected_tools) {
        const tool_response = await executeToolCall(tool_call);
        messages.push({
            role: "tool",
            content: JSON.stringify({
                name: tool_response.name,
                response: tool_response.response,
            }),
        });
      }

      let next_response = await env.AI.run(
        MODEL_ID,
        {
          messages: messages,
          tools: TOOLS,
        }
      )
      selected_tools = next_response.tool_calls ?? [];
      loop_count++;
    }


    const finalResponse = await env.AI.run(
      MODEL_ID,
      {
        messages: messages,
        tools: TOOLS,
        stream: true
      },
    );

    return finalResponse;
};
