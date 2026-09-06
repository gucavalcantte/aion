"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { ATIVOS, type Ativo, type Moeda } from "@/lib/ativos";
import type { EspecificacaoAtivo } from "@/lib/dados/corretoras";
import { fechamentoDeExecucoes, type ExecucaoTrade } from "@/lib/execucoes-trade";
import { moeda, VAZIO } from "@/lib/formato";
import { riscoRetornoSugerido, statusDoResultado, stopEmDolar } from "@/lib/metricas";
import { ENTRADAS, type Entrada, RISCO_RETORNO, SEM_SETUP, TEMPOS_GRAFICOS, TIPOS_EXECUCAO } from "@/lib/opcoes";

import { salvarTrade, type EstadoTrade } from "./acoes";

const INICIAL: EstadoTrade = {};

const rotulo =
  "mb-[9px] flex h-[15px] items-center gap-1.5 whitespace-nowrap text-[11.5px] font-semibold uppercase tracking-[0.10em] text-ink-3";
const campo =
  "h-[44px] w-full rounded-[9px] border border-line-strong bg-input px-[14px] text-[15px] text-ink outline-none placeholder:text-ink-4 focus:border-accent";
const calculado =
  "flex h-[44px] items-center justify-between rounded-[9px] border border-dashed border-line-strong bg-well px-[14px] text-[15px] text-ink-3";

/** O ponto do acento marca o que o app calcula — não se digita. */
function Ponto() {
  return <span className="inline-block size-[5px] rounded-full bg-accent-soft" aria-hidden />;
}

export type TradeParaEdicao = {
  id: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  ativo: Ativo;
  tempo_grafico: string;
  setup_id: string | null;
  entrada: Entrada | null;
  pontos_stop: number;
  contratos: number;
  resultado: number;
  risco_retorno: number | null;
  respeitou_plano: boolean;
  observacao: string | null;
  imagem: string | null;
  execucoes: ExecucaoTrade[];
};

type TipoExecucaoDoForm = (typeof TIPOS_EXECUCAO)[number];
type LinhaExecucaoForm = { tipo: TipoExecucaoDoForm; quantidade: string; notas: string };

export function FormularioTrade({
  contaId,
  setups,
  moedaConta,
  especificacoes,
  trade,
  aoFechar,
}: {
  contaId: string;
  setups: { id: string; nome: string }[];
  moedaConta: Moeda;
  especificacoes: Partial<Record<Ativo, EspecificacaoAtivo>>;
  /** Presente = corrigindo um trade já salvo. */
  trade?: TradeParaEdicao;
  aoFechar?: () => void;
}) {
  const editando = Boolean(trade);
  const ativosPermitidos = ATIVOS.filter((a) => a.moeda === moedaConta || a.codigo === trade?.ativo);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, acao, enviando] = useActionState(salvarTrade, INICIAL);

  const [ativo, setAtivo] = useState<Ativo>(trade?.ativo ?? ativosPermitidos[0]?.codigo ?? "MNQ");
  // "" = nada escolhido ainda (obrigatório); SEM_SETUP é a sentinela de "Sem setup".
  const [setupId, setSetupId] = useState(trade ? (trade.setup_id ?? SEM_SETUP) : "");
  const semSetup = setupId === SEM_SETUP;
  const [respeitouPlano, setRespeitouPlano] = useState(trade?.respeitou_plano ?? true);
  const [pontos, setPontos] = useState(trade ? String(trade.pontos_stop) : "");
  const [contratos, setContratos] = useState(trade ? String(trade.contratos) : "");
  const [resultado, setResultado] = useState(trade ? String(trade.resultado) : "");
  // `rr` não é sincronizado por effect: enquanto o usuário não clica numa opção
  // (rrManual === null), ele é sempre o valor calculado (rrAuto), recomputado a
  // cada render — não precisa de useEffect para "alcançar" o valor sugerido.
  // Em edição, rrManual nasce definido (mesmo "") para nunca deixar a sugestão
  // sobrescrever um trade que já tem risco/retorno gravado.
  const [rrManual, setRrManual] = useState<string | null>(
    editando ? (trade?.risco_retorno != null ? String(trade.risco_retorno) : "") : null,
  );
  const [previa, setPrevia] = useState<string | null>(trade?.imagem ?? null);
  const arquivo = useRef<HTMLInputElement>(null);

  const [teveParciais, setTeveParciais] = useState((trade?.execucoes.length ?? 0) > 0);
  const [linhas, setLinhas] = useState<LinhaExecucaoForm[]>(
    trade?.execucoes.map((e) => ({ tipo: e.tipo, quantidade: String(e.quantidade), notas: e.notas ?? "" })) ?? [],
  );

  function adicionarLinha() {
    setLinhas((ls) => [...ls, { tipo: "Parcial", quantidade: "", notas: "" }]);
  }
  function removerLinha(i: number) {
    setLinhas((ls) => ls.filter((_, idx) => idx !== i));
  }
  function atualizarLinha(i: number, campo: keyof LinhaExecucaoForm, valor: string) {
    setLinhas((ls) => ls.map((l, idx) => (idx === i ? { ...l, [campo]: valor } : l)));
  }

  // Em edição o diálogo já abre; em cadastro espera o clique no botão.
  useEffect(() => {
    if (editando) dialogo.current?.showModal();
  }, [editando]);

  const num = (t: string) => {
    const n = Number(t.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
    return Number.isFinite(n) && t.trim() !== "" ? n : null;
  };

  const p = num(pontos);
  const c = num(contratos);
  const r = num(resultado);

  const fechamento =
    c !== null
      ? fechamentoDeExecucoes(
          Math.round(c),
          linhas.map((l) => ({ tipo: l.tipo, quantidade: num(l.quantidade) ?? 0, notas: null })),
        )
      : null;

  const stopDolar =
    p !== null && c !== null && c > 0 && especificacoes[ativo]
      ? stopEmDolar(p, especificacoes[ativo]!.valorPonto, c)
      : null;
  const sugerido = r !== null && stopDolar ? riscoRetornoSugerido(r, stopDolar) : null;

  // O R:R chega pré-calculado; escolher à mão para de ser sobrescrito.
  const rrAuto =
    sugerido === null
      ? null
      : String(
          [...RISCO_RETORNO].sort(
            (a, b) => Math.abs(a.valor - sugerido) - Math.abs(b.valor - sugerido),
          )[0].valor,
        );
  const rr = rrManual ?? rrAuto ?? "";

  // Fecha o diálogo e limpa o input de arquivo quando a Server Action confirma
  // o salvamento — são operações imperativas em elementos nativos, não dá pra
  // fazer isso durante o render. O reset dos campos vai junto, como parte do
  // mesmo "limpar o formulário".
  useEffect(() => {
    if (!estado.ok) return;
    dialogo.current?.close();
    if (!editando) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ver comentário acima
      setPontos(""); setContratos(""); setResultado(""); setRrManual(null); setPrevia(null);
      setTeveParciais(false); setLinhas([]);
      setSetupId(""); setRespeitouPlano(true);
      if (arquivo.current) arquivo.current.value = "";
    }
    aoFechar?.();
  }, [estado, editando, aoFechar]);

  function fechar() {
    dialogo.current?.close();
    aoFechar?.();
  }

  const unidade = especificacoes[ativo]?.unidade ?? "pontos";

  return (
    <>
      {!editando && (
        <button
          type="button"
          onClick={() => dialogo.current?.showModal()}
          className="flex h-[38px] items-center gap-2 rounded-lg bg-accent px-[15px] text-[14.5px] font-semibold text-accent-ink"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
            <path d="M8 3v10M3 8h10" />
          </svg>
          Novo trade
        </button>
      )}

      <dialog
        ref={dialogo}
        onClose={() => aoFechar?.()}
        className="m-auto w-[952px] max-w-[calc(100vw-40px)] whitespace-normal rounded-[15px] border border-line-strong bg-card p-0 text-left text-ink backdrop:bg-black/75"
      >
        <form action={acao} autoComplete="off">
          <input type="hidden" name="conta_id" value={contaId} />
          {trade && <input type="hidden" name="id" value={trade.id} />}

          <header className="flex items-center justify-between border-b border-line px-[26px] py-[22px]">
            <h2 className="display text-[21px]">{editando ? "Editar trade" : "Novo trade"}</h2>
            <button type="button" onClick={fechar} aria-label="Fechar" className="text-ink-3 hover:text-ink">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </header>

          <div className="grid grid-cols-[minmax(0,1fr)_344px] gap-[26px] px-[26px] py-6">
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-4">
                <label>
                  <span className={rotulo}>Data</span>
                  <input name="data" type="date" defaultValue={trade?.data ?? new Date().toISOString().slice(0, 10)} className={`${campo} num`} />
                </label>
                <label>
                  <span className={rotulo}>Hora de entrada</span>
                  <input name="hora_inicio" type="time" defaultValue={trade?.hora_inicio?.slice(0, 5) ?? ""} className={`${campo} num`} />
                </label>
                <label>
                  <span className={rotulo}>Hora de saída</span>
                  <input name="hora_fim" type="time" defaultValue={trade?.hora_fim?.slice(0, 5) ?? ""} className={`${campo} num`} />
                </label>
              </div>

              <div>
                <span className={rotulo}>Ativo</span>
                <div className="flex flex-wrap gap-[7px]">
                  {ativosPermitidos.map((a) => (
                    <label key={a.codigo}>
                      <input
                        type="radio"
                        name="ativo"
                        value={a.codigo}
                        checked={ativo === a.codigo}
                        onChange={() => setAtivo(a.codigo)}
                        className="peer sr-only"
                      />
                      <span className="num block cursor-pointer rounded-lg border border-line-strong bg-raised px-[14px] py-[9px] text-[14.5px] font-medium text-ink-3 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink">
                        {a.codigo}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <span className={rotulo}>Tempo gráfico</span>
                <div className="flex flex-wrap gap-[7px]">
                  {TEMPOS_GRAFICOS.map((t) => (
                    <label key={t}>
                      <input type="radio" name="tempo_grafico" value={t} defaultChecked={(trade?.tempo_grafico ?? "2m") === t} className="peer sr-only" />
                      <span className="num block cursor-pointer rounded-lg border border-line-strong bg-raised px-[14px] py-[9px] text-[14.5px] font-medium text-ink-3 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink">
                        {t}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <label>
                <span className={rotulo}>Setup</span>
                <select
                  name="setup_id"
                  value={setupId}
                  onChange={(e) => {
                    setSetupId(e.target.value);
                    if (e.target.value === SEM_SETUP) setRespeitouPlano(false);
                  }}
                  className={`${campo} appearance-none`}
                >
                  <option value="">Selecione</option>
                  <option value={SEM_SETUP}>Sem setup</option>
                  {setups.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </label>

              <div>
                <span className={rotulo}>Tipo de entrada</span>
                <div className="flex flex-wrap gap-[7px]">
                  {ENTRADAS.map((e) => (
                    <label key={e}>
                      {/* Sem defaultChecked: obrigatório é escolher, não herdar
                          um padrão silencioso. Trade antigo (entrada nula)
                          abre em branco e força a decisão na edição. */}
                      <input type="radio" name="entrada" value={e} defaultChecked={trade?.entrada === e} className="peer sr-only" />
                      <span className="block cursor-pointer rounded-lg border border-line-strong bg-raised px-[14px] py-[9px] text-[14.5px] font-medium text-ink-3 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink">
                        {e}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <label>
                  <span className={rotulo}>Stop em {unidade}</span>
                  <input name="pontos_stop" inputMode="decimal" value={pontos} onChange={(e) => setPontos(e.target.value)} placeholder="12,5" className={`${campo} num`} />
                </label>
                <label>
                  <span className={rotulo}>Contratos</span>
                  <input name="contratos" inputMode="numeric" value={contratos} onChange={(e) => setContratos(e.target.value)} placeholder="3" className={`${campo} num`} />
                </label>
                <div>
                  <span className={rotulo}><Ponto />Stop inicial</span>
                  <div className={calculado}>
                    <span className="num">{stopDolar === null ? VAZIO : moeda(stopDolar, moedaConta)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-[11px] border border-line-strong bg-well p-4">
                <label className="flex cursor-pointer items-center gap-[10px] text-[14.5px] text-ink-2">
                  <input
                    type="checkbox"
                    name="teve_parciais"
                    checked={teveParciais}
                    onChange={(e) => {
                      setTeveParciais(e.target.checked);
                      if (e.target.checked && linhas.length === 0) adicionarLinha();
                    }}
                    className="size-[18px] appearance-none rounded-[5px] border border-line-strong bg-input checked:border-accent checked:bg-accent checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222.6%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M3 8.4l3.2 3.2L13 4.8%22/></svg>')] checked:bg-center checked:bg-no-repeat"
                  />
                  Teve parciais ou adições
                </label>

                {teveParciais && (
                  <div className="mt-4 flex flex-col gap-2.5">
                    {linhas.map((l, i) => (
                      <div key={i} className="grid grid-cols-[1fr_100px_1fr_32px] items-center gap-2">
                        <select
                          name="execucao_tipo"
                          value={l.tipo}
                          onChange={(e) => atualizarLinha(i, "tipo", e.target.value)}
                          className={`${campo} h-[38px] appearance-none text-[14px]`}
                        >
                          {TIPOS_EXECUCAO.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <input
                          name="execucao_quantidade"
                          inputMode="numeric"
                          value={l.quantidade}
                          onChange={(e) => atualizarLinha(i, "quantidade", e.target.value)}
                          placeholder="contratos"
                          className={`${campo} num h-[38px] text-[14px]`}
                        />
                        <input
                          name="execucao_notas"
                          value={l.notas}
                          onChange={(e) => atualizarLinha(i, "notas", e.target.value)}
                          placeholder="Notas (opcional)"
                          className={`${campo} h-[38px] text-[14px]`}
                        />
                        <button
                          type="button"
                          onClick={() => removerLinha(i)}
                          aria-label="Remover execução"
                          className="flex size-[32px] items-center justify-center text-ink-4 hover:text-loss"
                        >
                          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                            <path d="M4 4l8 8M12 4l-8 8" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={adicionarLinha}
                      className="self-start text-[13.5px] font-medium text-accent-soft hover:underline"
                    >
                      + Adicionar execução
                    </button>

                    {fechamento && (
                      <p className={`mt-1 text-[13px] font-medium ${fechamento.fechado ? "text-gain" : fechamento.falta < 0 ? "text-loss" : "text-ink-3"}`}>
                        {fechamento.fechado
                          ? "✓ soma bate com a quantidade de contratos"
                          : fechamento.falta > 0
                            ? `faltam ${fechamento.falta} contrato${fechamento.falta === 1 ? "" : "s"} para fechar`
                            : !fechamento.temSaida
                              ? 'inclua uma execução de "Saída do trade" para fechar'
                              : `a soma passou ${Math.abs(fechamento.falta)} contrato${Math.abs(fechamento.falta) === 1 ? "" : "s"} da quantidade`}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <label>
                  <span className={rotulo}>Resultado ({moedaConta})</span>
                  <input
                    name="resultado"
                    inputMode="decimal"
                    value={resultado}
                    onChange={(e) => setResultado(e.target.value)}
                    placeholder="225 ou -85"
                    className={`${campo} num ${r === null ? "" : r > 0 ? "border-gain text-gain" : r < 0 ? "border-loss text-loss" : ""}`}
                  />
                </label>
                <div>
                  <span className={rotulo}><Ponto />Status</span>
                  <div className={calculado}>
                    {r === null ? (
                      <span>{VAZIO}</span>
                    ) : (
                      <span className={r > 0 ? "font-semibold text-gain" : r < 0 ? "font-semibold text-loss" : ""}>
                        {statusDoResultado(r)}
                      </span>
                    )}
                  </div>
                </div>
                <div />
              </div>

              <div>
                <span className={rotulo}>
                  <Ponto />
                  Risco retorno
                  {sugerido !== null && (
                    <span className="ml-1 font-normal normal-case tracking-normal text-ink-4">
                      calculado em {sugerido.toFixed(2).replace(".", ",")} — ajuste se quiser
                    </span>
                  )}
                </span>
                <div className="flex flex-wrap gap-[7px]">
                  {RISCO_RETORNO.map((o) => (
                    <label key={o.valor}>
                      <input
                        type="radio"
                        name="risco_retorno"
                        value={o.valor}
                        checked={rr === String(o.valor)}
                        onChange={() => setRrManual(String(o.valor))}
                        className="peer sr-only"
                      />
                      <span className="num block cursor-pointer rounded-lg border border-line-strong bg-raised px-[14px] py-[9px] text-[14.5px] font-medium text-ink-3 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink">
                        {o.rotulo}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <label className={`flex items-center gap-[10px] text-[14.5px] ${semSetup ? "text-ink-4" : "cursor-pointer text-ink-2"}`}>
                <input
                  type="checkbox"
                  name="respeitou_plano"
                  checked={semSetup ? false : respeitouPlano}
                  disabled={semSetup}
                  onChange={(e) => setRespeitouPlano(e.target.checked)}
                  className="size-[18px] appearance-none rounded-[5px] border border-line-strong bg-input checked:border-accent checked:bg-accent checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222.6%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M3 8.4l3.2 3.2L13 4.8%22/></svg>')] checked:bg-center checked:bg-no-repeat disabled:cursor-not-allowed disabled:opacity-50"
                />
                Respeitou o plano
                {semSetup && <span className="normal-case font-normal text-ink-4">— sem setup nunca é plano</span>}
              </label>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <span className={rotulo}>Print do trade</span>
                <div className="rounded-[11px] border border-dashed border-line-strong bg-well p-[11px]">
                  <button
                    type="button"
                    onClick={() => arquivo.current?.click()}
                    className="flex h-[200px] w-full items-center justify-center overflow-hidden rounded-lg bg-input p-2"
                  >
                    {previa ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previa} alt="" className="size-full rounded-md object-contain" />
                    ) : (
                      <span className="text-[13.5px] text-ink-4">clique para escolher o print</span>
                    )}
                  </button>
                  <input
                    ref={arquivo}
                    type="file"
                    name="imagem"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setPrevia(URL.createObjectURL(f));
                    }}
                    className="sr-only"
                  />
                </div>
              </div>

              <label className="flex flex-1 flex-col">
                <span className={rotulo}>Observação</span>
                <textarea name="observacao" rows={6} defaultValue={trade?.observacao ?? ""} className="flex-1 resize-y rounded-[9px] border border-line-strong bg-input px-[14px] py-3 text-[14.5px] leading-[1.6] text-ink-2 outline-none focus:border-accent" />
              </label>
            </div>
          </div>

          {estado.erro && (
            <p role="alert" className="mx-[26px] mb-4 rounded-[10px] border border-loss/40 bg-loss-bg px-4 py-3 text-[14px] text-loss">
              {estado.erro}
            </p>
          )}

          <footer className="flex items-center justify-between border-t border-line bg-tint px-[26px] py-[18px]">
            <p className="flex items-center gap-2 text-[13.5px] text-ink-4">
              <Ponto />
              os campos tracejados o app calcula sozinho
            </p>
            <div className="flex gap-2.5">
              <button type="button" onClick={fechar} className="h-[42px] rounded-[9px] border border-line-strong bg-raised px-[19px] text-[15px] font-medium text-ink-2">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando || (teveParciais && (linhas.length === 0 || !fechamento?.fechado))}
                className="h-[42px] rounded-[9px] bg-accent px-[19px] text-[15px] font-semibold text-accent-ink disabled:opacity-60"
              >
                {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Salvar trade"}
              </button>
            </div>
          </footer>
        </form>
      </dialog>
    </>
  );
}
