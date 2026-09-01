#!/usr/bin/env node
// npx web-audio-api <example> [...args] — run any packaged example CLI.
import { examples } from './examples/catalog.js'

let [name, ...rest] = process.argv.slice(2)
let known = examples.find(example => example.id === name)

if (!known) {
  if (name && name !== '--help' && name !== '-h') console.error(`Unknown example: ${name}\n`)
  console.log('Usage: npx web-audio-api <example> [...args]\n')
  let width = Math.max(...examples.map(example => example.id.length))
  for (let example of examples) console.log(`  ${example.id.padEnd(width)}  ${example.description}`)
  console.log('\nEvery example accepts --help for its options.')
  process.exit(known ? 0 : name ? 1 : 0)
}

process.argv = [process.argv[0], new URL(`./examples/${name}.js`, import.meta.url).pathname, ...rest]
await import(`./examples/${name}.js`)
