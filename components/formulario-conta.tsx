"use client";

import { ArrowRight, LogOut } from "lucide-react";
import { useActionState, useState } from "react";
import { abrirLoja, cadastrar, completarPerfil, editarNomeUsuario, entrar, sair, type EstadoConta } from "@/app/conta/actions";

const formularios = {
  entrar: { acao: entrar, texto: "Entrar" },
  cadastrar: { acao: cadastrar, texto: "Criar conta" },
  perfil: { acao: completarPerfil, texto: "Salvar e entrar na loja" },
  editar: { acao: editarNomeUsuario, texto: "Salvar nome de usuário" },
};

function MensagemConta({ erro, aviso }: EstadoConta) {
  if (erro) return <p className="aviso erro" role="alert">{erro}</p>;
  if (aviso) return <p className="aviso" role="status">{aviso}</p>;
  return null;
}

export function FormularioConta({ modo, nomeInicial = "" }: { modo: keyof typeof formularios; nomeInicial?: string }) {
  const { acao, texto } = formularios[modo];
  const [estado, executar, pendente] = useActionState(acao, {});
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState(nomeInicial);
  const [nascimento, setNascimento] = useState("");

  return (
    <form action={executar}>
      <fieldset className="campos-conta" disabled={pendente}>
        {modo === "perfil" || modo === "editar" ? <>
          <div>
            <label>
              Nome de usuário
              <input name="nome_usuario" autoComplete="username" autoCapitalize="none" spellCheck={false}
                minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" aria-describedby="nome-usuario-ajuda"
                value={nome} onChange={(evento) => setNome(evento.target.value.toLowerCase())} required />
            </label>
            <small id="nome-usuario-ajuda">De 3 a 30 letras, números ou sublinhados.</small>
          </div>
          {modo === "perfil" && <label>
            Data de nascimento
            <input name="data_nascimento" type="date" autoComplete="bday" min="1900-01-01"
              value={nascimento} onChange={(evento) => setNascimento(evento.target.value)} required />
          </label>}
        </> : <>
          <label>
            E-mail
            <input name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
              maxLength={254} value={email} onChange={(evento) => setEmail(evento.target.value)} required />
          </label>
          <div>
            <label>
              Senha
              <input name="senha" type="password" autoComplete={modo === "cadastrar" ? "new-password" : "current-password"}
                maxLength={modo === "cadastrar" ? 72 : 1024} minLength={modo === "cadastrar" ? 8 : undefined}
                aria-describedby={modo === "cadastrar" ? "senha-ajuda" : undefined} required />
            </label>
            {modo === "cadastrar" && <small id="senha-ajuda">Use pelo menos 8 caracteres.</small>}
          </div>
        </>}
      </fieldset>
      <MensagemConta erro={estado.erro} aviso={modo === "editar" && nome !== nomeInicial ? undefined : estado.aviso} />
      <button type="submit" className="botao primario" disabled={pendente || (modo === "editar" && nome === nomeInicial)}>
        {pendente ? "Aguarde…" : texto}<ArrowRight size={17} aria-hidden="true" />
      </button>
    </form>
  );
}

export function BotaoConta({ acao }: { acao: "abrirLoja" | "sair" }) {
  const voltando = acao === "abrirLoja";
  const [estado, executar, pendente] = useActionState<EstadoConta>(voltando ? abrirLoja : sair, {});
  const Icone = voltando ? ArrowRight : LogOut;

  return (
    <form action={executar}>
      <MensagemConta {...estado} />
      <button type="submit" className={voltando ? "botao primario" : "link-botao"} disabled={pendente}>
        {pendente ? "Aguarde…" : voltando ? "Ir para a loja" : "Sair"}
        <Icone size={17} aria-hidden="true" />
      </button>
    </form>
  );
}
