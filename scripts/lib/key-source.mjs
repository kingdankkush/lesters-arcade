// Secret input for operator and deploy tooling (contract §11 rule 13).
//
// Scripts read keys and secrets ONLY inside the process, from one of:
//   --key-env <NAME>                         the value of the environment variable NAME
//   --key-file <path> --key-field <field>    one field of a JSON file (dotted paths allowed; when the
//                                            field is an object with a `privateKey`, that is used)
//   --key-file <path>                        a plain-text file holding only the value (no field flag)
// The flag names are configurable per secret (live-cron uses --secret-env / --secret-file).
//
// readSecret() returns the value and never logs it. Every error names the flag, the variable name or
// the file path and field, but NEVER the value or the file contents (JSON.parse messages quote input,
// so they are replaced). A NAME, path or field that looks like a key or secret itself (pasted in the
// wrong place) is refused without being repeated. Shapes: 'private-key' = 0x + 64 hex; 'secret' = 32+
// printable characters.
import { readFileSync } from 'node:fs';

export class SecretSourceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecretSourceError';
  }
}

export const SECRET_SHAPES = Object.freeze({
  'private-key': Object.freeze({ test: (value) => /^0x[0-9a-fA-F]{64}$/.test(value), describe: '0x followed by 64 hex characters' }),
  secret: Object.freeze({ test: (value) => value.length >= 32 && /^[\x21-\x7e]+$/.test(value), describe: 'at least 32 printable characters without spaces' }),
});

const ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const FIELD_RE = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;

// True for a value that looks like a key or secret rather than a variable NAME, a path or a field:
// 32+ hex characters (with or without 0x), or a 32+ character token that mixes upper case, lower case
// and digits without any path separator, dot or colon (base64url and similar). Names such as
// RANKED_VERIFIER_PRIVATE_KEY and paths such as C:/vault/keys.json do not match.
export function looksLikeSecretValue(value) {
  const text = String(value ?? '');
  if (/^(0x)?[0-9a-fA-F]{32,}$/.test(text)) return true;
  return text.length >= 32 && !/[\\/.:]/.test(text) && /[a-z]/.test(text) && /[A-Z]/.test(text) && /\d/.test(text);
}

function refusePastedSecret(flag, value, what, label) {
  if (looksLikeSecretValue(value)) throw new SecretSourceError(`${flag} must be ${what}, not the ${label} itself; the value was not printed. Pass the ${label} through an environment variable or a file`);
}

// `--flag value` or `--flag=value`; null when absent. A flag without a value is an error.
export function flagValue(argv, flag) {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === flag) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) throw new SecretSourceError(`${flag} needs a value`);
      return value;
    }
    if (arg.startsWith(`${flag}=`)) return arg.slice(flag.length + 1);
  }
  return null;
}

export function hasFlag(argv, flag) {
  return argv.includes(flag);
}

function resolveField(document, field, fileFlag, path) {
  let value = document;
  for (const part of field.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) {
      throw new SecretSourceError(`field "${field}" is not in ${fileFlag} ${path}`);
    }
    value = value[part];
  }
  if (value && typeof value === 'object' && typeof value.privateKey === 'string') value = value.privateKey;
  if (typeof value !== 'string') throw new SecretSourceError(`field "${field}" in ${fileFlag} ${path} is not a string`);
  return value;
}

// Returns the secret string. Never logs it; errors never contain it.
export function readSecret({
  env = process.env,
  argv = process.argv.slice(2),
  shape = 'private-key',
  envFlag = '--key-env',
  fileFlag = '--key-file',
  fieldFlag = '--key-field',
  label = 'key',
  readFile = (path) => readFileSync(path, 'utf8'),
} = {}) {
  const check = SECRET_SHAPES[shape];
  if (!check) throw new SecretSourceError(`unknown secret shape ${shape}`);
  const envName = flagValue(argv, envFlag);
  const path = flagValue(argv, fileFlag);
  const field = fieldFlag ? flagValue(argv, fieldFlag) : null;
  if (envName !== null) refusePastedSecret(envFlag, envName, 'the NAME of an environment variable', label);
  if (path !== null) refusePastedSecret(fileFlag, path, 'a file path', label);
  if (field !== null) refusePastedSecret(fieldFlag, field, 'a field name', label);
  if (envName !== null && path !== null) throw new SecretSourceError(`use either ${envFlag} or ${fileFlag} for the ${label}, not both`);
  if (envName === null && path === null) {
    throw new SecretSourceError(`the ${label} is required: pass ${envFlag} <NAME> or ${fileFlag} <path>${fieldFlag ? ` ${fieldFlag} <field>` : ''}`);
  }

  let value;
  let source;
  if (envName !== null) {
    if (!ENV_NAME_RE.test(envName)) throw new SecretSourceError(`${envFlag} must name an environment variable`);
    if (field !== null) throw new SecretSourceError(`${fieldFlag} only applies to ${fileFlag}`);
    value = env[envName];
    source = `environment variable ${envName}`;
    if (typeof value !== 'string' || value === '') throw new SecretSourceError(`${source} is not set or empty`);
  } else {
    let text;
    try {
      text = readFile(path);
    } catch (error) {
      throw new SecretSourceError(`cannot read ${fileFlag} ${path} (${error?.code ?? 'read error'})`);
    }
    if (field !== null) {
      if (!FIELD_RE.test(field)) throw new SecretSourceError(`${fieldFlag} must be a field name or a dotted path`);
      let document;
      try {
        document = JSON.parse(text);
      } catch {
        throw new SecretSourceError(`${fileFlag} ${path} is not valid JSON`);
      }
      value = resolveField(document, field, fileFlag, path);
      source = `field "${field}" of ${fileFlag} ${path}`;
    } else {
      value = String(text).trim();
      source = `${fileFlag} ${path}`;
    }
  }
  value = value.trim();
  if (!check.test(value)) throw new SecretSourceError(`the ${label} from ${source} is not ${check.describe}`);
  return value;
}
