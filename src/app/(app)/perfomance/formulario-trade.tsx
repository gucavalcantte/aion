"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { ATIVOS, type Ativo, type Moeda } from "@/lib/ativos";
import { moeda, VAZIO } from "@/lib/formato";
import { riscoRetornoSugerido, statusDoResultado, stopEmDolar } from "@/lib/metricas";
import { RISCO_RETORNO, TEMPOS_GRAFICOS } from "@/lib/opcoes";

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
  setup_id: string;
  pontos_stop: number;
  contratos: number;
  resultado: number;
  risco_retorno: number | null;
  respeitou_plano: boolean;
  observacao: string | null;
  imagem: string | null;
};

export function FormularioTrade({
  contaId,
  setups,
  moedaConta,
  trade,
  aoFechar,
}: {
  contaId: string;
  setups: { id: string; nome: string }[];
  moedaConta: Moeda;
  /** Presente = corrigindo um trade já salvo. */
  trade?: TradeParaEdicao;
  aoFechar?: () => void;
}) {
  const editando = Boolean(trade);
  const ativosPermitidos = ATIVOS.filter((a) => a.moeda === moedaConta || a.codigo === trade?.ativo);
  const dialogo = useRef<HTMLDialogElement>(null);
  const [estado, acao, enviando] = useActionState(salvarTrade, INICIAL);

  const [ativo, setAtivo] = useState<Ativo>(trade?.ativo ?? ativosPermitidos[0]?.codigo ?? "MNQ");
  const [pontos, setPontos] = useState(trade ? String(trade.pontos_stop) : "");
  const [contratos, setContratos] = useState(trade ? String(trade.contratos) : "");
  const [resultado, setResultado] = useState(trade ? String(trade.resultado) : "");
  const [rr, setRr] = useState(trade?.risco_retorno != null ? String(trade.risco_retorno) : "");
  const [previa, setPrevia] = useState<string | null>(trade?.imagem ?? null);
  const [tocouRr, setTocouRr] = useState(editando);
  const arquivo = useRef<HTMLInputElement>(null);

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

  const stopDolar = p !== null && c !== null && c > 0 ? stopEmDolar(p, ativo, c) : null;
  const sugerido = r !== null && stopDolar ? riscoRetornoSugerido(r, stopDolar) : null;

  // O R:R chega pré-calculado; escolher à mão para de ser sobrescrito.
  useEffect(() => {
    if (sugerido === null || tocouRr) return;
    const maisProximo = [...RISCO_RETORNO].sort(
      (a, b) => Math.abs(a.valor - sugerido) - Math.abs(b.valor - sugerido),
    )[0];
    setRr(String(maisProximo.valor));
  }, [sugerido, tocouRr]);

  useEffect(() => {
    if (!estado.ok) return;
    dialogo.current?.close();
    if (!editando) {
      setPontos(""); setContratos(""); setResultado(""); setRr(""); setPrevia(null);
      setTocouRr(false);
      if (arquivo.current) arquivo.current.value = "";
    }
    aoFechar?.();
  }, [estado, editando, aoFechar]);

  function fechar() {
    dialogo.current?.close();
    aoFechar?.();
  }

  const unidade = ATIVOS.find((a) => a.codigo === ativo)?.unidade ?? "pontos";

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
                <select name="setup_id" defaultValue={trade?.setup_id ?? ""} className={`${campo} appearance-none`}>
                  <option value="">Selecione</option>
                  {setups.map((s) => (
                    <option key={s.id} value={s.id}>{s.nome}</option>
                  ))}
                </select>
              </label>

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
                        onChange={() => { setRr(String(o.valor)); setTocouRr(true); }}
                        className="peer sr-only"
                      />
                      <span className="num block cursor-pointer rounded-lg border border-line-strong bg-raised px-[14px] py-[9px] text-[14.5px] font-medium text-ink-3 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-ink">
                        {o.rotulo}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer items-center gap-[10px] text-[14.5px] text-ink-2">
                <input
                  type="checkbox"
                  name="respeitou_plano"
                  defaultChecked={trade?.respeitou_plano ?? true}
                  className="size-[18px] appearance-none rounded-[5px] border border-line-strong bg-input checked:border-accent checked:bg-accent checked:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 16 16%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222.6%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22M3 8.4l3.2 3.2L13 4.8%22/></svg>')] checked:bg-center checked:bg-no-repeat"
                />
                Respeitou o plano
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
              <button type="submit" disabled={enviando} className="h-[42px] rounded-[9px] bg-accent px-[19px] text-[15px] font-semibold text-accent-ink disabled:opacity-60">
                {enviando ? "Salvando…" : editando ? "Salvar alterações" : "Salvar trade"}
              </button>
            </div>
          </footer>
        </form>
      </dialog>
    </>
  );
}
