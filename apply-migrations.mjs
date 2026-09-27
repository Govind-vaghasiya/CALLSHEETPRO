#!/usr/bin/env node
/**
 * apply-migrations.mjs
 * Applies all SQL migrations to Supabase using the Management API.
 * Run: node apply-migrations.mjs
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Credentials come from .env.local (never commit keys into source)
for (const line of readFileSync(join(__dirname, '.env.local'), 'utf-8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
}

async function runSQL(sql, description) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  })

  if (!response.ok) {
    // Try the pg endpoint
    const response2 = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    })

    if (!response2.ok) {
      const text = await response2.text()
      throw new Error(`Failed to run "${description}": ${text}`)
    }
    return await response2.json()
  }
  return await response.json()
}

async function applyMigrations() {
  const migrationsDir = join(__dirname, 'supabase', 'migrations')
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort()

  console.log(`\n🎬 CallSheetPro — Applying ${files.length} migrations\n`)

  for (const file of files) {
    const filePath = join(migrationsDir, file)
    const sql = readFileSync(filePath, 'utf-8')
    process.stdout.write(`  ⏳ ${file}...`)
    try {
      await runSQL(sql, file)
      console.log(` ✅`)
    } catch (err) {
      console.log(` ❌`)
      console.error(`     Error: ${err.message}`)
      console.error(`     Continuing to next migration...\n`)
    }
  }

  console.log('\n✅ Migration run complete.\n')
}

applyMigrations().catch(console.error)
