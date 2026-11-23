"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { COOKIE_MAIORIDADE, emitirComprovante, opcoesCookieMaioridade, verificarNascimento } from "@/lib/maioridade";
import { consultarPerfil, supabaseSessao } from "@/lib/supabase-auth";

export type EstadoConta = { erro?: string; aviso?: string };

const credenciaisSchema = z.object({
  email: z.string().trim().email().max(254),
  senha: z.string().min(1).max(1024),
});
const nomeUsuarioSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/);
const indisponivel = { erro: "O serviço de contas está indisponível. Tente novamente em instantes." };
const idadeMinima = { erro: "A loja é reservada a pessoas com 18 anos ou mais." };

function credenciaisDoFormulario(formulario: FormData) {
  return credenciaisSchema.safeParse({ email: formulario.get("email"), senha: formulario.get("senha") });
}

async function autorizarLoja(nascimento: string) {
  if (verificarNascimento(nascimento) !== "maior") return idadeMinima;
  const comprovante = emitirComprovante();
  if (!comprovante) return { erro: "A confirmação de idade está indisponível. Tente novamente mais tarde." };

  (await cookies()).set(COOKIE_MAIORIDADE, comprovante, opcoesCookieMaioridade);
  redirect("/");
}

export async function entrar(_estado: EstadoConta, formulario: FormData): Promise<EstadoConta> {
  const credenciais = credenciaisDoFormulario(formulario);
  if (!credenciais.success) return { erro: "Informe seu e-mail e sua senha." };

  const supabase = await supabaseSessao(true);
  if (!supabase) return indisponivel;

  const { email, senha } = credenciais.data;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error?.code === "email_not_confirmed") return { erro: "Confirme seu e-mail antes de entrar." };
  if (error?.code === "invalid_credentials") return { erro: "E-mail ou senha inválidos." };
  if (error?.status === 429) return { erro: "Muitas tentativas. Aguarde um momento para entrar." };
  if (error || !data.user) return indisponivel;

  const { data: perfil } = await consultarPerfil(supabase, data.user.id);
  if (perfil && verificarNascimento(perfil.data_nascimento) === "maior") {
    await autorizarLoja(perfil.data_nascimento);
  }
  redirect("/conta");
}

export async function cadastrar(_estado: EstadoConta, formulario: FormData): Promise<EstadoConta> {
  const credenciais = credenciaisDoFormulario(formulario);
  if (!credenciais.success) return { erro: "Informe um endereço de e-mail válido e uma senha." };

  const { email, senha } = credenciais.data;
  if (Array.from(senha).length < 8 || Buffer.byteLength(senha, "utf8") > 72) {
    return { erro: "Escolha uma senha com pelo menos 8 caracteres e até 72 bytes." };
  }

  const supabase = await supabaseSessao(true);
  if (!supabase) return indisponivel;

  const origem = (await headers()).get("origin");
  const emailRedirectTo = origem ? new URL("/auth/confirm", origem).toString() : undefined;
  const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo } });
  if (error?.status === 429) return { erro: "Muitas tentativas de cadastro. Aguarde antes de tentar novamente." };
  if (error?.code === "weak_password") return { erro: "Escolha uma senha mais forte e tente novamente." };
  if (error?.code === "user_already_exists") {
    return { aviso: "Se já tiver uma conta com esse e-mail, entre com sua senha. Para uma conta nova, confira a confirmação na sua caixa de entrada." };
  }
  if (error) return indisponivel;
  if (data.session) redirect("/conta");

  return { aviso: "Confira seu e-mail e abra o link de confirmação neste navegador para concluir seu cadastro." };
}

export async function completarPerfil(_estado: EstadoConta, formulario: FormData): Promise<EstadoConta> {
  const nome = nomeUsuarioSchema.safeParse(formulario.get("nome_usuario"));
  if (!nome.success) return { erro: "Use de 3 a 30 letras, números ou sublinhados no nome de usuário." };

  const nascimento = formulario.get("data_nascimento");
  if (typeof nascimento !== "string") return { erro: "Informe sua data de nascimento." };

  const idade = verificarNascimento(nascimento);
  if (idade === "invalida") return { erro: "Informe uma data de nascimento válida." };
  if (idade === "menor") return idadeMinima;

  const supabase = await supabaseSessao(true);
  if (!supabase) return indisponivel;
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) redirect("/conta");

  const { error } = await supabase.from("perfis").insert({ nome_usuario: nome.data, data_nascimento: nascimento });
  if (error?.code === "23505") {
    const { data: perfil, error: erroPerfil } = await consultarPerfil(supabase, data.claims.sub);
    if (erroPerfil) return indisponivel;
    if (perfil) return autorizarLoja(perfil.data_nascimento);
    return { erro: "Esse nome de usuário já está em uso. Escolha outro." };
  }
  if (error) return { erro: "Não foi possível salvar seu perfil. Tente novamente." };

  return autorizarLoja(nascimento);
}

export async function abrirLoja(): Promise<EstadoConta> {
  const supabase = await supabaseSessao(true);
  if (!supabase) return indisponivel;
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) redirect("/conta");

  const { data: perfil, error } = await consultarPerfil(supabase, data.claims.sub);
  if (error) return indisponivel;
  if (!perfil) redirect("/conta");
  return autorizarLoja(perfil.data_nascimento);
}

export async function editarNomeUsuario(_estado: EstadoConta, formulario: FormData): Promise<EstadoConta> {
  const nome = nomeUsuarioSchema.safeParse(formulario.get("nome_usuario"));
  if (!nome.success) return { erro: "Use de 3 a 30 letras, números ou sublinhados no nome de usuário." };

  const supabase = await supabaseSessao(true);
  if (!supabase) return indisponivel;
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) redirect("/conta");

  const { data: perfil, error } = await supabase.from("perfis")
    .update({ nome_usuario: nome.data }).eq("usuario_id", data.claims.sub)
    .select("nome_usuario").maybeSingle();
  if (error?.code === "23505") return { erro: "Esse nome de usuário já está em uso. Escolha outro." };
  if (error || !perfil) return { erro: "Não foi possível atualizar seu nome de usuário. Tente novamente." };

  revalidatePath("/conta");
  revalidatePath("/");
  return { aviso: "Nome de usuário atualizado." };
}

export async function sair(): Promise<EstadoConta> {
  const supabase = await supabaseSessao(true);
  if (!supabase) return indisponivel;

  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return { erro: "Não foi possível sair da sua conta. Tente novamente." };

  (await cookies()).delete(COOKIE_MAIORIDADE);
  redirect("/");
}
