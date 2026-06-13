const ALLOWED_ORIGINS = new Set([
  'https://practice-chat-pwa.web.app',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

function clean(value = '') {
  return `${value || ''}`.trim();
}

function timingSafeEqualString(a = '', b = '') {
  const left = clean(a);
  const right = clean(b);
  if (!left || !right || left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export function getPracticeChatApiSecret(env = process.env) {
  return clean(env.PRACTICE_CHAT_API_SECRET);
}

export function corsHeaders(origin = '') {
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://practice-chat-pwa.web.app';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-FirstChord-PracticeChat-Secret',
    Vary: 'Origin',
  };
}

export function authenticatePracticeChatRequest(request, env = process.env) {
  const origin = request.headers.get('origin') || '';
  const providedSecret = request.headers.get('x-firstchord-practicechat-secret') || '';
  const expectedSecret = getPracticeChatApiSecret(env);
  const hasValidSecret = expectedSecret
    ? timingSafeEqualString(providedSecret, expectedSecret)
    : false;

  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return {
      ok: false,
      status: 403,
      error: 'Origin not allowed',
    };
  }

  if (!origin && !hasValidSecret) {
    return {
      ok: false,
      status: 403,
      error: 'Origin or Practice Chat secret is required',
    };
  }

  if (expectedSecret && !hasValidSecret) {
    return {
      ok: false,
      status: 401,
      error: 'Practice Chat secret is invalid or missing',
    };
  }

  return { ok: true };
}

