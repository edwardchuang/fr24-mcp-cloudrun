import { startHTTPServer } from "mcp-proxy";
import { createServer } from "@flightradar24/fr24api-mcp/build/src/server.js";

// Cloud Run injects PORT environment variable
const PORT = parseInt(process.env.PORT || "8080");

console.log(`Starting FR24 MCP Server proxy on port ${PORT}...`);
console.log(`Expecting clients to provide their API key via 'FR24-API-KEY' or 'Authorization: Bearer <key>' header.`);

// Start HTTP server for Cloud Run with SSE and Streamable HTTP support
startHTTPServer({
  createServer: async (req) => {
    // Extract API key from headers (Node.js lowercases all headers)
    let apiKey = req.headers['fr24-api-key'] || req.headers['fr24_api_key'];
    
    if (!apiKey && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
            apiKey = authHeader.substring(7);
        }
    }

    if (!apiKey) {
        console.error("Connection rejected: Missing API key in headers");
        throw new Error("Unauthorized: API key must be provided via 'FR24-API-KEY' or 'Authorization: Bearer' header");
    }

    // Initialize a new FR24 MCP server instance for this client connection
    const fr24Mcp = createServer(apiKey);
    
    // Return the underlying @modelcontextprotocol/sdk Server instance
    return fr24Mcp.server;
  },
  port: PORT,
  cors: {
    allowedHeaders: "*" // Allow clients to send X-Api-Key and Authorization headers
  },
  stateless: false // Cloud Run supports concurrent requests
}).then(({ close }) => {
    console.log(`Successfully started server on port ${PORT}`);
    console.log(`- SSE Endpoint: /sse`);
    console.log(`- Stream Endpoint: /mcp`);

    // Handle graceful shutdown for Cloud Run
    process.on('SIGTERM', () => {
        console.log('SIGTERM received, shutting down gracefully...');
        close();
        process.exit(0);
    });
}).catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});
