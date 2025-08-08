"use client";

import { useState, useMemo, ReactElement } from 'react'; // Importa ReactElement
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { ChevronDown } from 'lucide-react';

// --- DADOS MOCKADOS V2.0 (Mais próximos da realidade) ---
const mockApiData = {
  agfs: [
    { id: 'cl', nome: 'Campo Limpo' },
    { id: 'rp', nome: 'Republica' },
    { id: 'sj', nome: 'São Jorge' },
    { id: 'jm', nome: 'Jd. Marajoara' },
  ],
  categoriasDespesa: ['aluguel', 'comissoes', 'extras', 'folha_pagamento', 'impostos', 'veiculos', 'telefone'],
  dadosMensais: {
    // Dados para cada AGF, para um determinado mês/ano
    'Campo Limpo': {
      receita: 52000,
      objetos: 12300,
      despesas: { aluguel: 4000, comissoes: 2500, extras: 1000, folha_pagamento: 18000, impostos: 5000, veiculos: 6000, telefone: 500 },
    },
    'Republica': {
      receita: 75000,
      objetos: 18500,
      despesas: { aluguel: 8000, comissoes: 4000, extras: 1500, folha_pagamento: 25000, impostos: 7500, veiculos: 8000, telefone: 700 },
    },
    'São Jorge': {
      receita: 48000,
      objetos: 11000,
      despesas: { aluguel: 3500, comissoes: 2200, extras: 800, folha_pagamento: 17000, impostos: 4800, veiculos: 5500, telefone: 450 },
    },
    'Jd. Marajoara': {
      receita: 61000,
      objetos: 15000,
      despesas: { aluguel: 5500, comissoes: 3000, extras: 1200, folha_pagamento: 21000, impostos: 6000, veiculos: 7000, telefone: 600 },
    },
  },
  evolucaoResultadoGeral: [
    { mes: 'Jan', resultado: 28000 }, { mes: 'Fev', resultado: 35000 }, { mes: 'Mar', resultado: 31000 },
    { mes: 'Abr', resultado: 42000 }, { mes: 'Mai', resultado: 38000 }, { mes: 'Jun', resultado: 45000 },
  ],
};
// --- FIM DOS DADOS MOCKADOS ---

// --- COMPONENTES DE UI (para organizar o código) ---

const Card = ({ title, value, subValue, borderColor, valueColor = 'text-white' }: { title: string, value: string, subValue?: string, borderColor: string, valueColor?: string }) => (
  <div className="bg-[#1F1F3C] p-4 rounded-lg backdrop-blur-sm border-l-4" style={{ borderColor }}>
    <div className="flex justify-between items-start">
      <h3 className="text-sm text-text/80 font-semibold">{title}</h3>
      {subValue && <span className="text-xs font-bold text-green-400">{subValue}</span>}
    </div>
    <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
  </div>
);

// AQUI ESTÁ A CORREÇÃO: React.ReactNode foi trocado por React.ReactElement
const ChartContainer = ({ title, children }: { title: string, children: ReactElement }) => (
  <div className="bg-[#1F1F3C] p-4 rounded-lg backdrop-blur-sm h-[350px] flex flex-col">
    <h3 className="font-bold mb-4 text-text">{title}</h3>
    <div className="flex-grow">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    return (
      <div className="bg-[#010440] p-2 border border-[#F2935C]/50 rounded-md text-sm">
        <p className="label font-bold">{`${label}`}</p>
        {payload.map((pld: any, index: number) => (
          <p key={index} style={{ color: pld.color }}>
            {`${pld.name}: ${currencyFormatter.format(pld.value)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};


export default function DashboardPage() {
  // --- ESTADOS E FILTROS ---
  const [agfSelecionada, setAgfSelecionada] = useState('todas');
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [categoriasExcluidas, setCategoriasExcluidas] = useState<string[]>([]);

  // --- LÓGICA DE CÁLCULO (MEMOIZED) ---
  const dadosProcessados = useMemo(() => {
    const totaisPorAgf = mockApiData.agfs.map(agf => {
      const dadosAgf = mockApiData.dadosMensais[agf.nome as keyof typeof mockApiData.dadosMensais];
      const despesaTotal = Object.values(dadosAgf.despesas).reduce((acc, val) => acc + val, 0);
      const resultado = dadosAgf.receita - despesaTotal;
      const margemLucro = dadosAgf.receita > 0 ? (resultado / dadosAgf.receita) * 100 : 0;
      
      // Simulação
      const despesaSimulada = Object.entries(dadosAgf.despesas)
        .filter(([key]) => !categoriasExcluidas.includes(key))
        .reduce((acc, [, val]) => acc + val, 0);
      const resultadoSimulado = dadosAgf.receita - despesaSimulada;
      const margemSimulada = dadosAgf.receita > 0 ? (resultadoSimulado / dadosAgf.receita) * 100 : 0;
      const ganhoMargem = margemSimulada - margemLucro;

      return {
        nome: agf.nome,
        receita: dadosAgf.receita,
        despesaTotal,
        resultado,
        margemLucro,
        objetos: dadosAgf.objetos,
        despesasDetalhadas: dadosAgf.despesas,
        margemLucroReal: margemLucro,
        ganhoMargem: ganhoMargem > 0 ? ganhoMargem : 0,
      };
    });

    const totaisGerais = {
      receita: totaisPorAgf.reduce((acc, agf) => acc + agf.receita, 0),
      despesa: totaisPorAgf.reduce((acc, agf) => acc + agf.despesaTotal, 0),
      resultado: totaisPorAgf.reduce((acc, agf) => acc + agf.resultado, 0),
      objetos: totaisPorAgf.reduce((acc, agf) => acc + agf.objetos, 0),
      margem: 0
    };
    totaisGerais.margem = totaisGerais.receita > 0 ? (totaisGerais.resultado / totaisGerais.receita) * 100 : 0;

    return { totaisPorAgf, totaisGerais };
  }, [categoriasExcluidas]);

  const handleCategoriaToggle = (categoria: string) => {
    setCategoriasExcluidas(prev => 
      prev.includes(categoria) ? prev.filter(c => c !== categoria) : [...prev, categoria]
    );
  };

  const CORES = {
    resultado: '#48DB8A',
    receita: '#4AA8FF',
    despesa: '#E74C3C',
    objetos: '#F2C14E', // Amarelo
    linhaEvolucao: '#F2935C',
    folhaPagamento: '#4472CA',
    pizza: ['#F2935C', '#BF6550', '#4472CA', '#48DB8A'],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#010326] to-[#010440] text-[#E9F2FF] font-poppins p-4 md:p-8">
      <main className="max-w-7xl mx-auto">
        {/* --- CABEÇALHO E FILTROS --- */}
        <header className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <select value={agfSelecionada} onChange={(e) => setAgfSelecionada(e.target.value)} className="bg-[#1F1F3C] border border-[#F2935C]/50 text-white p-2 rounded-md focus:ring-2 focus:ring-[#F2935C] w-full">
            <option value="todas">Todas as AGFs</option>
            {mockApiData.agfs.map(agf => <option key={agf.id} value={agf.nome}>{agf.nome}</option>)}
          </select>
          <select value={mesSelecionado} onChange={(e) => setMesSelecionado(Number(e.target.value))} className="bg-[#1F1F3C] border border-[#F2935C]/50 text-white p-2 rounded-md focus:ring-2 focus:ring-[#F2935C] w-full">
            {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>)}
          </select>
          <select value={anoSelecionado} onChange={(e) => setAnoSelecionado(Number(e.target.value))} className="bg-[#1F1F3C] border border-[#F2935C]/50 text-white p-2 rounded-md focus:ring-2 focus:ring-[#F2935C] w-full">
            {[2023, 2024, 2025].map(ano => <option key={ano} value={ano}>{ano}</option>)}
          </select>
        </header>

        {/* --- CARDS PRINCIPAIS --- */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card title="Resultado" value={dadosProcessados.totaisGerais.resultado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} subValue={`${dadosProcessados.totaisGerais.margem.toFixed(1)}%`} borderColor={CORES.resultado} valueColor="text-green-400" />
          <Card title="Receita Total" value={dadosProcessados.totaisGerais.receita.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} borderColor={CORES.receita} valueColor="text-blue-400" />
          <Card title="Despesa Total" value={dadosProcessados.totaisGerais.despesa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} borderColor={CORES.despesa} valueColor="text-red-500" />
          <Card title="Objetos Tratados" value={dadosProcessados.totaisGerais.objetos.toLocaleString('pt-BR')} borderColor={CORES.objetos} valueColor="text-yellow-400" />
        </section>

        {/* --- GRÁFICO DE EVOLUÇÃO --- */}
        <section className="mb-8">
          <ChartContainer title="Resultado ao Longo do Tempo">
            <LineChart data={mockApiData.evolucaoResultadoGeral}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="mes" stroke="#E9F2FF" />
              <YAxis stroke="#E9F2FF" tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(value)} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="resultado" stroke={CORES.linhaEvolucao} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
            </LineChart>
          </ChartContainer>
        </section>

        {/* --- GRÁFICOS COMPARATIVOS --- */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <ChartContainer title="Comparativo de Receita">
            <BarChart data={dadosProcessados.totaisPorAgf} layout="vertical">
              <XAxis type="number" stroke="#E9F2FF" tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(value)} />
              <YAxis type="category" dataKey="nome" stroke="#E9F2FF" width={80} interval={0} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="receita" fill={CORES.receita} name="Receita" />
            </BarChart>
          </ChartContainer>
          <ChartContainer title="Comparativo de Despesa">
            <BarChart data={dadosProcessados.totaisPorAgf} layout="vertical">
              <XAxis type="number" stroke="#E9F2FF" tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(value)} />
              <YAxis type="category" dataKey="nome" stroke="#E9F2FF" width={80} interval={0} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="despesaTotal" fill={CORES.despesa} name="Despesa" />
            </BarChart>
          </ChartContainer>
          <ChartContainer title="Comparativo de Resultado">
            <BarChart data={dadosProcessados.totaisPorAgf} layout="vertical">
              <XAxis type="number" stroke="#E9F2FF" tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(value)} />
              <YAxis type="category" dataKey="nome" stroke="#E9F2FF" width={80} interval={0} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="resultado" fill={CORES.resultado} name="Resultado" />
            </BarChart>
          </ChartContainer>
          <ChartContainer title="Comparativo de Margem de Lucro (%)">
            <BarChart data={dadosProcessados.totaisPorAgf} layout="vertical">
              <XAxis type="number" stroke="#E9F2FF" tickFormatter={(value) => `${value}%`} />
              <YAxis type="category" dataKey="nome" stroke="#E9F2FF" width={80} interval={0} />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Bar dataKey="margemLucro" fill={CORES.linhaEvolucao} name="Margem" />
            </BarChart>
          </ChartContainer>
        </section>
        
        {/* --- GRÁFICOS DE DESPESA ESPECÍFICA --- */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <ChartContainer title="Folha de Pagamento">
                <BarChart data={dadosProcessados.totaisPorAgf}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
                    <XAxis dataKey="nome" stroke="#E9F2FF" />
                    <YAxis stroke="#E9F2FF" tickFormatter={(value) => new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(value)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="despesasDetalhadas.folha_pagamento" fill={CORES.folhaPagamento} name="Folha de Pagamento" />
                </BarChart>
            </ChartContainer>
            <ChartContainer title="Total Gasto em Veículos por AGF">
                <PieChart>
                    <Pie data={dadosProcessados.totaisPorAgf} dataKey="despesasDetalhadas.veiculos" nameKey="nome" cx="50%" cy="50%" outerRadius={100} label>
                        {dadosProcessados.totaisPorAgf.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CORES.pizza[index % CORES.pizza.length]} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                    <Legend />
                </PieChart>
            </ChartContainer>
        </section>

        {/* --- TABELAS --- */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-1 bg-[#1F1F3C] p-4 rounded-lg">
                <h3 className="font-bold mb-4 text-text">Objetos Tratados por AGF</h3>
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="border-b border-[#F2935C]/20">
                            <th className="p-2">AGF</th>
                            <th className="p-2 text-right">Quantidade</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dadosProcessados.totaisPorAgf.map(agf => (
                            <tr key={agf.nome} className="border-b border-white/10">
                                <td className="p-2 font-semibold">{agf.nome}</td>
                                <td className="p-2 text-right">{agf.objetos.toLocaleString('pt-BR')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="lg:col-span-2 bg-[#1F1F3C] p-4 rounded-lg">
                <h3 className="font-bold mb-4 text-text">Despesas por Categoria</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-[#F2935C]/20">
                                <th className="p-2">AGF</th>
                                {mockApiData.categoriasDespesa.map(cat => <th key={cat} className="p-2 text-right capitalize">{cat.replace('_', ' ')}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {dadosProcessados.totaisPorAgf.map(agf => (
                                <tr key={agf.nome} className="border-b border-white/10">
                                    <td className="p-2 font-semibold">{agf.nome}</td>
                                    {mockApiData.categoriasDespesa.map(cat => (
                                        <td key={cat} className="p-2 text-right text-red-400/90">
                                            {(agf.despesasDetalhadas[cat as keyof typeof agf.despesasDetalhadas] || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>

        {/* --- SIMULAÇÃO DE MARGEM DE LUCRO --- */}
        <section className="bg-[#1F1F3C] p-4 rounded-lg">
            <h3 className="font-bold mb-4 text-text">Simulação de Margem de Lucro</h3>
            <div className="mb-4">
                <p className="text-sm text-text/80 mb-2">Selecione as despesas para remover do cálculo:</p>
                <div className="flex flex-wrap gap-2">
                    {mockApiData.categoriasDespesa.map(cat => (
                        <button key={cat} onClick={() => handleCategoriaToggle(cat)} className={`px-3 py-1 text-xs rounded-full transition-colors capitalize ${categoriasExcluidas.includes(cat) ? 'bg-[#F2935C] text-white' : 'bg-gray-600/50 text-text/80'}`}>
                            {cat.replace('_', ' ')}
                        </button>
                    ))}
                </div>
            </div>
            <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosProcessados.totaisPorAgf} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
                        <XAxis type="category" dataKey="nome" stroke="#E9F2FF" />
                        <YAxis type="number" stroke="#E9F2FF" tickFormatter={(value) => `${value.toFixed(0)}%`} />
                        <Tooltip formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name === 'margemLucroReal' ? 'Margem Real' : 'Ganho de Margem']} />
                        <Legend />
                        <Bar dataKey="margemLucroReal" stackId="a" fill={CORES.receita} name="Margem Real" />
                        <Bar dataKey="ganhoMargem" stackId="a" fill={CORES.resultado} name="Ganho de Margem" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </section>
      </main>
    </div>
  );
}
