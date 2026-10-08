import http from "node:http";
import { readFile } from "node:fs/promises";
const root = new URL("./", import.meta.url);
const files = {
  "/": "index.html",
  "/index.html": "index.html",
  "/styles.css": "styles.css",
  "/app.js": "app.js",
  "/replies.js": "replies.js",
};
const types = { html: "text/html", css: "text/css", js: "text/javascript" };
const port = Number(process.env.PORT || 3000);
const server = http.createServer(async (request, response) => {
  const path = new URL(request.url, "http://localhost").pathname;
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  const file = files[path];
  if (!file) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  try {
    const body = await readFile(new URL(file, root));
    response.writeHead(200, {
      "Content-Type": `${types[file.split(".").pop()]}; charset=utf-8`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(500);
    response.end("Could not load demo file");
  }
});
server.on("error", (error) => {
  console.error(
    `Could not start demo: ${error.message}. Try a different PORT.`,
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(`Talking Object is ready at http://localhost:${port}`),
);
