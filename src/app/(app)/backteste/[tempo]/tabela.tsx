"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { BotaoRemover } from "@/components/botao-remover";
import { ATIVOS } from "@/lib/ativos";
import type { Backteste } from "@/lib/dados/backtestes";
import { data as formatarData, VAZIO } from "@/lib/formato";
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
const FIXA_1 = "sticky left-0 z-20";
const FIXA_2 = "sticky left-[56px] z-20 shadow-[8px_0_12px_-8px_var(--sombra-fixa)]";

type Setups = { id: string; nome: string }[];

export function TabelaBackteste({
  tempo,
  linhas,
  setups,
}: {
  tempo: string;
  linhas: Backteste[];
  setups: Setups;
}) {
  const [editando, setEditando] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0" style={{ minWidth: LARGURA }}>
          <colgroup>
            {COLUNAS.map((c) => (
              <col key={c.chave} style={{ width: c.largura }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLUNAS.map((c, i) => (
                <th
                  key={c.chave}
                  scope="col"
                  className={
                    cabecalho +
                    " border-b border-line-strong" +
                    (i === 0 ? " sticky left-0 z-30" : i === 1 ? " sticky left-[56px] z-30" : "")
                  }
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
                  aoEditar={() => setEditando(linha.id)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="border-t border-line px-[18px] py-[13px] text-[13px] text-ink-4">
        Número e Data ficam fixos ao rolar na horizontal · o lápis abre a linha para correção
      </p>
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
        <td className={`${FIXA_1} ${td} border-l-[3px] border-l-accent`}>
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

        <td className={`${FIXA_2} ${td}`}>
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
          <form id={formId} action={acao}>
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
  aoEditar,
}: {
  linha: Backteste;
  numero: number;
  tempo: string;
  setups: Setups;
  aoEditar: () => void;
}) {
  const setup = setups.find((s) => s.id === linha.setup_id)?.nome ?? VAZIO;
  const ganhou = linha.resultado === "Gain";
  const td =
    "whitespace-nowrap border-b border-line-soft bg-table-row px-3 py-[10px] text-[14.5px] text-ink-2";

  return (
    <tr>
      <td className={`${td} num ${FIXA_1} text-ink-4`}>{numero}</td>
      <td className={`${td} num ${FIXA_2}`}>{formatarData(linha.data)}</td>
      <td className={`${td} num font-semibold`}>{linha.ativo}</td>
      <td className={td}>{linha.periodo}</td>
      <td className={td}>
        <span className={linha.operacao === "Compra" ? "text-gain" : "text-loss"}>
          {linha.operacao}
        </span>
      </td>
      <td className={td}>{setup}</td>
      <td className={td}>{linha.evento}</td>
      <td className={`${td} num`}>{String(linha.tamanho_stop).replace(".", ",")}</td>
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
      <td className={`${td} text-ink-4`}>{linha.notas || VAZIO}</td>
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
