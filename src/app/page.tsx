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

// --- DADOS MOCKADOS (mantidos como no seu original) ---
const generateMockData = (agfs: string[], anos: number[], meses: number[]) => {
  const data: any = {};
  for (const ano of anos) {
    data[ano] = {};
    for (const mes of meses) {
      data[ano][mes] = {};
      for (const agf of agfs) {
        const baseReceita = 50000 + Math.random() * 25000;
        const variacao =
          (ano - 2023) * 0.08 + (mes - 1) * 0.02 + (Math.random() - 0.5) * 0.12;
        const receita = baseReceita * (1 + variacao);
        data[ano][mes][agf] = {
          receita,
          objetos: Math.floor((receita / 4) * (1 + (Math.random() - 0.5) * 0.1)),
          despesas: {
            aluguel: receita * 0.08,
            comissoes: receita * 0.05,
            extras: receita * 0.02,
            folha_pagamento: receita * 0.35,
            impostos: receita * 0.1,
            veiculos: receita * 0.12,
            telefone: receita * 0.01,
          },
        };
      }
    }
  }
  return data;
};

const agfList = [
  { id: "cl", nome: "Campo Limpo" },
  { id: "rp", nome: "Republica" },
  { id: "sj", nome: "São Jorge" },
  { id: "jm", nome: "Jd. Marajoara" },
];
const anoList = [2023, 2024, 2025];
const mesList = Array.from({ length: 12 }, (_, i) => i + 1);
const mockApiData = {
  agfs: agfList,
  categoriasDespesa: [
    "aluguel",
    "comissoes",
    "extras",
    "folha_pagamento",
    "impostos",
    "veiculos",
    "telefone",
  ],
  dados: generateMockData(
    agfList.map((a) => a.nome),
    anoList,
    mesList
  ),
};

// --- COMPONENTES DE UI (mantidos como no seu original) ---
const Card = ({
  title,
  value,
  borderColor,
  valueColor,
}: {
  title: string;
  value: string;
  borderColor: string;
  valueColor?: string;
}) => (
  <div className="bg-card p-4 rounded-lg border-l-4" style={{ borderColor }}>
    <h3 className="text-sm text-text/80 font-semibold">{title}</h3>
    <p className={`text-2xl font-bold ${valueColor || "text-text"}`}>{value}</p>
  </div>
);

const ChartContainer = ({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactElement;
  className?: string;
}) => (
  <div className={`bg-card p-4 rounded-lg flex flex-col ${className}`}>
    <h3 className="font-bold mb-4 text-text">{title}</h3>
    <div className="flex-grow h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
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

const MultiSelectFilter = ({
  name,
  options,
  selected,
  onSelect,
}: {
  name: string;
  options: { id: any; nome: string }[];
  selected: any[];
  onSelect: (id: any) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-card border border-primary/50 text-white p-2 rounded-md focus:ring-2 focus:ring-primary w-full flex justify-between items-center"
      >
        <span>
          {name} ({selected.length === 0 ? "Todos" : selected.length})
        </span>
        <ChevronDown size={16} />
      </button>
      {isOpen && (
        <div className="absolute z-10 top-full mt-1 w-full bg-card border border-primary/50 rounded-md max-h-60 overflow-y-auto">
          {options.map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-2 p-2 hover:bg-primary/20 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.id)}
                onChange={() => onSelect(option.id)}
                className="form-checkbox h-4 w-4 text-primary bg-card border-primary/50 rounded focus:ring-primary"
              />
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
        console.log("ID da Empresa Mãe recebido do Bubble:", id);
      } else {
        console.log("Nenhum ID de empresa encontrado na URL. Mostrando dados de exemplo.");
      }
    }
  }, []);

  const [apiData, setApiData] = useState<null | {
    agfs: { id: string; nome: string }[];
    categoriasDespesa: string[];
    dados: any;
  }>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!empresaId) {
        setLoading(false);
        return;
    }
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(
          `/api/dash-data?empresa_id=${encodeURIComponent(empresaId)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`A API retornou o status ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setApiData(json);
        console.log("Dados reais carregados:", json);
      } catch (e: any) {
        console.error(e);
        setError(`Falha ao carregar dados reais: ${e.message}`);
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
    const anos = sourceDados ? Object.keys(sourceDados).map(Number) : anoList;
    return anos.sort((a, b) => a - b);
  }, [sourceDados]);

  const dadosProcessados = useMemo(() => {
    const idsAgf =
      agfsSelecionadas.length > 0
        ? agfsSelecionadas
        : sourceAgfs.map((a: any) => a.id);
    const anos = anosSelecionados.length > 0 ? anosSelecionados : anosDisponiveis;
    const meses = mesesSelecionados.length > 0 ? mesesSelecionados : mesList;

    const agfsFiltradas = sourceAgfs.filter((a: any) => idsAgf.includes(a.id));

    const totaisPorAgf = agfsFiltradas.map((agf: any) => {
      let totalReceita = 0;
      let totalObjetos = 0;
      const totalDespesasPorCategoria: Record<string, number> = {};
      sourceCategorias.forEach((cat: string) => (totalDespesasPorCategoria[cat] = 0));

      for (const ano of anos) {
        for (const mes of meses) {
          const d = sourceDados?.[ano]?.[mes]?.[agf.nome];
          if (d) {
            totalReceita += Number(d.receita ?? 0);
            totalObjetos += Number(d.objetos ?? 0);
            for (const cat of sourceCategorias) {
              totalDespesasPorCategoria[cat] += Number(d.despesas?.[cat] ?? 0);
            }
          }
        }
      }

      const despesaTotal = Object.values(totalDespesasPorCategoria).reduce(
        (a: number, b: number) => a + b, 0
      );
      const resultado = totalReceita - despesaTotal;
      const margemLucro = totalReceita > 0 ? (resultado / totalReceita) * 100 : 0;

      const despesaSimulada = Object.entries(totalDespesasPorCategoria)
        .filter(([key]) => !categoriasExcluidas.includes(key))
        .reduce((acc: number, [, val]) => acc + Number(val ?? 0), 0);

      const resultadoSimulado = totalReceita - despesaSimulada;
      const margemSimulada =
        totalReceita > 0 ? (resultadoSimulado / totalReceita) * 100 : 0;
      const ganhoMargem = margemSimulada - margemLucro;

      return {
        nome: agf.nome,
        receita: totalReceita,
        despesaTotal,
        resultado,
        margemLucro,
        objetos: totalObjetos,
        despesasDetalhadas: totalDespesasPorCategoria,
        margemLucroReal: margemLucro,
        ganhoMargem: ganhoMargem > 0 ? ganhoMargem : 0,
      };
    });

    const totaisGerais = {
      receita: totaisPorAgf.reduce((a, b) => a + Number(b.receita || 0), 0),
      despesa: totaisPorAgf.reduce((a, b) => a + Number(b.despesaTotal || 0), 0),
      resultado: totaisPorAgf.reduce((a, b) => a + Number(b.resultado || 0), 0),
      objetos: totaisPorAgf.reduce((a, b) => a + Number(b.objetos || 0), 0),
    };

    const evolucaoResultado = mesList.map((mes) => {
      let resultadoMes: number = 0;
      const anosParaEvolucao = anosSelecionados.length > 0 ? anosSelecionados : [anosDisponiveis[anosDisponiveis.length - 1] || new Date().getFullYear()];

      for (const ano of anosParaEvolucao) {
        for (const agf of agfsFiltradas) {
          const d = sourceDados?.[ano]?.[mes]?.[agf.nome];
          if (d) {
            const desp: number = Object.values(d.despesas ?? {}).reduce<number>(
              (sum: number, v: any) => sum + Number(v ?? 0),
              0
            );
            resultadoMes += Number(d.receita ?? 0) - desp;
          }
        }
      }
      return {
        mes: new Date(2000, mes - 1).toLocaleString("pt-BR", { month: "short" }).replace('.','').toUpperCase(),
        resultado: resultadoMes,
      };
    });

    return { totaisPorAgf, totaisGerais, evolucaoResultado };
  }, [
    agfsSelecionadas,
    mesesSelecionados,
    anosSelecionados,
    categoriasExcluidas,
    sourceAgfs,
    sourceCategorias,
    sourceDados,
    anosDisponiveis,
  ]);

  const handleMultiSelect = (setter: Function, value: any) => {
    setter((prev: any[]) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const currencyFormatter = (value: number) =>
    Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const percentFormatter = (value: number) => `${Number(value ?? 0).toFixed(1)}%`;
  const numberFormatter = (value: number) =>
    Number(value ?? 0).toLocaleString("pt-BR");
  const compactNumberFormatter = (value: number) =>
    Number(value ?? 0).toLocaleString("pt-BR", { notation: "compact" });

  const CORES = {
    receita: "#4AA8FF",
    despesa: "#E74C3C",
    resultado: "#48DB8A",
    objetos: "#F2C14E",
    margem: "#A974F8",
    simulacaoReal: "#A974F8",
    simulacaoGanho: "#F4D35E",
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-background-start text-white"><div className="p-6 text-lg">Carregando dados…</div></div>;
  if (error) return <div className="flex items-center justify-center h-screen bg-background-start text-red-400"><div className="p-6 bg-card rounded-lg">{error}</div></div>;

  return (
    <div className="p-4 md:p-8 bg-background-start text-text min-h-screen">
      <main className="max-w-7xl mx-auto flex flex-col gap-8">
        <header className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MultiSelectFilter
            name="AGF"
            options={sourceAgfs}
            selected={agfsSelecionadas}
            onSelect={(id) => handleMultiSelect(setAgfsSelecionadas, id)}
          />
          <MultiSelectFilter
            name="Mês"
            options={mesList.map((m) => ({
              id: m,
              nome: new Date(0, m - 1).toLocaleString("pt-BR", {
                month: "long",
              }),
            }))}
            selected={mesesSelecionados}
            onSelect={(id) => handleMultiSelect(setMesesSelecionados, id)}
          />
          <MultiSelectFilter
            name="Ano"
            options={anosDisponiveis.map((a) => ({ id: a, nome: a.toString() }))}
            selected={anosSelecionados}
            onSelect={(id) => handleMultiSelect(setAnosSelecionados, id)}
          />
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card
            title="Resultado"
            value={currencyFormatter(dadosProcessados.totaisGerais.resultado)}
            borderColor={CORES.resultado}
            valueColor="text-success"
          />
          <Card
            title="Receita Total"
            value={currencyFormatter(dadosProcessados.totaisGerais.receita)}
            borderColor={CORES.receita}
            valueColor="text-info"
          />
          <Card
            title="Despesa Total"
            value={currencyFormatter(dadosProcessados.totaisGerais.despesa)}
            borderColor={CORES.despesa}
            valueColor="text-destructive"
          />
          <Card
            title="Objetos Tratados"
            value={numberFormatter(dadosProcessados.totaisGerais.objetos)}
            borderColor={CORES.objetos}
            valueColor="text-warning"
          />
        </section>

        <section>
          <ChartContainer title="Resultado ao longo do tempo" className="h-[300px]">
            <AreaChart
              data={dadosProcessados.evolucaoResultado}
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <defs>
                <linearGradient id="colorResultado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F2935C" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#1F1F3C" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="mes" stroke="#E9F2FF" tick={{ fill: "#E9F2FF", opacity: 0.7, fontSize: 12 }} />
              <YAxis stroke="#E9F2FF" tickFormatter={compactNumberFormatter} tick={{ fill: "#E9F2FF", opacity: 0.7, fontSize: 12 }} />
              <Tooltip content={<CustomTooltip formatter={currencyFormatter} />} cursor={{ fill: "rgba(255, 255, 255, 0.1)" }} />
              <Area type="monotone" dataKey="resultado" name="Resultado" stroke="#F2935C" strokeWidth={2} fill="url(#colorResultado)" />
            </AreaChart>
          </ChartContainer>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartContainer title="Comparativo de Receita" className="h-[280px]">
            <BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="nome" tick={{ fill: "#E9F2FF", opacity: 0.7, fontSize: 12 }} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip formatter={currencyFormatter} />} cursor={{ fill: "rgba(255, 255, 255, 0.1)" }} />
              <Bar dataKey="receita" fill={CORES.receita} name="Receita">
                <LabelList dataKey="receita" position="top" formatter={(v: number) => compactNumberFormatter(Number(v ?? 0))} style={{ fill: "#E9F2FF", fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ChartContainer>

          <ChartContainer title="Comparativo de Despesa" className="h-[280px]">
            <BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="nome" tick={{ fill: "#E9F2FF", opacity: 0.7, fontSize: 12 }} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip formatter={currencyFormatter} />} cursor={{ fill: "rgba(255, 255, 255, 0.1)" }} />
              <Bar dataKey="despesaTotal" fill={CORES.despesa} name="Despesa">
                <LabelList dataKey="despesaTotal" position="top" formatter={(v: number) => compactNumberFormatter(Number(v ?? 0))} style={{ fill: "#E9F2FF", fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ChartContainer>

          <ChartContainer title="Comparativo de Resultado" className="h-[280px]">
            <BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="nome" tick={{ fill: "#E9F2FF", opacity: 0.7, fontSize: 12 }} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip formatter={currencyFormatter} />} cursor={{ fill: "rgba(255, 255, 255, 0.1)" }} />
              <Bar dataKey="resultado" fill={CORES.resultado} name="Resultado">
                <LabelList dataKey="resultado" position="top" formatter={(v: number) => compactNumberFormatter(Number(v ?? 0))} style={{ fill: "#E9F2FF", fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ChartContainer>

          <ChartContainer title="Comparativo de Margem de Lucro (%)" className="h-[280px]">
            <BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="nome" tick={{ fill: "#E9F2FF", opacity: 0.7, fontSize: 12 }} />
              <YAxis hide />
              <Tooltip content={<CustomTooltip formatter={percentFormatter} />} cursor={{ fill: "rgba(255, 255, 255, 0.1)" }} />
              <Bar dataKey="margemLucro" fill={CORES.margem} name="Margem">
                <LabelList dataKey="margemLucro" position="top" formatter={(v: number) => `${Number(v ?? 0).toFixed(1)}%`} style={{ fill: "#E9F2FF", fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartContainer title="Folha de Pagamento" className="h-[350px]">
            <BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="nome" tick={{ fill: "#E9F2FF", opacity: 0.7, fontSize: 12 }} />
              <YAxis tickFormatter={compactNumberFormatter} tick={{ fill: "#E9F2FF", opacity: 0.7, fontSize: 12 }} />
              <Tooltip content={<CustomTooltip formatter={currencyFormatter} />} cursor={{ fill: "rgba(255, 255, 255, 0.1)" }} />
              <Bar dataKey="despesasDetalhadas.folha_pagamento" fill="#4472CA" name="Folha de Pagamento">
                <LabelList dataKey="despesasDetalhadas.folha_pagamento" position="top" formatter={(v: number) => compactNumberFormatter(Number(v ?? 0))} style={{ fill: "#E9F2FF", fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ChartContainer>

          <ChartContainer title="Total Gasto em Veículos por AGF" className="h-[350px]">
            <PieChart>
              <Tooltip formatter={currencyFormatter} />
              <Legend wrapperStyle={{ fontSize: "12px", opacity: 0.8 }} />
              <Pie
                data={dadosProcessados.totaisPorAgf}
                dataKey="despesasDetalhadas.veiculos"
                nameKey="nome"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, payload }) => {
                  const radius = innerRadius + (outerRadius - innerRadius) * 1.2;
                  const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
                  const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));
                  const value = Number((payload as any)?.despesasDetalhadas?.veiculos ?? 0);
                  return (
                    <text
                      x={x}
                      y={y}
                      fill="white"
                      textAnchor={x > cx ? "start" : "end"}
                      dominantBaseline="central"
                      fontSize={12}
                    >
                      {compactNumberFormatter(value)}
                    </text>
                  );
                }}
              >
                {dadosProcessados.totaisPorAgf.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={["#F2935C", "#BF6550", "#4472CA", "#48DB8A"][index % 4]}
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-card p-4 rounded-lg">
            <h3 className="font-bold mb-4 text-text">Objetos Tratados</h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-primary/20">
                  <th className="p-2">AGF</th>
                  <th className="p-2 text-right">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {dadosProcessados.totaisPorAgf.map((agf) => (
                  <tr key={agf.nome} className="border-b border-white/10">
                    <td className="p-2 font-semibold">{agf.nome}</td>
                    <td className="p-2 text-right">
                      {agf.objetos.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:col-span-2 bg-card p-4 rounded-lg">
            <h3 className="font-bold mb-4 text-text">Despesas por Categoria</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-primary/20">
                    <th className="p-2">AGF</th>
                    {sourceCategorias.map((cat: string) => (
                      <th key={cat} className="p-2 text-right capitalize">
                        {cat.replace("_", " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dadosProcessados.totaisPorAgf.map((agf) => (
                    <tr key={agf.nome} className="border-b border-white/10">
                      <td className="p-2 font-semibold">{agf.nome}</td>
                      {sourceCategorias.map((cat: string) => {
                        const val = Number(
                          (agf.despesasDetalhadas as any)?.[cat] ?? 0
                        );
                        return (
                          <td key={cat} className="p-2 text-right text-destructive/90">
                            {val.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                              minimumFractionDigits: 0,
                            })}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bg-card p-4 rounded-lg">
          <h3 className="font-bold mb-4 text-text">Simulação de Margem de Lucro</h3>
          <div className="mb-4">
            <p className="text-sm text-text/80 mb-2">
              Selecione despesas para excluir do cálculo:
            </p>
            <div className="flex flex-wrap gap-2">
              {sourceCategorias.map((cat: string) => (
                <button
                  key={cat}
                  onClick={() => handleMultiSelect(setCategoriasExcluidas, cat)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors capitalize ${
                    categoriasExcluidas.includes(cat)
                      ? "bg-primary text-white"
                      : "bg-gray-600/50 text-text/80"
                  }`}
                >
                  {cat.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <ChartContainer title="" className="h-[300px]">
            <BarChart data={dadosProcessados.totaisPorAgf} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis type="number" tickFormatter={(v: number) => `${Number(v ?? 0).toFixed(1)}%`} tick={{ fill: "#E9F2FF", opacity: 0.7, fontSize: 12 }} />
              <YAxis type="category" dataKey
