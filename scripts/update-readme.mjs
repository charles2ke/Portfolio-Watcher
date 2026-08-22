#!/usr/bin/env node
/**
 * Regenerates the auto-managed sections of README.md from package.json and the
 * latest coverage summary. Run with `npm run readme`.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readmePath = join(root, 'README.md')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

function section(name, body) {
  return `<!-- ${name}:start -->\n${body}\n<!-- ${name}:end -->`
}

function replaceSection(content, name, body) {
  const pattern = new RegExp(`<!-- ${name}:start -->[\\s\\S]*?<!-- ${name}:end -->`)
  if (!pattern.test(content)) {
    throw new Error(`README is missing the "${name}" markers`)
  }
  return content.replace(pattern, section(name, body))
}

const scripts = [
  '| Script | Description |',
  '| --- | --- |',
  ...Object.entries(pkg.scripts).map(
    ([name, command]) => `| \`npm run ${name}\` | \`${command}\` |`,
  ),
].join('\n')

const dependencies = [
  '| Package | Version |',
  '| --- | --- |',
  ...Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, version]) => `| ${name} | ${version} |`),
].join('\n')

const summaryPath = join(root, 'coverage', 'coverage-summary.json')
let coverage = '_Run `npm run coverage` to generate the coverage summary._'
if (existsSync(summaryPath)) {
  const total = JSON.parse(readFileSync(summaryPath, 'utf8')).total
  coverage = [
    '| Metric | Coverage |',
    '| --- | --- |',
    ...['statements', 'branches', 'functions', 'lines'].map(
      (metric) => `| ${metric} | ${total[metric].pct}% |`,
    ),
  ].join('\n')
}

let content = readFileSync(readmePath, 'utf8')
content = replaceSection(content, 'scripts', scripts)
content = replaceSection(content, 'dependencies', dependencies)
content = replaceSection(content, 'coverage', coverage)
writeFileSync(readmePath, content)
console.log('README.md updated')
