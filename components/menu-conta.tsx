"use client";

import { UserRound, X } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { BotaoConta } from "./formulario-conta";

export function MenuConta({ nome }: { nome: string | null }) {
  const dialogo = useRef<HTMLDialogElement>(null);

  if (nome === null) return (
    <Link className="conta-link" href="/conta" prefetch={false}>
      <UserRound size={19} aria-hidden="true" /><span>Entrar</span>
    </Link>
  );

  return (
    <>
      <button type="button" className="conta-link" aria-haspopup="dialog" aria-controls="menu-conta"
        onClick={() => dialogo.current?.showModal()}>
        <UserRound size={19} aria-hidden="true" /><span>{nome}</span>
      </button>
      <dialog id="menu-conta" ref={dialogo} className="menu-conta" aria-labelledby="menu-conta-titulo"
        onClick={(evento) => { if (evento.target === evento.currentTarget) evento.currentTarget.close(); }}>
        <div className="menu-conta-corpo">
          <div className="menu-conta-topo">
            <h2 id="menu-conta-titulo">Minha conta</h2>
            <button className="icone-botao" type="button" aria-label="Fechar" onClick={() => dialogo.current?.close()}>
              <X size={19} aria-hidden="true" />
            </button>
          </div>
          <Link className="botao primario" href="/conta" prefetch={false} onClick={() => dialogo.current?.close()}>
            <UserRound size={17} aria-hidden="true" /> Perfil
          </Link>
          <BotaoConta acao="sair" />
        </div>
      </dialog>
    </>
  );
}
