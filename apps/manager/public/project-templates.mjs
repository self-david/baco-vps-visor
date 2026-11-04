export const projectTemplates = [
  {
    id: "html-vanilla",
    name: "plantilla-html-vanilla",
    label: "HTML vanilla",
    description: "Sitio estático servido con Nginx.",
    deploymentType: "static",
    files: [
      {
        name: "index.html",
        type: "text/html",
        content: `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Proyecto HTML vanilla desplegado con VPS Manager.">
    <title>Mi proyecto</title>
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <main>
      <p class="eyebrow">VPS MANAGER</p>
      <h1>Tu proyecto ya está en línea</h1>
      <p>Esta plantilla usa HTML, CSS y JavaScript vanilla; no necesita dependencias ni un proceso de build.</p>
      <button id="check-status" type="button">Probar JavaScript</button>
      <p id="status" role="status">La página se sirve con Nginx.</p>
    </main>
    <script src="/app.js"></script>
  </body>
</html>
`,
      },
      {
        name: "styles.css",
        type: "text/css",
        content: `:root {
  color-scheme: light;
  font-family: system-ui, sans-serif;
  color: #172033;
  background: #f3f6fb;
}

body {
  display: grid;
  min-height: 100vh;
  margin: 0;
  place-items: center;
}

main {
  width: min(42rem, calc(100% - 3rem));
  padding: 2rem;
  border: 1px solid #dbe3f0;
  border-radius: 1rem;
  background: white;
  box-shadow: 0 1rem 3rem #15234214;
}

.eyebrow {
  color: #345dba;
  font-size: .8rem;
  font-weight: 700;
  letter-spacing: .12em;
}

button {
  padding: .7rem 1rem;
  border: 0;
  border-radius: .5rem;
  color: white;
  background: #345dba;
  cursor: pointer;
}
`,
      },
      {
        name: "app.js",
        type: "text/javascript",
        content: `const status = document.querySelector("#status");
document.querySelector("#check-status").addEventListener("click", () => {
  status.textContent = "JavaScript vanilla funciona correctamente.";
});
`,
      },
    ],
  },
  {
    id: "node-no-dependencies",
    name: "plantilla-node-sin-dependencias",
    label: "Node sin dependencias",
    description: "Servidor HTTP usando únicamente el módulo integrado node:http.",
    deploymentType: "dynamic",
    files: [
      {
        name: "server.js",
        type: "text/javascript",
        content: `const http = require("node:http");

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const server = http.createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ status: "ok", runtime: "node" }));
    return;
  }

  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end("<!doctype html><html lang=\\"es\\"><meta charset=\\"utf-8\\"><title>Node listo</title><h1>Node funciona</h1><p>Servidor HTTP sin dependencias externas.</p><a href=\\"/health\\">Comprobar estado</a></html>");
});

server.listen(port, "0.0.0.0", () => {
  console.log(\`Servidor Node escuchando en 0.0.0.0:\${port}\`);
});
`,
      },
    ],
  },
  {
    id: "python-no-dependencies",
    name: "plantilla-python-sin-dependencias",
    label: "Python sin dependencias",
    description: "Servidor HTTP usando únicamente módulos de la biblioteca estándar.",
    deploymentType: "dynamic",
    files: [
      {
        name: "main.py",
        type: "text/x-python",
        content: `import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            body = json.dumps({"status": "ok", "runtime": "python"}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
        else:
            body = (
                "<!doctype html><html lang=\\"es\\"><meta charset=\\"utf-8\\">"
                "<title>Python listo</title><h1>Python funciona</h1>"
                "<p>Servidor HTTP sin dependencias externas.</p>"
                "<a href=\\"/health\\">Comprobar estado</a></html>"
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print("%s - %s" % (self.address_string(), format % args))


port = int(os.environ.get("PORT", "3000"))
server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
print(f"Servidor Python escuchando en 0.0.0.0:{port}", flush=True)
server.serve_forever()
`,
      },
    ],
  },
];
