const http = require("http");
const fs = require("fs");
const path = require("path");
const m = { js: "application/javascript", css: "text/css", html: "text/html", png: "image/png", svg: "image/svg+xml", ico: "image/x-icon", json: "application/json" };
http.createServer((q, r) => {
  let url = q.url.split("?")[0].split("#")[0].replace(/\/$/, "") || "/";
  let f = path.join("out", url);
  const isFile = (p) => { try { return fs.statSync(p).isFile() } catch { return false } };
  if (!isFile(f)) { let t = path.join("out", url + ".html"); if (isFile(t)) f = t; }
  if (!isFile(f)) { let t = path.join("out", url, "index.html"); if (isFile(t)) f = t; }
  if (!isFile(f)) { r.writeHead(404); r.end("Not found"); return; }
  const ext = path.extname(f).slice(1);
  r.writeHead(200, { "Content-Type": m[ext] || "text/plain" });
  fs.createReadStream(f).pipe(r);
}).listen(3000, () => console.log("http://localhost:3000"));
