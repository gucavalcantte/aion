import { Legenda, Secao } from "./secao";
import { TelaBackteste } from "./tela-backteste";
import { TelaPerfomance } from "./tela-perfomance";
import { TelaPlano } from "./tela-plano";

export function Telas() {
  return (
    <Secao
      id="telas"
      titulo="Seis telas, uma gramática só"
      abertura={
        <>
          Densidade alta, número sempre em monoespaçada tabular e nenhum valor digitado
          duas vezes: stop em dólar, resultado em pontos e gain ou loss são calculados a
          partir do que já foi registrado. Os valores abaixo são de demonstração.
        </>
      }
    >
      <div className="space-y-[64px]">
        <div>
          <Legenda titulo="Perfomance">
            A operação real de uma conta por vez. O saque derruba o saldo e aparece como
            degrau no gráfico, mas sai do drawdown, do limite diário e de qualquer
            estatística — sacar não é perder.
          </Legenda>
          <TelaPerfomance />
        </div>

        <div>
          <Legenda titulo="Backteste">
            Dezesseis colunas por linha, cadastradas dentro da própria tabela. Abaixo, o
            ranking de contextos que a amostra sustenta.
          </Legenda>
          <TelaBackteste />
        </div>

        <div>
          <Legenda titulo="Plano">
            O plano de operação em duas naturezas: o pré-mercado, que vale para o dia, e
            uma linha por setup. Sai em uma folha A4 no mesmo desenho da tela.
          </Legenda>
          <TelaPlano />
        </div>
      </div>
    </Secao>
  );
}
