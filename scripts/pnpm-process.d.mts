export function commandePnpm(
  args: string[],
  env?: NodeJS.ProcessEnv,
  platform?: NodeJS.Platform,
): { command: string; args: string[] }
export function commandeArretWindows(
  pid: number,
  env?: NodeJS.ProcessEnv,
): { command: string; args: string[] }
