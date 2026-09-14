import type { Metadata } from "next";

import { Arco } from "@/components/marca";

import "./apresentacao.css";
import { Arquitetura } from "./arquitetura";
import { Decisoes } from "./decisoes";
import { Hero } from "./hero";
import { Paleta } from "./paleta";
import { Secao } from "./secao";
import { Telas } from "./telas";

export const metadata: Metadata = {
  title: "AION — estudo e execução, medidos separadamente",
  description:
    "Um app de day trade que guarda backteste e operação real como duas séries independentes e mostra, setup por setup, onde a execução deixou de entregar o que o estudo prometia.",
  openGraph: {
    title: "AION — estudo e execução, medidos separadamente",
    description:
      "Backteste e operação real como duas séries que nunca se somam. Next.js, TypeScript e Supabase.",
    type: "website",
  },
};

const PONTOS = [
  {
    titulo: "Duas séries que nunca se somam",
    texto:
      "Backteste acerta mais que execução, sempre: no estudo não existe mão tremendo nem entrada atrasada. Juntar os dois num total único produz um número alto que não descreve nada. O app mantém as contas separadas do banco à tela, e a única comparação que faz é lado a lado.",
  },
  {
    titulo: "Uma dívida de modelagem que custou dois anos de dados",
    texto:
      "A versão anterior guardava risco e retorno como texto: 2:1 era uma string. Parece inofensivo até o dia em que você quer a média e descobre que não existe média de texto. Aqui o campo é numérico, o formulário mostra o rótulo e grava o número.",
  },
  {
    titulo: "Não dá para duplicar um backteste",
    texto:
      "Seria simples de implementar e o pedido apareceria em qualquer lista de melhorias. Mas o app existe para fixar o critério de entrada, e preencher as dezesseis colunas de novo é parte de aprender a enxergá-las. A função foi deixada de fora de propósito.",
  },
];

function Problema() {
  return (
    <Secao
      titulo="Três coisas que o app se recusa a fazer"
      abertura="Um app de estatística é fácil de construir e fácil de construir errado. As decisões abaixo são as que definem se o número que aparece na tela quer dizer alguma coisa."
    >
      <ul className="grid gap-px overflow-hidden rounded-[13px] border border-line bg-line lg:grid-cols-3">
        {PONTOS.map((p) => (
          <li key={p.titulo} className="bg-card px-6 py-7">
            <h3 className="display text-[17px] leading-snug">{p.titulo}</h3>
            <p className="mt-4 text-[14px] leading-[1.65] text-ink-2">{p.texto}</p>
          </li>
        ))}
      </ul>
    </Secao>
  );
}

function Fecho() {
  return (
    <footer className="flex flex-col items-center px-6 py-[110px]">
      <Arco tamanho={40} />
      <p
        className="display mt-6 text-[30px] leading-none"
        style={{ letterSpacing: "0.26em", paddingLeft: "0.26em" }}
      >
        AION
      </p>
      <p className="display mt-5 text-[13px] uppercase tracking-[0.14em] text-ink-3">
        ciclos, tempo e consistência
      </p>
    </footer>
  );
}

export default function Apresentacao() {
  return (
    <main className="apr">
      <Hero />
      <Problema />
      <Telas />
      <Decisoes />
      <Paleta />
      <Arquitetura />
      <Fecho />
    </main>
  );
}
