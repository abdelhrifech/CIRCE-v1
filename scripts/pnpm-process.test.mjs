import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commandePnpm, commandeArretWindows } from './pnpm-process.mjs'

test('EX-TRA-START-001 Windows : arguments et chemins avec espaces transmis sans shell', () => {
  const dir = mkdtempSync(join(tmpdir(), 'circe windows '))
  try {
    const cli = join(dir, 'pnpm.cjs')
    writeFileSync(cli, '')
    const args = ['--user=profil avec espaces & texte', 'start']
    const cmd = commandePnpm(args, { npm_execpath: cli }, 'win32')
    assert.equal(cmd.command, process.execPath)
    assert.deepEqual(cmd.args, [cli, ...args])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
test('EX-TRA-START-001 Windows : retrouver pnpm installé par npm quand le lancement vient de npm start', () => {
  const dir = mkdtempSync(join(tmpdir(), 'circe pnpm '))
  try {
    const bin = join(dir, 'node_modules/pnpm/bin')
    mkdirSync(bin, { recursive: true })
    const cli = join(bin, 'pnpm.cjs')
    writeFileSync(cli, '')
    assert.deepEqual(commandePnpm(['db:up'], { Path: dir }, 'win32'), {
      command: process.execPath,
      args: [realpathSync(cli), 'db:up'],
    })
    assert.throws(() => commandePnpm([], { Path: '' }, 'win32'), /pnpm introuvable/)
    assert.deepEqual(commandeArretWindows(123).args, ['/pid', '123', '/T', '/F'])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
