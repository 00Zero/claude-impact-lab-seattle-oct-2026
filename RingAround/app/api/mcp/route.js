import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/cfworker";
import { z } from "zod";
import { CALL_STATUSES, reportProviderCall } from "@/lib/db";

// MCP server the agent calls to report each business it contacts, so the
// request page can show calls as structured rows. Only the agent may call it:
// it presents MCP_TOKEN as a bearer token, which the agent's vault holds.
// Stateless: every POST is a self-contained JSON-RPC exchange.

const encoder = new TextEncoder();

// Compares without leaking where the first difference is.
function sameSecret(a, b) {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

function authorized(request) {
  const expected = process.env.MCP_TOKEN;
  const header = request.headers.get("authorization") ?? "";
  return Boolean(expected) && header.startsWith("Bearer ") && sameSecret(header.slice(7), expected);
}

function createServer() {
  const server = new McpServer(
    { name: "ringaround", version: "1.0.0" },
    { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() },
  );
  server.registerTool(
    "report_call",
    {
      title: "Report a business call",
      description:
        "Record your latest status for one business on a RingAround request, so the customer can follow along. " +
        'Report "queued" when you shortlist a business, "calling" right before you dial, then "quoted", "retry" or ' +
        '"declined". If reporting "calling" returns an error, the request\'s call cap is reached: do not place the call.',
      inputSchema: {
        request_ref: z.string().regex(/^req_[a-f0-9]{16}$/).describe("The request reference from the brief, e.g. req_0123456789abcdef"),
        business: z.string().trim().min(1).max(120).describe("Business name as the customer would recognize it"),
        phone: z.string().trim().max(40).optional().describe("Number you called or will call"),
        status: z.enum(CALL_STATUSES),
        detail: z
          .string()
          .trim()
          .max(200)
          .describe('One line for the customer, e.g. "$320 flat · Fri 8–11am · supplies included" or "Voicemail · retrying at 2:00pm"'),
      },
    },
    async ({ request_ref, business, phone, status, detail }) => {
      const result = await reportProviderCall(request_ref, { business, phone, status, detail });
      if (result.error) return { isError: true, content: [{ type: "text", text: result.error }] };
      return {
        content: [{ type: "text", text: `Recorded ${business}: ${status}. ${result.callsPlaced} of ${result.callCap} calls placed.` }],
      };
    },
  );
  return server;
}

export async function POST(request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

// Stateless: no server-initiated stream to open and no session to end.
export function GET() {
  return new Response("Method not allowed", { status: 405, headers: { allow: "POST" } });
}

export const DELETE = GET;
