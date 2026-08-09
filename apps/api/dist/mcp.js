"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stdio_1 = require("@modelcontextprotocol/server/stdio");
const mcp_server_js_1 = require("./mcp-server.js");
(0, stdio_1.serveStdio)(() => (0, mcp_server_js_1.createMcpServer)());
