import Link from "next/link";
import { BotaoConta, FormularioConta } from "@/components/formulario-conta";
import { TelaEntrada } from "@/components/tela-entrada";
import { carregarConta, supabaseSessao } from "@/lib/supabase-auth";

export const metadata = { title: "Minha conta | Altavista" };
export const dynamic = "force-dynamic";

export default async function Conta({ searchParams }: {
  searchParams: Promise<{ modo?: string; erro?: string }>;
}) {
  const parametros = await searchParams;
  const supabase = await supabaseSessao();
  const conta = supabase ? await carregarConta(supabase) : null;
  const cadastro = parametros.modo === "cadastro";

  if (conta) {
    return (
      <TelaEntrada>
        <h1>{conta.perfil || conta.erroPerfil ? "Minha conta" : "Complete seu cadastro"}</h1>
        {conta.email && <p className="conta-email">{conta.email}</p>}
        {conta.erroPerfil ? (
          <p className="aviso erro" role="alert">Não foi possível carregar seu perfil. Atualize a página para tentar novamente.</p>
        ) : conta.perfil ? (
          <>
            <p>Olá, <strong>{conta.perfil.nome_usuario}</strong>.</p>
            <BotaoConta acao="abrirLoja" />
          </>
        ) : (
          <>
            <p>Escolha um nome de usuário e informe sua data de nascimento para entrar na loja.</p>
            <FormularioConta modo="perfil" />
          </>
        )}
        <BotaoConta acao="sair" />
      </TelaEntrada>
    );
  }

  return (
    <TelaEntrada>
      <h1>{cadastro ? "Crie sua conta" : "Entre na sua conta"}</h1>
      {parametros.erro === "confirmacao" && (
        <p className="aviso erro" role="alert">O link de confirmação é inválido, expirou ou foi aberto em outro navegador. Se o e-mail já foi confirmado, entre com sua senha.</p>
      )}
      {supabase ? (
        <>
          {cadastro && <p>Crie sua conta com e-mail e senha. Você poderá completar seu perfil ao entrar.</p>}
          <FormularioConta key={cadastro ? "cadastrar" : "entrar"} modo={cadastro ? "cadastrar" : "entrar"} />
          <p className="conta-troca">
            {cadastro ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
            <Link className="link-botao" href={cadastro ? "/conta" : "/conta?modo=cadastro"} prefetch={false}>
              {cadastro ? "Entrar" : "Criar conta"}
            </Link>
          </p>
        </>
      ) : <p className="aviso erro" role="alert">Cadastro e login temporariamente indisponíveis.</p>}
      <Link className="link-botao entrada-link" href="/" prefetch={false}>Continuar como visitante</Link>
    </TelaEntrada>
  );
}
