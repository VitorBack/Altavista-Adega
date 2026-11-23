import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_MAIORIDADE = "altavista_18";
export const DURACAO_COOKIE = 60 * 60 * 12;

export const opcoesCookieMaioridade = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: DURACAO_COOKIE,
} as const;

const dataLocal = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Fortaleza", year: "numeric", month: "2-digit", day: "2-digit",
});

export function verificarNascimento(valor: unknown, agora = new Date()) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "invalida";

  const nascimento = new Date(`${valor}T00:00:00Z`);
  const partes = Object.fromEntries(dataLocal.formatToParts(agora).map(({ type, value }) => [type, value]));
  const hoje = `${partes.year}-${partes.month}-${partes.day}`;
  if (Number.isNaN(nascimento.valueOf()) || nascimento.toISOString().slice(0, 10) !== valor || valor > hoje || valor < "1900-01-01") {
    return "invalida";
  }

  const [ano, mes, dia] = hoje.split("-").map(Number);
  const [anoNasc, mesNasc, diaNasc] = valor.split("-").map(Number);
  const antesDoAniversario = mes < mesNasc || (mes === mesNasc && dia < diaNasc);
  const idade = ano - anoNasc - Number(antesDoAniversario);
  return idade >= 18 ? "maior" : "menor";
}

function assinar(valor: string) {
  const segredo = process.env.AGE_COOKIE_SECRET;
  if (!segredo || Buffer.byteLength(segredo) < 32) return null;
  return createHmac("sha256", segredo).update(valor).digest("base64url");
}

export function emitirComprovante(agora = Date.now()) {
  const valor = `v1.${Math.floor(agora / 1000) + DURACAO_COOKIE}`;
  const assinatura = assinar(valor);
  return assinatura ? `${valor}.${assinatura}` : null;
}

export function comprovanteValido(cookie: string | undefined, agora = Date.now()) {
  const partes = cookie?.match(/^(v1)\.(\d{10})\.([A-Za-z0-9_-]{43})$/);
  if (!partes || Number(partes[2]) <= Math.floor(agora / 1000)) return false;

  const assinatura = assinar(`${partes[1]}.${partes[2]}`);
  return !!assinatura && timingSafeEqual(Buffer.from(assinatura), Buffer.from(partes[3]));
}
