import type { ReactNode } from "react";
import { Marca } from "./marca";

export function TelaEntrada({ children }: { children: ReactNode }) {
  return (
    <main className="entrada">
      <div className="entrada-conteudo">
        <Marca />
        <div className="entrada-form">{children}</div>
        <span className="entrada-rodape">Altavista Adega &amp; Distribuidora</span>
      </div>
      <div className="entrada-foto" aria-hidden="true" />
    </main>
  );
}
