import { Secao } from "./secao";

type Decisao = {
  titulo: string;
  obvio: string;
  feito: string;
  prova?: React.ReactNode;
};

const DECISOES: Decisao[] = [
  {
    titulo: "Ordenar contexto por acerto premia o acaso",
    obvio:
      "Ranquear as combinações de entrada, alinhamento e localização pelo percentual de acerto. É o que a leitura pede e o que uma cláusula order by entrega.",
    feito:
      "A ordem é o limite inferior do intervalo de Wilson a 95% — a assertividade mínima que aquela amostra sustenta. Contexto com menos de 6 registros não entra, e o card diz quantos ficaram de fora. Nos piores contextos a conta inverte: usa o limite superior, e só entra quem fica abaixo da assertividade geral do setup, senão o card lista o pior dos bons.",
    prova: (
      <>
        <span className="text-ink-3">1 registro a 100,0%</span> → piso 20,7%
        <br />
        <span className="text-ink-3">22 registros a 86,4%</span> → piso 66,7%
      </>
    ),
  },
  {
    titulo: "Trade zerado não é meio acerto",
    obvio:
      "Assertividade é acertos sobre total de trades. O zerado entra no total porque aconteceu.",
    feito:
      "O denominador é só gain mais loss. Um dia de muitos zerados não pode derrubar a assertividade de um setup que não errou — ele não acertou nem errou, saiu no zero.",
  },
  {
    titulo: "A média de risco e retorno não é a expectativa",
    obvio:
      "Tirar a média de todos os risco e retorno, loss incluso como −1, e chamar o resultado de expectativa por operação.",
    feito:
      "A média entra só com os gains e se chama exatamente o que é: quanto o setup paga quando paga. O loss continua contando na assertividade — são duas perguntas diferentes e cada número responde uma.",
  },
  {
    titulo: "Sacar não é perder",
    obvio:
      "O saldo caiu, então a série caiu, então houve drawdown. Um saque de US$ 5.000 vira uma perda de US$ 5.000.",
    feito:
      "O drawdown é calculado sobre uma segunda série, feita só de operações. O limite de perda do dia também ignora saques e aportes. O gráfico mostra o degrau para baixo, porque ver o degrau é útil — contá-lo como perda não é.",
  },
  {
    titulo: "Nenhum número derivável é digitado duas vezes",
    obvio:
      "Formulário com campo para stop em pontos e campo para stop em dólar, porque às vezes você tem um e às vezes o outro.",
    feito:
      "Stop em dólar, resultado em pontos e o status de gain ou loss são derivados de pontos, contratos e o valor do ponto do ativo. Dois campos para o mesmo fato é só um convite a uma contradição que ninguém vai perceber.",
  },
];

export function Decisoes() {
  return (
    <Secao
      id="decisoes"
      titulo="Cinco decisões que não são óbvias no primeiro dia"
      abertura="Quase toda tela de estatística é fácil de construir e fácil de construir errado. Estas são as escolhas que mudam o que os números querem dizer."
    >
      <ul>
        {DECISOES.map((d) => (
          <li key={d.titulo} className="border-t border-line py-9 first:border-t-0 first:pt-0">
            <div className="grid gap-7 lg:grid-cols-[minmax(0,7fr)_minmax(0,9fr)] lg:gap-16">
              <div>
                <h3 className="display text-[19px] leading-snug">{d.titulo}</h3>
                <p className="mt-4 max-w-[48ch] text-[14px] leading-[1.62] text-ink-4">
                  {d.obvio}
                </p>
              </div>

              <div className="border-l-2 border-accent pl-6">
                <p className="max-w-[62ch] text-[15px] leading-[1.65] text-ink-2">{d.feito}</p>
                {d.prova ? (
                  <p className="num mt-5 inline-block rounded-[9px] bg-well px-[14px] py-[11px] text-[12.5px] leading-[1.8] text-ink">
                    {d.prova}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Secao>
  );
}
