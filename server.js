const http = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const {
  PlannerError,
  buildAssistantMessages,
  buildPlannerMessages,
  parseAndValidatePlan,
  validateAssistantRequest,
  validateAssistantResponse,
  validatePlannerRequest
} = require("./planner");

const ROOT = __dirname;
const MAX_BODY_BYTES = 64 * 1024;
const STATIC_FILES = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/features.js": ["features.js", "text/javascript; charset=utf-8"]
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(data));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let oversized = false;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        oversized = true;
        return;
      }
      if (!oversized) chunks.push(chunk);
    });
    request.on("end", () => {
      if (oversized) {
        reject(new PlannerError("La solicitud es demasiado grande.", 413));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new PlannerError("El cuerpo de la solicitud debe ser JSON válido."));
      }
    });
    request.on("error", reject);
  });
}

async function createPlan(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Usa POST para crear un plan." });
    return;
  }

  try {
    const input = validatePlannerRequest(await readJson(request));
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new PlannerError("El servicio de IA no está configurado. Añade OPENAI_API_KEY en el entorno del servidor.", 503);
    }

    const apiResponse = await fetch(process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: buildPlannerMessages(input),
        response_format: { type: "json_object" },
        temperature: 0.4
      })
    });

    if (!apiResponse.ok) {
      console.error(`El proveedor de IA respondió con estado ${apiResponse.status}.`);
      throw new PlannerError("No se pudo generar el plan con el servicio de IA. Intenta de nuevo más tarde.", 502);
    }

    const data = await apiResponse.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (typeof content !== "string") {
      throw new PlannerError("El servicio de IA devolvió una respuesta vacía.", 502);
    }
    sendJson(response, 200, parseAndValidatePlan(content, input));
  } catch (error) {
    if (error instanceof PlannerError) {
      sendJson(response, error.statusCode, { error: error.message });
      return;
    }
    console.error("Error al crear el plan:", error);
    sendJson(response, 502, { error: "No se pudo conectar con el servicio de IA. Intenta de nuevo." });
  }
}

async function askAssistant(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { error: "Usa POST para consultar al asistente." });
    return;
  }

  try {
    const input = validateAssistantRequest(await readJson(request));
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new PlannerError("El servicio de IA no está configurado. Añade OPENAI_API_KEY en el entorno del servidor.", 503);
    }

    const apiResponse = await fetch(process.env.OPENAI_API_URL || "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: buildAssistantMessages(input),
        temperature: 0.4,
        max_tokens: 500
      })
    });

    if (!apiResponse.ok) {
      console.error(`El proveedor de IA respondió con estado ${apiResponse.status}.`);
      throw new PlannerError("No se pudo consultar al asistente. Intenta de nuevo más tarde.", 502);
    }

    const data = await apiResponse.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    sendJson(response, 200, validateAssistantResponse(content));
  } catch (error) {
    if (error instanceof PlannerError) {
      sendJson(response, error.statusCode, { error: error.message });
      return;
    }
    console.error("Error al consultar al asistente:", error);
    sendJson(response, 502, { error: "No se pudo conectar con el asistente. Intenta de nuevo." });
  }
}

async function handleRequest(request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/api/plan") {
    await createPlan(request, response);
    return;
  }
  if (pathname === "/api/assistant") {
    await askAssistant(request, response);
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "Método no permitido." });
    return;
  }

  const asset = STATIC_FILES[pathname];
  if (!asset) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("No encontrado");
    return;
  }
  try {
    const content = await readFile(path.join(ROOT, asset[0]));
    response.writeHead(200, {
      "Content-Type": asset[1],
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    console.error("No se pudo servir el archivo solicitado:", error);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Error interno");
  }
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error("Error inesperado en el servidor:", error);
    if (!response.headersSent) sendJson(response, 500, { error: "Ocurrió un error interno." });
    else response.destroy();
  });
});

const port = Number(process.env.PORT) || 3000;
server.listen(port, process.env.HOST || "127.0.0.1", () => {
  console.log(`FOCUS está disponible en http://${process.env.HOST || "127.0.0.1"}:${port}`);
});
