"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { BotaoRemover } from "@/components/botao-remover";
import { ATIVOS } from "@/lib/ativos";
import type { Backteste } from "@/lib/dados/backtestes";
import { data as formatarData, moeda, simboloDaMoeda, VAZIO } from "@/lib/formato";
import {
  ALINHAMENTOS,
  ENTRADAS,
  EVENTOS,
  INCLINACOES,
  LOCALIZACOES,
  OPERACOES,
  PERIODOS,
  RESULTADOS,
  RISCO_RETORNO,
  rotuloRiscoRetorno,
} from "@/lib/opcoes";

import { removerBackteste, salvarBackteste, type EstadoLinha } from "../acoes";

const INICIAL: EstadoLinha = {};

const celula =
  "h-[38px] w-full rounded-[7px] border border-line-strong bg-input px-[10px] text-[14px] text-ink outline-none focus:border-accent";
const cabecalho =
  "whitespace-nowrap bg-table-head px-3 py-[11px] text-left text-[12px] font-bold uppercase tracking-[0.07em] text-ink";

/** Larguras fixas: sem elas as colunas dançam quando o conteúdo muda. */
const COLUNAS = [
  { chave: "num", titulo: "#", largura: 56 },
  { chave: "data", titulo: "Data", largura: 172 },
  { chave: "ativo", titulo: "Ativo", largura: 150 },
  { chave: "periodo", titulo: "Período", largura: 190 },
  { chave: "operacao", titulo: "Operação", largura: 160 },
  { chave: "setup", titulo: "Setup", largura: 210 },
  { chave: "evento", titulo: "Evento", largura: 195 },
  { chave: "stop", titulo: "Stop", largura: 135 },
  { chave: "entrada", titulo: "Entrada", largura: 185 },
  { chave: "m20", titulo: "M20", largura: 205 },
  { chave: "m200", titulo: "M200", largura: 205 },
  { chave: "alinhamento", titulo: "Alinhamento", largura: 225 },
  { chave: "localizacao", titulo: "Localização", largura: 255 },
  { chave: "resultado", titulo: "Resultado", largura: 150 },
  { chave: "rr", titulo: "R:R", largura: 155 },
  { chave: "notas", titulo: "Notas", largura: 250 },
  { chave: "acoes", titulo: "", largura: 88 },
];

const LARGURA = COLUNAS.reduce((a, c) => a + c.largura, 0);

type Setups = { id: string; nome: string }[];

export function TabelaBackteste({
  tempo,
  linhas,
  setups,
  mlpt,
}: {
  tempo: string;
  linhas: Backteste[];
  setups: Setups;
  mlpt: number | null;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [expandida, setExpandida] = useState(false);

  useEffect(() => {
    if (!expandida) return;
    const corpo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandida(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = corpo;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [expandida]);

  const tabela = (
    <table className="border-separate border-spacing-0" style={{ minWidth: LARGURA }}>
      <colgroup>
        {COLUNAS.map((c) => (
          <col key={c.chave} style={{ width: c.largura }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {COLUNAS.map((c) => (
            <th
              key={c.chave}
              scope="col"
              className={`${cabecalho} sticky top-0 z-10 border-b border-line-strong`}
            >
              {c.titulo}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <LinhaEditavel formId="nova-linha" tempo={tempo} setups={setups} inicial={null} />

        {linhas.map((linha, indice) => {
          const numero = linhas.length - indice;
          return editando === linha.id ? (
            <LinhaEditavel
              key={linha.id}
              formId={`editar-${linha.id}`}
              tempo={tempo}
              setups={setups}
              inicial={linha}
              numero={numero}
              aoFechar={() => setEditando(null)}
            />
          ) : (
            <LinhaSalva
              key={linha.id}
              linha={linha}
              numero={numero}
              tempo={tempo}
              setups={setups}
              mlpt={mlpt}
              aoEditar={() => setEditando(linha.id)}
            />
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div
      className={
        expandida
          ? "fixed inset-0 z-50 flex flex-col bg-bg-a p-5"
          : "overflow-hidden rounded-xl border border-line bg-card"
      }
    >
      <div
        className={
          expandida
            ? "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-card"
            : "contents"
        }
      >
        <div className="flex items-center justify-end gap-3 border-b border-line px-[18px] py-[13px]">
          <button
            type="button"
            onClick={() => setExpandida((v) => !v)}
            className="flex h-8 items-center gap-2 rounded-lg border border-line-strong bg-raised px-3 text-[13px] font-medium text-ink-2 hover:text-ink"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {expandida ? (
                <path d="M6.5 9.5L2 14M2 14h3.4M2 14v-3.4M9.5 6.5L14 2M14 2h-3.4M14 2v3.4" />
              ) : (
                <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" />
              )}
            </svg>
            {expandida ? "Sair da tela cheia" : "Expandir"}
          </button>
        </div>

        <div className={expandida ? "flex-1 overflow-auto" : "overflow-x-auto"}>{tabela}</div>

        <div className="border-t border-line px-[18px] py-[13px]">
          <p className="text-[13px] text-ink-4">
            {expandida ? "Esc fecha a tela cheia" : "O lápis abre a linha para correção"}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Uma única linha editável serve para cadastrar e para corrigir. Duplicar as
 * 16 colunas seria pedir para as duas divergirem na primeira mudança.
 */
function LinhaEditavel({
  formId,
  tempo,
  setups,
  inicial,
  numero,
  aoFechar,
}: {
  formId: string;
  tempo: string;
  setups: Setups;
  inicial: Backteste | null;
  numero?: number;
  aoFechar?: () => void;
}) {
  const editando = inicial !== null;

  const [estado, acao, enviando] = useActionState(salvarBackteste, INICIAL);
  const [versao, setVersao] = useState(0);
  const [campos, setCampos] = useState<Record<string, string>>(() => valoresIniciais(inicial));
  const primeiro = useRef<HTMLInputElement>(null);

  const valor = (nome: string) => campos[nome] ?? "";

  function trocar(nome: string, v: string) {
    setCampos((atual) => {
      const novo = { ...atual, [nome]: v };
      // Loss escolhe -1 sozinho: é o valor que faz a média virar expectativa.
      if (nome === "resultado" && v === "Loss") novo.risco_retorno = "-1";
      if (nome === "resultado" && v === "Gain" && atual.risco_retorno === "-1") {
        novo.risco_retorno = "";
      }
      return novo;
    });
  }

  const unidade = ATIVOS.find((a) => a.codigo === valor("ativo"))?.unidade ?? "pontos";

  useEffect(() => {
    if (!estado.ok) return;
    if (editando) {
      aoFechar?.();
    } else {
      // Salvou: limpa a linha e volta o foco para a data, para emendar o próximo.
      setVersao((v) => v + 1);
      setCampos(valoresIniciais(null));
      primeiro.current?.focus();
    }
  }, [estado, editando, aoFechar]);

  const td = `bg-raised px-3 py-2 ${editando ? "" : ""}`;
  const escolha = (nome: string, opcoes?: readonly string[]) => (
    <Escolha
      form={formId}
      nome={nome}
      opcoes={opcoes}
      valor={valor(nome)}
      onChange={(v) => trocar(nome, v)}
    />
  );

  return (
    <>
      <tr key={versao} className="[&>td]:border-b [&>td]:border-line-strong">
        <td className={`${td} border-l-[3px] border-l-accent`}>
          {editando ? (
            <span className="num text-[14px] text-accent-soft">{numero}</span>
          ) : (
            <span className="flex size-[26px] items-center justify-center rounded-[7px] bg-accent/20 text-accent-soft">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M8 3v10M3 8h10" />
              </svg>
            </span>
          )}
        </td>

        <td className={td}>
          <input
            ref={primeiro}
            form={formId}
            name="data"
            type="date"
            value={valor("data")}
            onChange={(e) => trocar("data", e.target.value)}
            className={`${celula} num`}
          />
        </td>

        <td className={td}>
          <Escolha form={formId} nome="ativo" valor={valor("ativo")} onChange={(v) => trocar("ativo", v)}>
            {ATIVOS.map((a) => (
              <option key={a.codigo} value={a.codigo}>{a.codigo} · {a.nome}</option>
            ))}
          </Escolha>
        </td>

        <td className={td}>{escolha("periodo", PERIODOS)}</td>
        <td className={td}>{escolha("operacao", OPERACOES)}</td>

        <td className={td}>
          {/* No cadastro o setup começa sempre vazio, mesmo com filtro ativo. */}
          <Escolha form={formId} nome="setup_id" valor={valor("setup_id")} onChange={(v) => trocar("setup_id", v)}>
            {setups.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </Escolha>
        </td>

        <td className={td}>{escolha("evento", EVENTOS)}</td>

        <td className={td}>
          <span className="relative block">
            <input
              form={formId}
              name="tamanho_stop"
              inputMode="decimal"
              placeholder="0,00"
              value={valor("tamanho_stop")}
              onChange={(e) => trocar("tamanho_stop", e.target.value)}
              className={`${celula} num pr-11`}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-4">
              {unidade}
            </span>
          </span>
        </td>

        <td className={td}>{escolha("entrada", ENTRADAS)}</td>
        <td className={td}>{escolha("m20", INCLINACOES)}</td>
        <td className={td}>{escolha("m200", INCLINACOES)}</td>
        <td className={td}>{escolha("alinhamento", ALINHAMENTOS)}</td>
        <td className={td}>{escolha("localizacao", LOCALIZACOES)}</td>
        <td className={td}>{escolha("resultado", RESULTADOS)}</td>

        <td className={td}>
          <Escolha form={formId} nome="risco_retorno" valor={valor("risco_retorno")} onChange={(v) => trocar("risco_retorno", v)}>
            {RISCO_RETORNO.map((r) => (
              <option key={r.valor} value={r.valor}>{r.rotulo}</option>
            ))}
          </Escolha>
        </td>

        <td className={td}>
          <input
            form={formId}
            name="notas"
            placeholder="observação"
            value={valor("notas")}
            onChange={(e) => trocar("notas", e.target.value)}
            className={celula}
          />
        </td>

        <td className={td}>
          <div className="flex justify-end gap-1.5">
            <button
              form={formId}
              type="submit"
              disabled={enviando}
              aria-label={editando ? "Salvar correção" : "Salvar linha"}
              className="flex size-[34px] items-center justify-center rounded-[7px] bg-accent text-accent-ink disabled:opacity-60"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 8.4l3.2 3.2L13 4.8" />
              </svg>
            </button>
            {editando && (
              <button
                type="button"
                onClick={aoFechar}
                aria-label="Cancelar edição"
                className="flex size-[34px] items-center justify-center rounded-[7px] border border-line-strong text-ink-4 hover:text-ink-2"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            )}
          </div>
        </td>
      </tr>

      {estado.erro && (
        <tr>
          <td colSpan={COLUNAS.length} className="bg-raised px-4 pb-3">
            <p role="alert" className="rounded-lg border border-loss/40 bg-loss-bg px-3 py-2 text-[13.5px] text-loss">
              {estado.erro}
            </p>
          </td>
        </tr>
      )}

      {/* O form vive fora das células: <form> não pode envolver <td>. */}
      <tr className="hidden">
        <td>
          <form id={formId} action={acao} autoComplete="off">
            <input type="hidden" name="tempo_grafico" value={tempo} />
            {editando && <input type="hidden" name="id" value={inicial.id} />}
          </form>
        </td>
      </tr>
    </>
  );
}

function valoresIniciais(linha: Backteste | null): Record<string, string> {
  if (!linha) {
    return { data: new Date().toISOString().slice(0, 10) };
  }
  return {
    data: linha.data.slice(0, 10),
    ativo: linha.ativo,
    periodo: linha.periodo,
    operacao: linha.operacao,
    setup_id: linha.setup_id,
    evento: linha.evento,
    tamanho_stop: String(linha.tamanho_stop).replace(".", ","),
    entrada: linha.entrada,
    m20: linha.m20,
    m200: linha.m200,
    alinhamento: linha.alinhamento,
    localizacao: linha.localizacao,
    resultado: linha.resultado,
    risco_retorno: String(linha.risco_retorno),
    notas: linha.notas ?? "",
  };
}

function LinhaSalva({
  linha,
  numero,
  tempo,
  setups,
  mlpt,
  aoEditar,
}: {
  linha: Backteste;
  numero: number;
  tempo: string;
  setups: Setups;
  mlpt: number | null;
  aoEditar: () => void;
}) {
  const setup = setups.find((s) => s.id === linha.setup_id)?.nome ?? VAZIO;
  const ganhou = linha.resultado === "Gain";
  const td =
    "whitespace-nowrap border-b border-line-soft bg-table-row px-3 py-[10px] text-[14.5px] text-ink-2";

  return (
    <tr>
      <td className={`${td} num text-ink-4`}>{numero}</td>
      <td className={`${td} num`}>{formatarData(linha.data)}</td>
      <td className={`${td} num font-semibold`}>{linha.ativo}</td>
      <td className={td}>{linha.periodo}</td>
      <td className={td}>
        <span className={linha.operacao === "Compra" ? "text-gain" : "text-loss"}>
          {linha.operacao}
        </span>
      </td>
      <td className={td}>{setup}</td>
      <td className={td}>{linha.evento}</td>
      <td className={`${td} num`}>
        <span className="flex items-center gap-1.5">
          {String(linha.tamanho_stop).replace(".", ",")}
          <ValorStopDolar ativo={linha.ativo} tamanhoStop={linha.tamanho_stop} mlpt={mlpt} />
        </span>
      </td>
      <td className={td}>{linha.entrada}</td>
      <td className={td}>{linha.m20}</td>
      <td className={td}>{linha.m200}</td>
      <td className={td}>{linha.alinhamento}</td>
      <td className={td}>{linha.localizacao}</td>
      <td className={td}>
        <span
          className={
            "inline-flex h-[23px] items-center rounded-md px-[9px] text-[13px] font-semibold " +
            (ganhou ? "bg-gain-bg text-gain" : "bg-loss-bg text-loss")
          }
        >
          {linha.resultado}
        </span>
      </td>
      <td className={`${td} num font-semibold ${linha.risco_retorno >= 0 ? "text-gain" : "text-loss"}`}>
        {rotuloRiscoRetorno(linha.risco_retorno)}
      </td>
      <td className={`${td} text-ink-4`}><Notas texto={linha.notas} /></td>
      <td className={td}>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={aoEditar}
            aria-label={`Editar linha ${numero}`}
            className="text-ink-4 hover:text-accent-soft"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11.3 2.7a1.6 1.6 0 0 1 2.3 2.3L5.5 13 2 14l1-3.5z" />
            </svg>
          </button>
          <BotaoRemover
            acao={removerBackteste}
            campos={{ id: linha.id, tempo_grafico: tempo }}
            rotulo={`Remover linha ${numero}`}
            titulo={`Remover o backteste ${numero}?`}
            descricao={`${linha.ativo} · ${formatarData(linha.data)} · ${linha.resultado}. Sai da tabela e das estatísticas do tempo gráfico.`}
          />
        </div>
      </td>
    </tr>
  );
}

/** 250 da coluna menos os 12px de recuo de cada lado do `td`. */
const LARGURA_NOTAS = 226;

/**
 * Nota longa não pode esticar a coluna: corta com reticências e abre inteira no
 * hover. O `max-width` é o que segura a largura — numa tabela de layout
 * automático, só `overflow: hidden` não impede o conteúdo de mandar na coluna.
 *
 * O balão só aparece quando o texto foi mesmo cortado. Medir na entrada do
 * mouse evita repetir num balão o que já está visível na célula.
 */
function Notas({ texto }: { texto: string | null }) {
  const [aberto, setAberto] = useState(false);

  if (!texto) return <>{VAZIO}</>;

  return (
    <span className="relative block">
      <span
        onMouseEnter={(e) => setAberto(e.currentTarget.scrollWidth > e.currentTarget.clientWidth)}
        onMouseLeave={() => setAberto(false)}
        className="block truncate"
        style={{ maxWidth: LARGURA_NOTAS }}
      >
        {texto}
      </span>

      {aberto && (
        <span
          role="tooltip"
          // Abre para a esquerda, sobre as colunas já lidas: à direita não há
          // espaço, e acima ou abaixo o balão seria cortado pela rolagem.
          className="absolute right-full top-1/2 z-30 mr-2 w-max max-w-[340px] -translate-y-1/2 whitespace-normal break-words rounded-lg border border-line-strong bg-raised px-3 py-2 text-[12.5px] leading-[1.45] text-ink-2 shadow-lg"
        >
          {texto}
        </span>
      )}
    </span>
  );
}

/**
 * Contratos são inteiros — o stop raramente cabe exato no MLPT. Aceita passar
 * até 20% do MLPT para não jogar fora orçamento de risco por causa de
 * arredondamento (ver conversa com o usuário sobre a tooltip do stop).
 */
const MARGEM_MLPT = 1.2;

function contratosIdeais(stopPorContrato: number, mlpt: number): number {
  return Math.floor((mlpt * MARGEM_MLPT) / stopPorContrato);
}

/**
 * Ícone de $ ao lado do stop: abre no hover/foco, sem clique, para consultar
 * rápido a quantidade ideal de contratos dado o MLPT da conta padrão.
 */
function ValorStopDolar({
  ativo,
  tamanhoStop,
  mlpt,
}: {
  ativo: string;
  tamanhoStop: number;
  mlpt: number | null;
}) {
  const dadosAtivo = ATIVOS.find((a) => a.codigo === ativo);
  if (!dadosAtivo || !Number.isFinite(tamanhoStop) || !mlpt) return null;

  const stopPorContrato = tamanhoStop * dadosAtivo.valorPonto;
  const contratos = contratosIdeais(stopPorContrato, mlpt);

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="Quantidade ideal de contratos para o MLPT da conta"
        className="flex size-[17px] items-center justify-center rounded-full border border-line-strong text-[10px] font-bold leading-none text-ink-4 group-hover:border-accent-soft group-hover:text-accent-soft group-focus-visible:border-accent-soft group-focus-visible:text-accent-soft"
      >
        {simboloDaMoeda(dadosAtivo.moeda)}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 w-max -translate-y-1/2 rounded-lg border border-line-strong bg-raised px-3 py-2 opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <span className="num whitespace-nowrap text-[12.5px] text-ink-4">
          {ativo} {String(tamanhoStop).replace(".", ",")} {dadosAtivo.unidade}
        </span>
        {contratos >= 1 ? (
          <span className="num mt-1 flex items-center justify-between gap-3 whitespace-nowrap text-[12.5px]">
            <span className="text-ink-4">{contratos} {contratos === 1 ? "contrato" : "contratos"}</span>
            <span className="ml-3 font-semibold text-ink">{moeda(stopPorContrato * contratos, dadosAtivo.moeda)}</span>
          </span>
        ) : (
          <span className="mt-1 block whitespace-nowrap text-[12.5px] text-loss">
            Stop passa do MLPT com 1 contrato só
          </span>
        )}
      </span>
    </span>
  );
}

function Escolha({
  form,
  nome,
  opcoes,
  children,
  valor,
  onChange,
}: {
  form: string;
  nome: string;
  opcoes?: readonly string[];
  children?: React.ReactNode;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      form={form}
      name={nome}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={`${celula} appearance-none`}
    >
      <option value="">Selecione</option>
      {opcoes?.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
      {children}
    </select>
  );
}
