"use strict"

const execa = require("execa")
const fs = require("fs-extra")
const ignorePaths = require("./ignore-paths.js")
const path = require("path")
const trash = require("./trash.js")

const argv = require("yargs")
  .boolean("prod")
  .argv

const isWin = process.platform === "win32"

const rootPath = path.resolve(__dirname, "..")
const buildPath = path.resolve(rootPath, "build")
const gzipPath = path.resolve(rootPath, "esm.js.gz")
const nodeModulesPath = path.resolve(rootPath, "node_modules")
const testPath = path.resolve(rootPath, "test")
const envPath = path.resolve(testPath, "env")

const trashPaths = ignorePaths
  .filter((thePath) =>
    thePath !== nodeModulesPath &&
    thePath !== gzipPath &&
    ! thePath.startsWith(buildPath)
  )

const HOME = path.resolve(envPath, "home")
const MOCHA_BIN = path.resolve(rootPath, "node_modules/mocha/bin/_mocha")
const NODE_BIN = path.resolve(envPath, "prefix", isWin ? "node.exe" : "bin/node")

const NODE_ENV =
  (argv.prod ? "production" : "development") +
  "-test"

const NODE_PATH = [
  path.resolve(envPath, "node_path"),
  path.resolve(envPath, "node_path/relative")
].join(path.delimiter)

const nodeArgs = []

if (process.env.HARMONY) {
  nodeArgs.push("--harmony")
}

nodeArgs.push(
  MOCHA_BIN,
  "--full-trace",
  "--require", "../index.js",
  "tests.mjs"
)

function cleanRepo() {
  return Promise.all(trashPaths.map(trash))
}

function runTests(cached) {
  return execa(NODE_BIN, nodeArgs, {
    cwd: testPath,
    env: {
      HOME,
      NODE_ENV: NODE_ENV + (cached ? "cached" : ""),
      NODE_PATH,
      USERPROFILE: HOME
    },
    stdio: "inherit"
  })
  .catch((e) => process.exit(e.code))
}

function setupNode() {
  const basePath = path.resolve(NODE_BIN, isWin ? "" : "..")
  return trash(basePath)
    .then(() => fs.ensureLink(process.execPath, NODE_BIN))
}

Promise
  .all([
    cleanRepo(),
    setupNode()
  ])
  .then(() => runTests())
  .then(() => runTests(true))
