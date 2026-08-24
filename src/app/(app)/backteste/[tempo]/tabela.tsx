"use client";

import { useActionState, useEffect, useRef, useState } from "react";

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
  { chave: "acoes", titulo: "", largura: 78 },
];

const LARGURA = COLUNAS.reduce((a, c) => a + c.largura, 0);

export function TabelaBackteste({
  tempo,
  linhas,
  setups,
  unidadePadrao,
}: {
  tempo: string;
  linhas: Backteste[];
  setups: { id: string; nome: string }[];
  unidadePadrao: string;
}) {
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
            <LinhaDeCadastro tempo={tempo} setups={setups} unidadePadrao={unidadePadrao} />
            {linhas.map((linha, indice) => (
              <LinhaSalva
                key={linha.id}
                linha={linha}
                numero={linhas.length - indice}
                tempo={tempo}
                setups={setups}
              />
            ))}
          </tbody>
        </table>
      </div>

      <p className="border-t border-line px-[18px] py-[13px] text-[13px] text-ink-4">
        Número e Data ficam fixos ao rolar na horizontal
      </p>
    </div>
  );
}

function LinhaDeCadastro({
  tempo,
  setups,
  unidadePadrao,
}: {
  tempo: string;
  setups: { id: string; nome: string }[];
  unidadePadrao: string;
}) {
  const [estado, acao, enviando] = useActionState(salvarBackteste, INICIAL);
  const [versao, setVersao] = useState(0);
  const [campos, setCampos] = useState<Record<string, string>>({});
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

  const unidade =
    ATIVOS.find((a) => a.codigo === valor("ativo"))?.unidade ?? unidadePadrao;

  // Salvou: limpa a linha e volta o foco para a data, para emendar o próximo.
  useEffect(() => {
    if (estado.ok) {
      setVersao((v) => v + 1);
      setCampos({});
      primeiro.current?.focus();
    }
  }, [estado]);

  const fundo = "bg-raised";

  return (
    <>
      <tr key={versao} className="[&>td]:border-b [&>td]:border-line-strong">
        <td className={`sticky left-0 z-20 ${fundo} border-l-[3px] border-l-accent px-3 py-2`}>
          <span className="flex size-[26px] items-center justify-center rounded-[7px] bg-accent/20 text-accent-soft">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M8 3v10M3 8h10" />
            </svg>
          </span>
        </td>

        <td className={`sticky left-[56px] z-20 ${fundo} px-3 py-2 shadow-[8px_0_12px_-8px_rgba(0,0,0,0.85)]`}>
          <input
            ref={primeiro}
            form="nova-linha"
            name="data"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={`${celula} num`}
          />
        </td>

        <td className={`${fundo} px-3 py-2`}>
          <Escolha form="nova-linha" nome="ativo" valor={valor("ativo")} onChange={(v) => trocar("ativo", v)}>
            {ATIVOS.map((a) => (
              <option key={a.codigo} value={a.codigo}>{a.codigo} · {a.nome}</option>
            ))}
          </Escolha>
        </td>

        <td className={`${fundo} px-3 py-2`}><Escolha form="nova-linha" nome="periodo" opcoes={PERIODOS} valor={valor("periodo")} onChange={(v) => trocar("periodo", v)} /></td>
        <td className={`${fundo} px-3 py-2`}><Escolha form="nova-linha" nome="operacao" opcoes={OPERACOES} valor={valor("operacao")} onChange={(v) => trocar("operacao", v)} /></td>

        <td className={`${fundo} px-3 py-2`}>
          {/* O setup começa sempre vazio, mesmo com filtro ativo. */}
          <Escolha form="nova-linha" nome="setup_id" valor={valor("setup_id")} onChange={(v) => trocar("setup_id", v)}>
            {setups.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </Escolha>
        </td>

        <td className={`${fundo} px-3 py-2`}><Escolha form="nova-linha" nome="evento" opcoes={EVENTOS} valor={valor("evento")} onChange={(v) => trocar("evento", v)} /></td>

        <td className={`${fundo} px-3 py-2`}>
          <span className="relative block">
            <input form="nova-linha" name="tamanho_stop" inputMode="decimal" placeholder="0,00" className={`${celula} num pr-11`} />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-4">
              {unidade}
            </span>
          </span>
        </td>

        <td className={`${fundo} px-3 py-2`}><Escolha form="nova-linha" nome="entrada" opcoes={ENTRADAS} valor={valor("entrada")} onChange={(v) => trocar("entrada", v)} /></td>
        <td className={`${fundo} px-3 py-2`}><Escolha form="nova-linha" nome="m20" opcoes={INCLINACOES} valor={valor("m20")} onChange={(v) => trocar("m20", v)} /></td>
        <td className={`${fundo} px-3 py-2`}><Escolha form="nova-linha" nome="m200" opcoes={INCLINACOES} valor={valor("m200")} onChange={(v) => trocar("m200", v)} /></td>
        <td className={`${fundo} px-3 py-2`}><Escolha form="nova-linha" nome="alinhamento" opcoes={ALINHAMENTOS} valor={valor("alinhamento")} onChange={(v) => trocar("alinhamento", v)} /></td>
        <td className={`${fundo} px-3 py-2`}><Escolha form="nova-linha" nome="localizacao" opcoes={LOCALIZACOES} valor={valor("localizacao")} onChange={(v) => trocar("localizacao", v)} /></td>

        <td className={`${fundo} px-3 py-2`}>
          <Escolha form="nova-linha" nome="resultado" opcoes={RESULTADOS} valor={valor("resultado")} onChange={(v) => trocar("resultado", v)} />
        </td>

        <td className={`${fundo} px-3 py-2`}>
          <Escolha form="nova-linha" nome="risco_retorno" valor={valor("risco_retorno")} onChange={(v) => trocar("risco_retorno", v)}>
            {RISCO_RETORNO.map((r) => (
              <option key={r.valor} value={r.valor}>{r.rotulo}</option>
            ))}
          </Escolha>
        </td>

        <td className={`${fundo} px-3 py-2`}>
          <input form="nova-linha" name="notas" placeholder="observação" className={celula} />
        </td>

        <td className={`${fundo} px-3 py-2`}>
          <div className="flex justify-end">
            <button
              form="nova-linha"
              type="submit"
              disabled={enviando}
              aria-label="Salvar linha"
              className="flex size-[34px] items-center justify-center rounded-[7px] bg-accent text-accent-ink disabled:opacity-60"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3 8.4l3.2 3.2L13 4.8" />
              </svg>
            </button>
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

      {/* O form fica fora da tabela: um <form> não pode envolver <td>. */}
      <tr className="hidden">
        <td>
          <form id="nova-linha" action={acao}>
            <input type="hidden" name="tempo_grafico" value={tempo} />
          </form>
        </td>
      </tr>
    </>
  );
}

function LinhaSalva({
  linha,
  numero,
  tempo,
  setups,
}: {
  linha: Backteste;
  numero: number;
  tempo: string;
  setups: { id: string; nome: string }[];
}) {
  const setup = setups.find((s) => s.id === linha.setup_id)?.nome ?? VAZIO;
  const ganhou = linha.resultado === "Gain";

  const td = "whitespace-nowrap border-b border-line-soft bg-table-row px-3 py-[10px] text-[14.5px] text-ink-2";

  return (
    <tr>
      <td className={`${td} num sticky left-0 z-20 text-ink-4`}>{numero}</td>
      <td className={`${td} num sticky left-[56px] z-20 shadow-[8px_0_12px_-8px_rgba(0,0,0,0.85)]`}>
        {formatarData(linha.data)}
      </td>
      <td className={`${td} num font-semibold`}>{linha.ativo}</td>
      <td className={td}>{linha.periodo}</td>
      <td className={td}>
        <span className={linha.operacao === "Compra" ? "text-gain" : "text-loss"}>{linha.operacao}</span>
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
        <form action={removerBackteste} className="flex justify-end">
          <input type="hidden" name="id" value={linha.id} />
          <input type="hidden" name="tempo_grafico" value={tempo} />
          <button type="submit" aria-label={`Remover linha ${numero}`} className="text-ink-4 hover:text-loss">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 4h11M6 4V2.7h4V4M4 4l.7 9.3h6.6L12 4" />
            </svg>
          </button>
        </form>
      </td>
    </tr>
  );
}

/**
 * Sempre controlado. Misturar defaultValue com value faz o React reclamar e
 * o campo passa a ignorar mudanças programáticas — que é justamente o que o
 * Loss precisa fazer com o R:R.
 */
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
