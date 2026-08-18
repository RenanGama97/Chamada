// Web Push sem bibliotecas: criptografia aes128gcm (RFC 8291 e 8188) e
// assinatura VAPID (RFC 8292), usando só Web Crypto — que já existe no Deno.
//
// Não depende de npm: menos coisa para dar errado no servidor do Supabase.
// A criptografia foi conferida byte a byte contra a biblioteca http_ece (a
// mesma que o pacote web-push usa).

const cru = globalThis.crypto;

export function deB64url(texto: string): Uint8Array {
  const s = texto.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function paraB64url(bytes: ArrayBuffer | Uint8Array): string {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function juntar(...partes: Uint8Array[]): Uint8Array {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const saida = new Uint8Array(total);
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

const texto = (s: string) => new TextEncoder().encode(s);

async function hmac(chave: Uint8Array, dados: Uint8Array): Promise<Uint8Array> {
  const k = await cru.subtle.importKey('raw', chave, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await cru.subtle.sign('HMAC', k, dados));
}

// HKDF em um bloco só (tudo que precisamos tem no máximo 32 bytes)
async function hkdf(sal: Uint8Array, ikm: Uint8Array, info: Uint8Array, tamanho: number): Promise<Uint8Array> {
  const prk = await hmac(sal, ikm);
  const bloco = await hmac(prk, juntar(info, Uint8Array.of(1)));
  return bloco.slice(0, tamanho);
}

/**
 * Criptografa o payload para uma inscrição (aes128gcm).
 * `salt` e `chavesServidor` são parâmetros para o teste conseguir fixá-los;
 * em produção vêm aleatórios.
 */
export type Inscricao = { endpoint: string; p256dh: string; auth: string };
export type Vapid = { assunto: string; publica: string; privada: string };

export async function criptografar({
  p256dh,
  auth,
  payload,
  salt,
  chavesServidor,
}: {
  p256dh: string;
  auth: string;
  payload: string | Uint8Array;
  salt?: Uint8Array;
  chavesServidor?: CryptoKeyPair;
}): Promise<Uint8Array> {
  const uaPublica = deB64url(p256dh);
  const autenticacao = deB64url(auth);
  salt = salt ?? cru.getRandomValues(new Uint8Array(16));

  const par = chavesServidor ?? (await cru.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']));
  const asPublica = new Uint8Array(await cru.subtle.exportKey('raw', par.publicKey));

  const uaChave = await cru.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const segredo = new Uint8Array(
    await cru.subtle.deriveBits({ name: 'ECDH', public: uaChave }, par.privateKey, 256),
  );

  // RFC 8291: mistura o segredo ECDH com o "auth" da inscrição
  const ikm = await hkdf(
    autenticacao,
    segredo,
    juntar(texto('WebPush: info'), Uint8Array.of(0), uaPublica, asPublica),
    32,
  );

  // RFC 8188: daí saem a chave e o nonce do AES-GCM
  const cek = await hkdf(salt, ikm, juntar(texto('Content-Encoding: aes128gcm'), Uint8Array.of(0)), 16);
  const nonce = await hkdf(salt, ikm, juntar(texto('Content-Encoding: nonce'), Uint8Array.of(0)), 12);

  const dados = typeof payload === 'string' ? texto(payload) : payload;
  // 0x02 marca o último (e único) registro
  const aberto = juntar(dados, Uint8Array.of(2));

  const chaveAes = await cru.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const cifrado = new Uint8Array(
    await cru.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, chaveAes, aberto),
  );

  // cabeçalho do corpo: salt(16) | tamanho do registro(4) | tamanho da chave(1) | chave(65)
  const tamanhoRegistro = new Uint8Array(4);
  new DataView(tamanhoRegistro.buffer).setUint32(0, 4096);

  return juntar(salt, tamanhoRegistro, Uint8Array.of(asPublica.length), asPublica, cifrado);
}

/** Cabeçalho Authorization do VAPID (RFC 8292). */
export async function autorizacaoVapid({
  endpoint,
  assunto,
  chavePublica,
  chavePrivada,
}: {
  endpoint: string;
  assunto: string;
  chavePublica: string;
  chavePrivada: string;
}): Promise<string> {
  const origem = new URL(endpoint).origin;
  const cabecalho = { typ: 'JWT', alg: 'ES256' };
  const corpo = {
    aud: origem,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: assunto,
  };

  const parte = (o: unknown) => paraB64url(texto(JSON.stringify(o)));
  const semAssinatura = `${parte(cabecalho)}.${parte(corpo)}`;

  const privada = await cru.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: chavePrivada,
      x: paraB64url(deB64url(chavePublica).slice(1, 33)),
      y: paraB64url(deB64url(chavePublica).slice(33, 65)),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const assinatura = await cru.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privada,
    texto(semAssinatura),
  );

  return `vapid t=${semAssinatura}.${paraB64url(assinatura)}, k=${chavePublica}`;
}

/** Envia a notificação para uma inscrição. Devolve o status HTTP. */
export async function enviarPush({
  inscricao,
  payload,
  vapid,
  ttl = 12 * 60 * 60,
}: {
  inscricao: Inscricao;
  payload: string;
  vapid: Vapid;
  ttl?: number;
}): Promise<number> {
  const corpo = await criptografar({
    p256dh: inscricao.p256dh,
    auth: inscricao.auth,
    payload,
  });

  const resposta = await fetch(inscricao.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await autorizacaoVapid({
        endpoint: inscricao.endpoint,
        assunto: vapid.assunto,
        chavePublica: vapid.publica,
        chavePrivada: vapid.privada,
      }),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'high',
    },
    body: corpo,
  });

  return resposta.status;
}
