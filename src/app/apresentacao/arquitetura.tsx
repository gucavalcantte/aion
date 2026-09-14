import { Secao } from "./secao";

const CAMADAS = [
  {
    nome: "Navegador",
    papel: "Recebe HTML pronto e devolve eventos. Não guarda chave nenhuma e não sabe o endereço do banco.",
  },
  {
    nome: "Servidor, na Vercel",
    papel:
      "Server Components leem, Server Actions escrevem. A chave do Supabase mora aqui e não tem o prefixo que a exporia no pacote enviado ao navegador.",
  },
  {
    nome: "Postgres, no Supabase",
    papel:
      "Row Level Security nas nove tabelas, com auth.uid() = user_id. Quem separa os dados é o banco, não a lembrança de escrever um filtro em toda consulta.",
  },
];

const NUMEROS = [
  { valor: "9", rotulo: "tabelas, todas com RLS" },
  { valor: "15", rotulo: "tipos enumerados no banco" },
  { valor: "7", rotulo: "migrações versionadas" },
  { valor: "6", rotulo: "telas" },
];

export function Arquitetura() {
  return (
    <Secao
      id="arquitetura"
      titulo="O banco separa os dados, não o programador"
      abertura="Todo acesso acontece no servidor, o que já bastaria para a chave não vazar. Mas bastar no servidor significa depender de cada consulta lembrar do filtro por usuário, e um select esquecido mostra a conta de um a outro. Um punhado de policies, escritas uma vez, passa essa garantia para o Postgres."
    >
      <ol className="overflow-hidden rounded-[13px] border border-line">
        {CAMADAS.map((camada, i) => (
          <li
            key={camada.nome}
            className={`grid gap-3 px-6 py-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,11fr)] lg:gap-12 ${
              i === 1 ? "bg-card" : "bg-well"
            } ${i > 0 ? "border-t border-line" : ""}`}
          >
            <span className="display text-[15px] text-ink">{camada.nome}</span>
            <span className="max-w-[68ch] text-[14.5px] leading-[1.62] text-ink-2">
              {camada.papel}
            </span>
          </li>
        ))}
      </ol>

      <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {NUMEROS.map((n) => (
          <div key={n.rotulo} className="rounded-[11px] border border-line-soft bg-card px-5 py-[18px]">
            <dd className="num text-[30px] leading-none text-ink">{n.valor}</dd>
            <dt className="mt-[10px] text-[12.5px] leading-snug text-ink-3">{n.rotulo}</dt>
          </div>
        ))}
      </dl>

      <p className="mt-6 max-w-[74ch] text-[13.5px] leading-[1.65] text-ink-4">
        O plano gratuito do Supabase pausa o projeto depois de sete dias parado, então uma
        rotina semanal na Vercel faz um select trivial só para o banco não dormir.
      </p>
    </Secao>
  );
}
