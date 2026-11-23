"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { TelaEntrada } from "./tela-entrada";

export function Entrada({ contasDisponiveis }: { contasDisponiveis: boolean }) {
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const nascimento = `${dados.get("ano")}-${String(dados.get("mes")).padStart(2, "0")}-${String(dados.get("dia")).padStart(2, "0")}`;
    setErro("");
    setEnviando(true);

    try {
      const resposta = await fetch("/api/maioridade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nascimento }),
      });
      if (resposta.ok) {
        window.location.replace("/");
        return;
      }
      const resultado = await resposta.json();
      setErro(resultado.mensagem);
    } catch {
      setErro("A confirmação de idade está indisponível. Tente novamente.");
    }
    setEnviando(false);
  }

  return (
    <TelaEntrada>
      <span className="selo-idade" aria-hidden="true">18+</span>
      <h1>Confirme sua idade</h1>
      <p>Informe sua data de nascimento para entrar na Altavista. O acesso é reservado a pessoas com 18 anos ou mais.</p>
      <form method="post" onSubmit={confirmar}>
        <fieldset disabled={enviando}>
          <legend>Data de nascimento</legend>
          <div className="data-campos">
            <label>Dia<input name="dia" inputMode="numeric" autoComplete="bday-day" placeholder="DD" pattern="[0-9]{1,2}" maxLength={2} required /></label>
            <label>Mês<input name="mes" inputMode="numeric" autoComplete="bday-month" placeholder="MM" pattern="[0-9]{1,2}" maxLength={2} required /></label>
            <label>Ano<input name="ano" inputMode="numeric" autoComplete="bday-year" placeholder="AAAA" pattern="[0-9]{4}" maxLength={4} required /></label>
          </div>
        </fieldset>
        {erro && <p className="aviso erro" role="alert">{erro}</p>}
        <button className="botao primario" type="submit" disabled={enviando}>
          {enviando ? "Verificando…" : "Entrar na loja"}<ArrowRight size={17} aria-hidden="true" />
        </button>
      </form>
      <p className="nota-privacidade"><ShieldCheck size={16} aria-hidden="true" /> Na confirmação como visitante, a data de nascimento não é armazenada.</p>
      {contasDisponiveis && <Link className="link-botao entrada-link" href="/conta" prefetch={false}>Entrar na conta ou criar cadastro</Link>}
    </TelaEntrada>
  );
}
