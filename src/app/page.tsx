"use client";

import { useState, useMemo, ReactElement, useRef, useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import { ChevronDown } from "lucide-react";

// --- DADOS MOCKADOS (apenas fallback) ---
const MOCK_AGFS = [
  { id: "cl", nome: "Campo Limpo" },
  { id: "rp", nome: "República" },
  { id: "sj", nome: "São Jorge" },
  { id: "st", nome: "Senador Teotônio" },
];
const MOCK_ANOS = [2024, 2025];
const MOCK_MESES = Array.from({ length: 12 }, (_, i) => i + 1);
const MOCK_CATEGORIAS = [
  "aluguel", "comissoes", "extras", "honorarios", "impostos",
  "pitney", "telefone", "veiculos", "folha_pagamento"
];

const generateMockData = () => {
  const data: any = {};
  for (const ano of MOCK_ANOS) {
    data[ano] = {};
    for (const mes of MOCK_MESES) {
      data[ano][mes] = {};
      for (const agf of MOCK_AGFS) {
        const receita = 100000 + Math.random() * 150000;
        const despesas: Record<string, number> = {};
        let despesaTotal = 0;
        for (const cat of MOCK_CATEGORIAS) {
          const val = receita * (Math.random() * 0.1);
          despesas[cat] = val;
          despesaTotal += val;
        }
        data[ano][mes][agf.nome] = {
          receita,
          objetos: Math.floor(20000 + Math.random() * 40000),
          despesa_total: despesaTotal,
          despesas,
        };
      }
    }
  }
  return data;
};

const mockApiData = {
  agfs: MOCK_AGFS,
  categoriasDespesa: MOCK_CATEGORIAS,
  dados: generateMockData(),
};

// --- COMPONENTES DE UI ---
const Card = ({ title, value, borderColor, valueColor }: { title: string; value: string; borderColor: string; valueColor?: string; }) => (
  <div className="bg-card p-4 rounded-lg border-l-4" style={{ borderColor }}>
    <h3 className="text-sm text-text/80 font-semibold">{title}</h3>
    <p className={`text-2xl font-bold ${valueColor || "text-text"}`}>{value}</p>
  </div>
);

const ChartContainer = ({ title, children, className = "" }: { title: string; children: ReactElement; className?: string; }) => (
  <div className={`bg-card p-4 rounded-lg flex flex-col ${className}`}>
    <h3 className="font-bold mb-4 text-text">{title}</h3>
    <div className="flex-grow h-full w-full">
      <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background-end p-2 border border-primary/50 rounded-md text-sm">
        <p className="label font-bold">{`${label}`}</p>
        {payload.map((pld: any, index: number) => (
          <p key={index} style={{ color: pld.fill || pld.stroke }}>
            {`${pld.name}: ${formatter(Number(pld.value ?? 0))}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const MultiSelectFilter = ({ name, options, selected, onSelect }: { name: string; options: { id: any; nome: string }[]; selected: any[]; onSelect: (id: any) => void; }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className="bg-card border border-primary/50 text-white p-2 rounded-md focus:ring-2 focus:ring-primary w-full flex justify-between items-center">
        <span>{name} ({selected.length === 0 ? "Todos" : selected.length})</span>
        <ChevronDown size={16} />
      </button>
      {isOpen && (
        <div className="absolute z-10 top-full mt-1 w-full bg-card border border-primary/50 rounded-md max-h-60 overflow-y-auto">
          {options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 p-2 hover:bg-primary/20 cursor-pointer">
              <input type="checkbox" checked={selected.includes(option.id)} onChange={() => onSelect(option.id)} className="form-checkbox h-4 w-4 text-primary bg-card border-primary/50 rounded focus:ring-primary" />
              <span>{option.nome}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// --- PÁGINA PRINCIPAL ---
export default function DashboardPage() {
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("empresa_id");
      if (id) {
        setEmpresaId(id);
      }
    }
  }, []);

  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!empresaId) {
      setLoading(false); // Use mock data if no ID
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/dash-data?empresa_id=${encodeURIComponent(empresaId)}`, { cache: "no-store" });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({error: `API retornou status ${res.status}`}));
          throw new Error(errBody.error);
        }
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setApiData(json);
      } catch (e: any) {
        console.error(e);
        setError(`Falha ao carregar dados: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [empresaId]);

  const [agfsSelecionadas, setAgfsSelecionadas] = useState<string[]>([]);
  const [mesesSelecionados, setMesesSelecionados] = useState<number[]>([]);
  const [anosSelecionados, setAnosSelecionados] = useState<number[]>([]);
  const [categoriasExcluidas, setCategoriasExcluidas] = useState<string[]>([]);

  const sourceData = apiData || mockApiData;
  const { agfs: sourceAgfs, categoriasDespesa: sourceCategorias, dados: sourceDados } = sourceData;
  
  const anosDisponiveis = useMemo(() => {
    const anos = sourceDados ? Object.keys(sourceDados).map(Number) : MOCK_ANOS;
    return anos.sort((a, b) => a - b);
  }, [sourceDados]);

  const dadosProcessados = useMemo(() => {
    const idsAgf = agfsSelecionadas.length > 0 ? agfsSelecionadas : sourceAgfs.map((a: any) => a.id);
    const anos = anosSelecionados.length > 0 ? anosSelecionados : anosDisponiveis;
    const meses = mesesSelecionados.length > 0 ? mesesSelecionados : MOCK_MESES;

    const agfsFiltradas = sourceAgfs.filter((a: any) => idsAgf.includes(a.id));

    const totaisPorAgf = agfsFiltradas.map((agf: any) => {
      let totalReceita = 0;
      let totalObjetos = 0;
      const despesasDetalhadas: Record<string, number> = {};
      sourceCategorias.forEach((cat: string) => despesasDetalhadas[cat] = 0);

      for (const ano of anos) {
        for (const mes of meses) {
          const d = sourceDados?.[ano]?.[mes]?.[agf.nome];
          if (d) {
            totalReceita += Number(d.receita ?? 0);
            totalObjetos += Number(d.objetos ?? 0);
            for (const cat of sourceCategorias) {
              despesasDetalhadas[cat] += Number(d.despesas?.[cat] ?? 0);
            }
          }
        }
      }

      const despesaTotal = Object.values(despesasDetalhadas).reduce((a, b) => a + b, 0);
      const resultado = totalReceita - despesaTotal;
      const margemLucro = totalReceita > 0 ? (resultado / totalReceita) * 100 : 0;

      const despesaSimulada = Object.entries(despesasDetalhadas)
        .filter(([key]) => !categoriasExcluidas.includes(key))
        .reduce((acc, [, val]) => acc + val, 0);

      const resultadoSimulado = totalReceita - despesaSimulada;
      const margemSimulada = totalReceita > 0 ? (resultadoSimulado / totalReceita) * 100 : 0;
      const ganhoMargem = margemSimulada - margemLucro;

      return {
        nome: agf.nome,
        receita: totalReceita,
        despesaTotal,
        resultado,
        margemLucro,
        objetos: totalObjetos,
        despesasDetalhadas,
        margemLucroReal: margemLucro,
        ganhoMargem: ganhoMargem > 0 ? ganhoMargem : 0,
      };
    });

    const totaisGerais = {
      receita: totaisPorAgf.reduce((a, b) => a + b.receita, 0),
      despesa: totaisPorAgf.reduce((a, b) => a + b.despesaTotal, 0),
      resultado: totaisPorAgf.reduce((a, b) => a + b.resultado, 0),
      objetos: totaisPorAgf.reduce((a, b) => a + b.objetos, 0),
    };

    const evolucaoResultado = MOCK_MESES.map((mes) => {
      let resultadoMes = 0;
      const anosParaEvolucao = anosSelecionados.length > 0 ? anosSelecionados : [anosDisponiveis[anosDisponiveis.length - 1]];
      
      for (const ano of anosParaEvolucao) {
        for (const agf of agfsFiltradas) {
          const d = sourceDados?.[ano]?.[mes]?.[agf.nome];
          if (d) {
            const despesaMes = Object.values(d.despesas ?? {}).reduce((sum: number, v: any) => sum + Number(v ?? 0), 0);
            resultadoMes += Number(d.receita ?? 0) - despesaMes;
          }
        }
      }
      return {
        mes: new Date(2000, mes - 1).toLocaleString("pt-BR", { month: "short" }).replace('.','').toUpperCase(),
        Resultado: resultadoMes,
      };
    });

    return { totaisPorAgf, totaisGerais, evolucaoResultado };
  }, [agfsSelecionadas, mesesSelecionados, anosSelecionados, categoriasExcluidas, sourceAgfs, sourceCategorias, sourceDados, anosDisponiveis]);

  const handleMultiSelect = (setter: Function, value: any) => {
    setter((prev: any[]) => prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]);
  };

  const currencyFormatter = (value: number) => Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const percentFormatter = (value: number) => `${Number(value ?? 0).toFixed(1)}%`;
  const numberFormatter = (value: number) => Number(value ?? 0).toLocaleString("pt-BR");
  const compactNumberFormatter = (value: number) => Number(value ?? 0).toLocaleString("pt-BR", { notation: "compact" });

  const CORES = { receita: "#4AA8FF", despesa: "#E74C3C", resultado: "#48DB8A", objetos: "#F2C14E", margem: "#A974F8", simulacaoReal: "#A974F8", simulacaoGanho: "#F4D35E" };

  if (loading) return <div className="flex items-center justify-center h-screen bg-background-start text-white"><div className="p-6 text-lg">Carregando dados do dashboard...</div></div>;
  if (error) return <div className="flex items-center justify-center h-screen bg-background-start text-red-400"><div className="p-6 bg-card rounded-lg">{error}</div></div>;

  return (
    <div className="p-4 md:p-8 bg-background-start text-text min-h-screen">
      <main className="max-w-7xl mx-auto flex flex-col gap-8">
        <header className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MultiSelectFilter name="AGF" options={sourceAgfs} selected={agfsSelecionadas} onSelect={(id) => handleMultiSelect(setAgfsSelecionadas, id)} />
          <Multi
