# Flightradar24 MCP Server for Cloud Run

A lightweight, secure Dockerized proxy that allows the official [Flightradar24 MCP Server](https://fr24api.flightradar24.com/docs/mcp-server) to run as a remote HTTP service. 

By default, the official FR24 server operates over `stdio` (Standard Input/Output), which requires the server to be run locally by the client. This repository wraps the server using `mcp-proxy` to expose it over **Server-Sent Events (SSE)** and **Streamable HTTP**. This allows it to be deployed to container hosting platforms like **Google Cloud Run** and accessed remotely by any MCP-compatible AI agent.

## Features
- **Client-Provided API Keys**: The server acts as a stateless passthrough. It does not store your FR24 API key; instead, clients must provide their own API key via HTTP headers.
- **Distroless Container**: Built on a Debian 12 distroless Node.js image to vastly reduce the attack surface.
- **Cloud Run Ready**: Honors the `$PORT` environment variable and binds gracefully, intercepting `SIGTERM` for proper shutdown.

---

## 🛠 Building & Running Locally

### 1. Build the Docker Image
```bash
docker build -t fr24-mcp-cloudrun .
```

### 2. Run the Container
You don't need to pass the API key to the container. It will listen on port `8080`.
```bash
docker run -d -p 8080:8080 --name fr24-server fr24-mcp-cloudrun
```

### 3. Test the Endpoint
You can verify the connection by passing your API key via the `FR24-API-KEY` header:
```bash
curl -v -H "FR24-API-KEY: YOUR_FR24_API_KEY" http://localhost:8080/sse
```

---

## 🚀 Deploying to Google Cloud Run

You can deploy this directly to Cloud Run using the Google Cloud CLI:

```bash
gcloud run deploy fr24-mcp-server 
  --source . 
  --region us-central1 
  --allow-unauthenticated 
  --port 8080
```
*Note down the resulting URL (e.g., `https://fr24-mcp-server-hash.a.run.app`). Your SSE endpoint will be this URL with `/sse` appended.*

---

## 🔌 Connecting Clients (Gemini CLI & ADK Agents)

Because this server operates over HTTP/SSE rather than `stdio`, you must configure your MCP client (like Gemini CLI or ADK Agent) to use an **SSE Transport** and pass your Flightradar24 API key via headers.

### Gemini CLI Configuration
In your Gemini CLI workspace or global configuration (usually located in `.gemini/mcp.json` or your MCP registry), add the server as an SSE connection. You must provide the `FR24-API-KEY` header.

```json
{
  "mcpServers": {
    "flightradar24": {
      "type": "sse",
      "url": "https://YOUR_CLOUDRUN_URL/sse",
      "headers": {
        "FR24-API-KEY": "YOUR_FR24_API_KEY"
      }
    }
  }
}
```
*(If running locally, replace `url` with `http://localhost:8080/sse`)*

### ADK Agent Configuration
If you are building an agent using a standard Model Context Protocol (MCP) TypeScript or Python client SDK, initialize the client using the SSE transport and provide the authorization header:

**TypeScript / Node.js:**
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const transport = new SSEClientTransport(
  new URL("https://YOUR_CLOUDRUN_URL/sse"), 
  {
    headers: {
      "FR24-API-KEY": "YOUR_FR24_API_KEY"
      // Alternatively, use "Authorization": "Bearer YOUR_FR24_API_KEY"
    }
  }
);

const client = new Client(
  { name: "adk-agent-client", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

await client.connect(transport);
console.log("Connected to Flightradar24 remote MCP!");
```

**Python:**
```python
import asyncio
from mcp import ClientSession
from mcp.client.sse import sse_client

async def main():
    url = "https://YOUR_CLOUDRUN_URL/sse"
    headers = {"FR24-API-KEY": "YOUR_FR24_API_KEY"}
    
    async with sse_client(url, headers=headers) as streams:
        async with ClientSession(streams[0], streams[1]) as session:
            await session.initialize()
            
            # Fetch available tools
            tools = await session.list_tools()
            print("Available FR24 Tools:", tools)

asyncio.run(main())
```
