#!/usr/bin/env node
import { program } from "commander"
import path from "path"
import compiler from "../src/index.js"
import "colors"
import express from "express"
import ws from "express-ws"
import fs from "fs"
import defaultConfig from "../defaultConfig.js"
import { parse } from "node-html-parser"
import chokidar from "chokidar"

const packageJSON = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")
)

const log = {
  info(...args) {
    console.log("[INFO]".bold.cyan, ...args)
  },
  sucess(...args) {
    console.log("[DONE]".bold.green, ...args)
  },
  error(...args) {
    console.error("[FAIL]".bold.red, ...args)
  },
}

program
  .name(packageJSON.name)
  .description(packageJSON.description)
  .version(packageJSON.version)

function mergeDeep(target, ...sources) {
  function isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item)
  }
  if (!sources.length) return target
  const source = sources.shift()

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} })
        mergeDeep(target[key], source[key])
      } else {
        Object.assign(target, { [key]: source[key] })
      }
    }
  }

  return mergeDeep(target, ...sources)
}

program
  .command("build")
  .description("Creates a production build")
  .argument("[file]", "Name of input file", "./index.html")
  .option("-c, --config <file>", "Path to JSON config file")
  .action(async (file, { config }) => {
    if (config) {
      await build(
        file,
        mergeDeep(
          defaultConfig,
          JSON.parse(fs.readFileSync(path.join(process.cwd(), config), "utf8"))
        )
      )
    } else await build(file, defaultConfig)
  })

program
  .command("dev")
  .description("Launches the development server")
  .argument("[file]", "Name of input file", "./index.html")
  .option("-c, --config <file>", "Path to JSON config file")
  .action(async (f, { config }) => {
    const conf = config
      ? mergeDeep(
          defaultConfig,
          JSON.parse(fs.readFileSync(path.join(process.cwd(), config), "utf8"))
        )
      : defaultConfig
    const baseDir = path.dirname(path.join(process.cwd(), f))

    const app = express()
    ws(app)

    app.get("/", (_, res) => {
      const contents = fs.readFileSync(
        path.join(process.cwd(), conf.output.dir, conf.output.html),
        "utf8"
      )
      const parsed = parse(contents)
      parsed
        .getElementsByTagName("body")[0]
        .insertAdjacentHTML(
          "beforeend",
          `<script>/* code inserted by lyke */ ;(function(){const s=new WebSocket(\`ws://\${window.location.host}/refresh\`);s.onopen=()=>console.log("[lyke] live reload enabled");s.onmessage=()=>window.location.reload()})();</script>`
        )
      res.send(parsed.toString())
    })
    app.use(express.static(path.join(process.cwd(), conf.output.dir)))

    let lastCall = Date.now(),
      timeout = 500
    let update = () => {}
    chokidar.watch(baseDir).on("change", async () => {
      if (Date.now() - lastCall < timeout) return
      lastCall = Date.now()
      await build(f, conf, true)
      update()
    })
    app.ws("/refresh", (ws) => {
      update = () => ws.send("refresh")
    })

    app.listen(conf.devServer.port, async () => {
      log.info(
        `lyke dev server started on http://localhost:${conf.devServer.port}`
      )
      // initial compile
      await build(f, conf, true)
    })
  })

program.parse()

async function build(file, config, dev = false) {
  log.info(`Compiling ${file.bold}...`)
  const start = Date.now()

  let data
  try {
    data = await compiler(path.join(process.cwd(), file), config, dev)
  } catch (e) {
    log.error(`Compilation failed: ${e.message}`)
    throw new Error(e)
  }

  log.sucess(
    `✨ Compiled ${data.fileCount.toString().bold} file${
      data.fileCount - 1 ? "s" : ""
    } in ${Date.now() - start}ms`
  )
}
