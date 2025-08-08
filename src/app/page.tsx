"use client";

import { useState, useMemo, ReactElement, useRef, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';
import { ChevronDown } from 'lucide-react';

// --- DADOS MOCKADOS V4.2 (variação por Mês/Ano para testar filtros) ---
const generateMockData = (agfs: string[], anos: number[], meses: number[]) => {
  const data: any = {};
  for (const ano of anos) {
    data[ano] = {};
    for (const mes of meses) {
      data[ano][mes] = {};
      for (const agf of agfs) {
        const baseReceita = 50000 + Math.random() * 25000;
        const variacao = (ano - 2023) * 0.08 + (mes - 1) * 0.02 + (Math.random() - 0.5) * 0.12;
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
  { id: 'cl', nome: 'Campo Limpo' },
  { id: 'rp', nome: 'Republica' },
  { id: 'sj', nome: 'São Jorge' },
  { id: 'jm', nome: 'Jd. Marajoara' },
];
const anoList = [2023, 2024, 2025];
const mesList = Array.from({ length: 12 }, (_, i) => i + 1);
const mockApiData = {
  agfs: agfList,
  categoriasDespesa: ['aluguel', 'comissoes', 'extras', 'folha_pagamento', 'impostos', 'veiculos', 'telefone'],
  dados: generateMockData(agfList.map((a) => a.nome), anoList, mesList),
};

// --- COMPONENTES DE UI ---
const Card = ({ title, value, borderColor, valueColor }: { title: string; value: string; borderColor: string; valueColor?: string }) => (
  <div className="bg-card p-4 rounded-lg border-l-4" style={{ borderColor }}>
    <h3 className="text-sm text-text/80 font-semibold">{title}</h3>
    <p className={`text-2xl font-bold ${valueColor || 'text-text'}`}>{value}</p>
  </div>
);

const ChartContainer = ({ title, children, className = '' }: { title: string; children: ReactElement; className?: string }) => (
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
          <p key={index} style={{ color: pld.fill || pld.stroke }}>{`${pld.name}: ${formatter(pld.value)}`}</p>
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
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setIsOpen(!isOpen)} className="bg-card border border-primary/50 text-white p-2 rounded-md focus:ring-2 focus:ring-primary w-full flex justify-between items-center">
        <span>
          {name} ({selected.length || 'Todos'})
        </span>
        <ChevronDown size={16} />
      </button>
      {isOpen && (
        <div className="absolute z-10 top-full mt-1 w-full bg-card border border-primary/50 rounded-md max-h-60 overflow-y-auto">
          {options.map((option) => (
            <label key={option.id} className="flex items-center gap-2 p-2 hover:bg-primary/20 cursor-pointer">
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
  // Guardamos IDs de AGF, e números de mês/ano
  const [agfsSelecionadas, setAgfsSelecionadas] = useState<string[]>([]);
  const [mesesSelecionados, setMesesSelecionados] = useState<number[]>([]);
  const [anosSelecionados, setAnosSelecionados] = useState<number[]>([]);
  const [categoriasExcluidas, setCategoriasExcluidas] = useState<string[]>([]);

  const dadosProcessados = useMemo(() => {
    const idsAgf = agfsSelecionadas.length > 0 ? agfsSelecionadas : mockApiData.agfs.map((a) => a.id);
    const anos = anosSelecionados.length > 0 ? anosSelecionados : anoList;
    const meses = mesesSelecionados.length > 0 ? mesesSelecionados : mesList;

    // Transformamos IDs -> Nomes para acessar mockApiData.dados
    const agfsFiltradas = mockApiData.agfs.filter((a) => idsAgf.includes(a.id));

    const totaisPorAgf: any[] = [];
    for (const agf of agfsFiltradas) {
      let totalReceita = 0;
      let totalObjetos = 0;
      const totalDespesasPorCategoria: Record<string, number> = {};
      mockApiData.categoriasDespesa.forEach((cat) => (totalDespesasPorCategoria[cat] = 0));

      for (const ano of anos) {
        for (const mes of meses) {
          const d = mockApiData.dados[ano]?.[mes]?.[agf.nome];
          if (d) {
            totalReceita += d.receita as number;
            totalObjetos += d.objetos as number;
            for (const cat of mockApiData.categoriasDespesa) {
              totalDespesasPorCategoria[cat] += d.despesas[cat as keyof typeof d.despesas] as number;
            }
          }
        }
      }

      const despesaTotal = Object.values(totalDespesasPorCategoria).reduce((a, b) => (a as number) + (b as number), 0) as number;
      const resultado = totalReceita - despesaTotal;
      const margemLucro = totalReceita > 0 ? (resultado / totalReceita) * 100 : 0;

      const despesaSimulada = Object.entries(totalDespesasPorCategoria)
        .filter(([key]) => !categoriasExcluidas.includes(key))
        .reduce((acc, [, val]) => (acc as number) + (val as number), 0) as number;

      const resultadoSimulado = totalReceita - despesaSimulada;
      const margemSimulada = totalReceita > 0 ? (resultadoSimulado / totalReceita) * 100 : 0;
      const ganhoMargem = margemSimulada - margemLucro;

      totaisPorAgf.push({
        nome: agf.nome,
        receita: totalReceita,
        despesaTotal,
        resultado,
        margemLucro,
        objetos: totalObjetos,
        despesasDetalhadas: totalDespesasPorCategoria,
        margemLucroReal: margemLucro,
        ganhoMargem: ganhoMargem > 0 ? ganhoMargem : 0,
      });
    }

    const totaisGerais = {
      receita: totaisPorAgf.reduce((a, b) => a + b.receita, 0),
      despesa: totaisPorAgf.reduce((a, b) => a + b.despesaTotal, 0),
      resultado: totaisPorAgf.reduce((a, b) => a + b.resultado, 0),
      objetos: totaisPorAgf.reduce((a, b) => a + b.objetos, 0),
    };

    // Evolução ao longo do tempo deve respeitar meses/anos selecionados
    const evolucaoResultado = meses.map((mes) => {
      let resultadoMes = 0;
      for (const ano of anos) {
        for (const agf of agfsFiltradas) {
          const d = mockApiData.dados[ano]?.[mes]?.[agf.nome];
          if (d) {
            const desp = Object.values(d.despesas).reduce((x, y) => (x as number) + (y as number), 0) as number;
            resultadoMes += (d.receita as number) - desp;
          }
        }
      }
      return { mes: new Date(0, mes - 1).toLocaleString('pt-BR', { month: 'short' }), resultado: resultadoMes };
    });

    return { totaisPorAgf, totaisGerais, evolucaoResultado };
  }, [agfsSelecionadas, mesesSelecionados, anosSelecionados, categoriasExcluidas]);

  const handleMultiSelect = (setter: Function, value: any) => {
    setter((prev: any[]) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const currencyFormatter = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const percentFormatter = (value: number) => `${value.toFixed(1)}%`;
  const numberFormatter = (value: number) => value.toLocaleString('pt-BR');
  const compactNumberFormatter = (value: number) => value.toLocaleString('pt-BR', { notation: 'compact' });

  const CORES = {
    receita: '#4AA8FF',
    despesa: '#E74C3C',
    resultado: '#48DB8A',
    objetos: '#F2C14E',
    margem: '#A974F8',
    simulacaoReal: '#A974F8',
    simulacaoGanho: '#F4D35E',
  };

  return (
    <div className="p-4 md:p-8">
      <main className="max-w-7xl mx-auto flex flex-col gap-8">
        <header className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MultiSelectFilter name="AGF" options={mockApiData.agfs} selected={agfsSelecionadas} onSelect={(id) => handleMultiSelect(setAgfsSelecionadas, id)} />
          <MultiSelectFilter name="Mês" options={mesList.map((m) => ({ id: m, nome: new Date(0, m - 1).toLocaleString('pt-BR', { month: 'long' }) }))} selected={mesesSelecionados} onSelect={(id) => handleMultiSelect(setMesesSelecionados, id)} />
          <MultiSelectFilter name="Ano" options={anoList.map((a) => ({ id: a, nome: a.toString() }))} selected={anosSelecionados} onSelect={(id) => handleMultiSelect(setAnosSelecionados, id)} />
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card title="Resultado" value={currencyFormatter(dadosProcessados.totaisGerais.resultado)} borderColor={CORES.resultado} valueColor="text-success" />
          <Card title="Receita Total" value={currencyFormatter(dadosProcessados.totaisGerais.receita)} borderColor={CORES.receita} valueColor="text-info" />
          <Card title="Despesa Total" value={currencyFormatter(dadosProcessados.totaisGerais.despesa)} borderColor={CORES.despesa} valueColor="text-destructive" />
          <Card title="Objetos Tratados" value={numberFormatter(dadosProcessados.totaisGerais.objetos)} borderColor={CORES.objetos} valueColor="text-warning" />
        </section>

        <section>
          <ChartContainer title="Resultado ao longo do tempo" className="h-[300px]">
            <AreaChart data={dadosProcessados.evolucaoResultado} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorResultado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F2935C" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#1F1F3C" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="mes" stroke="#E9F2FF" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} />
              <YAxis stroke="#E9F2FF" tickFormatter={compactNumberFormatter} tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} />
              <Tooltip content={<CustomTooltip formatter={currencyFormatter} />} cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} />
              <Area type="monotone" dataKey="resultado" name="Resultado" stroke="#F2935C" strokeWidth={2} fill="url(#colorResultado)" />
            </AreaChart>
          </ChartContainer>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartContainer title="Comparativo de Receita" className="h-[280px]">
            <BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="nome" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} />
              <YAxis hide={true} />
              <Tooltip content={<CustomTooltip formatter={currencyFormatter} />} cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} />
              <Bar dataKey="receita" fill={CORES.receita} name="Receita">
                <LabelList dataKey="receita" position="top" formatter={compactNumberFormatter} style={{ fill: '#E9F2FF', fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ChartContainer>

          <ChartContainer title="Comparativo de Despesa" className="h-[280px]">
            <BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="nome" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} />
              <YAxis hide={true} />
              <Tooltip content={<CustomTooltip formatter={currencyFormatter} />} cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} />
              <Bar dataKey="despesaTotal" fill={CORES.despesa} name="Despesa">
                <LabelList dataKey="despesaTotal" position="top" formatter={compactNumberFormatter} style={{ fill: '#E9F2FF', fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ChartContainer>

          <ChartContainer title="Comparativo de Resultado" className="h-[280px]">
            <BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="nome" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} />
              <YAxis hide={true} />
              <Tooltip content={<CustomTooltip formatter={currencyFormatter} />} cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} />
              <Bar dataKey="resultado" fill={CORES.resultado} name="Resultado">
                <LabelList dataKey="resultado" position="top" formatter={compactNumberFormatter} style={{ fill: '#E9F2FF', fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ChartContainer>

          <ChartContainer title="Comparativo de Margem de Lucro (%)" className="h-[280px]">
            <BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="nome" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} />
              <YAxis hide={true} />
              <Tooltip content={<CustomTooltip formatter={(v: number) => `${v.toFixed(1)}%`]} cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} />
              <Bar dataKey="margemLucro" fill={CORES.margem} name="Margem">
                <LabelList dataKey="margemLucro" position="top" formatter={(v: number) => `${v.toFixed(1)}%`} style={{ fill: '#E9F2FF', fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartContainer title="Folha de Pagamento" className="h-[350px]">
            <BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="nome" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} />
              <YAxis tickFormatter={compactNumberFormatter} tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} />
              <Tooltip content={<CustomTooltip formatter={currencyFormatter} />} cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} />
              <Bar dataKey="despesasDetalhadas.folha_pagamento" fill="#4472CA" name="Folha de Pagamento">
                <LabelList dataKey="despesasDetalhadas.folha_pagamento" position="top" formatter={compactNumberFormatter} style={{ fill: '#E9F2FF', fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ChartContainer>

          <ChartContainer title="Total Gasto em Veículos por AGF" className="h-[350px]">
            <PieChart>
              <Tooltip formatter={currencyFormatter} />
              <Legend wrapperStyle={{ fontSize: '12px', opacity: 0.8 }} />
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
                  return (
                    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>
                      {compactNumberFormatter((payload as any).despesasDetalhadas.veiculos)}
                    </text>
                  );
                }}
              >
                {dadosProcessados.totaisPorAgf.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={['#F2935C', '#BF6550', '#4472CA', '#48DB8A'][index % 4]} />)
                )}
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
                    <td className="p-2 text-right">{agf.objetos.toLocaleString('pt-BR')}</td>
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
                    {mockApiData.categoriasDespesa.map((cat) => (
                      <th key={cat} className="p-2 text-right capitalize">
                        {cat.replace('_', ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dadosProcessados.totaisPorAgf.map((agf) => (
                    <tr key={agf.nome} className="border-b border-white/10">
                      <td className="p-2 font-semibold">{agf.nome}</td>
                      {mockApiData.categoriasDespesa.map((cat) => (
                        <td key={cat} className="p-2 text-right text-destructive/90">
                          {(agf.despesasDetalhadas[cat as keyof typeof agf.despesasDetalhadas] || 0).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 0,
                          })}
                        </td>
                      ))}
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
            <p className="text-sm text-text/80 mb-2">Selecione despesas para excluir do cálculo:</p>
            <div className="flex flex-wrap gap-2">
              {mockApiData.categoriasDespesa.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleMultiSelect(setCategoriasExcluidas, cat)}
                  className={`px-3 py-1 text-xs rounded-full transition-colors capitalize ${
                    categoriasExcluidas.includes(cat) ? 'bg-primary text-white' : 'bg-gray-600/50 text-text/80'
                  }`}
                >
                  {cat.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <ChartContainer title="" className="h-[300px]">
            <BarChart data={dadosProcessados.totaisPorAgf} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis type="number" tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} />
              <YAxis type="category" dataKey="nome" stroke="#E9F2FF" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} width={80} />
              <Tooltip content={<CustomTooltip formatter={(v: number) => `${v.toFixed(1)}%`} />} cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '12px', opacity: 0.8 }} />
              <Bar dataKey="margemLucroReal" stackId="a" fill={CORES.simulacaoReal} name="Margem Real">
                <LabelList dataKey="margemLucroReal" position="center" formatter={(v: number) => `${v.toFixed(1)}%`} style={{ fill: '#E9F2FF', fontSize: 12 }} />
              </Bar>
              <Bar dataKey="ganhoMargem" stackId="a" fill={CORES.simulacaoGanho} name="Ganho de Margem">
                <LabelList dataKey="ganhoMargem" position="center" formatter={(v: number) => `${v.toFixed(1)}%`} style={{ fill: '#010326', fontSize: 12, fontWeight: 'bold' }} />
              </Bar>
            </BarChart>
          </ChartContainer>
        </section>
      </main>
    </div>
  );
}
