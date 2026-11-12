const { app, net } = require("electron");
const fs = require("fs");
const log = (s) => fs.appendFileSync("ua-out.txt", s + "\n");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
app.whenReady().then(async () => {
  fs.writeFileSync("ua-out.txt", "");
  const urls = ["https://www.reddit.com", "https://www.avito.ru", "https://www.ozon.ru"];
  for (const url of urls) {
    for (const mode of ["default-UA", "browser-UA"]) {
      await new Promise((res) => {
        const opts = { method: "GET", url, redirect: "follow" };
        if (mode === "browser-UA") opts.headers = { "User-Agent": UA };
        const r = net.request(opts);
        r.on("response", (resp) => {
          resp.on("data", () => {});
          resp.on("end", () => { log(url + " [" + mode + "] => " + resp.statusCode); res(); });
        });
        r.on("error", (e) => { log(url + " [" + mode + "] => ERROR " + e.message); res(); });
        r.end();
      });
    }
  }
  app.quit();
});
