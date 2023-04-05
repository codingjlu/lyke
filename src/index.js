import fs from "fs/promises"
import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "fs"
import path from "path"
import { minify } from "minify"
import beautify from "js-beautify"
import { parse } from "node-html-parser"
import defaultConfig from "../defaultConfig.js"

function copyRecursiveSync(src, dest) {
  const exists = existsSync(src)
  if (!exists) return
  const stats = exists && statSync(src)
  const isDirectory = exists && stats.isDirectory()
  if (isDirectory) {
    mkdirSync(dest)
    readdirSync(src).forEach(function (childItemName) {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      )
    })
  } else {
    copyFileSync(src, dest)
  }
}

export default async function lyke(
  inputPath,
  config = defaultConfig,
  dev = false
) {
  const root = await fs.readFile(inputPath, "utf8")
  const data = await processData(root, inputPath, dev)

  const dirPath = path.join(process.cwd(), config.output.dir)
  if (!existsSync(dirPath)) mkdirSync(dirPath)

  const htmlOutputPath = path.join(dirPath, config.output.html)
  const cssOutputPath = path.join(dirPath, config.output.css)
  const jsOutputPath = path.join(dirPath, config.output.js)

  const writes = []

  // insert script and link tags for CSS and JS
  const parsedHTML = parse(data.html)
  if (data.js.trim().length) {
    writes.push([jsOutputPath, data.js])
    parsedHTML
      .getElementsByTagName("body")[0]
      .insertAdjacentHTML(
        "beforeend",
        `<script src="${config.output.js}"></script>`
      )
  }
  if (data.css.trim().length) {
    writes.push([cssOutputPath, data.css])
    parsedHTML
      .getElementsByTagName("head")[0]
      .insertAdjacentHTML(
        "beforeend",
        `<link rel="stylesheet" type="text/css" href="${config.output.css}"/>`
      )
  }

  data.html = parsedHTML.toString()
  writes.push([htmlOutputPath, data.html])

  await Promise.all(
    writes.map(([path, content]) => fs.writeFile(path, content))
  )

  // copy assets directory
  copyRecursiveSync(
    path.join(process.cwd(), config.assets),
    path.join(process.cwd(), config.output.dir, config.output.assets)
  )

  return data
}

async function processData(data, inputPath, dev) {
  const rootPath = inputPath
  let fileCount = 0
  let js = "",
    css = ""

  let html = await (async function go(data, inputPath) {
    const root = parse(data)

    // convert filename to posix style then remove extension
    const filePath = path
      .relative(rootPath, inputPath)
      .split(path.sep)
      .join(path.posix.sep)
      .replace(/\.[^/.]+$/, "")

    // extract javascript
    const scripts = root.getElementsByTagName("script")
    let scriptContent = ""
    scripts.forEach((script) => {
      scriptContent += "\n" + script.innerHTML.trim()
      script.remove()
    })
    if (scriptContent.trim().length)
      js += `;(function(){\n// File: ${filePath}.js\n${scriptContent.trim()}})()`

    // extract css
    const styles = root.getElementsByTagName("style")
    let styleContent = ""
    styles.forEach((style) => {
      styleContent += "\n" + style.innerHTML.trim()
      style.remove()
    })
    if (styleContent.trim().length)
      css += `/* Begin: ${filePath}.css */\n${styleContent.trim()}\n/* End: ${filePath}.css */`

    data = root.toString()

    // resolve includes
    const filenames = []
    const patt = /{{"?.*?"?}}/g
    data.replace(patt, (match) =>
      filenames.push(
        path.join(
          path.dirname(inputPath),
          match.replace(/^{{"?/, "").replace(/"?}}/, "")
        )
      )
    )
    fileCount += filenames.length
    const resolved = await Promise.all(
      (
        await Promise.all(
          filenames.map((filename) =>
            fs.readFile(
              filename + (filename.endsWith(".html") ? "" : ".html"),
              "utf8"
            )
          )
        )
      ).map((content, i) => go(content, filenames[i]))
    )
    return data.replace(patt, () => resolved.shift()).trim()
  })(data, inputPath)

  // format or minify code
  if (!dev) {
    html = await minify.html(html, {
      html: {
        removeOptionalTags: false,
        removeAttributeQuotes: false,
        removeTagWhitespace: false,
      },
    })
    css = css ? await minify.css(css) : css
    js = js ? await minify.js(js) : js
  } else {
    html = beautify.html(html)
    css = css ? beautify.css(css) : css
    js = js ? beautify.js(js) : js
  }

  return { html, js, css, fileCount }
}
