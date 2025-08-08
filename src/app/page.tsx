"use client";

import { useState, useMemo, ReactElement } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LabelList } from 'recharts';

// --- DADOS MOCKADOS ---
// Em um cenário real, a API do Bubble retornaria dados baseados nos filtros de mês/ano.
// Para simular, vamos manter os dados estáticos, mas a lógica de filtro funcionará.
const mockApiData = {
  agfs: [ { id: 'cl', nome: 'Campo Limpo' }, { id: 'rp', nome: 'Republica' }, { id: 'sj', nome: 'São Jorge' }, { id: 'jm', nome: 'Jd. Marajoara' } ],
  categoriasDespesa: ['aluguel', 'comissoes', 'extras', 'folha_pagamento', 'impostos', 'veiculos', 'telefone'],
  dadosMensais: {
    'Campo Limpo': { receita: 52000, objetos: 12300, despesas: { aluguel: 4000, comissoes: 2500, extras: 1000, folha_pagamento: 18000, impostos: 5000, veiculos: 6000, telefone: 500 }},
    'Republica': { receita: 75000, objetos: 18500, despesas: { aluguel: 8000, comissoes: 4000, extras: 1500, folha_pagamento: 25000, impostos: 7500, veiculos: 8000, telefone: 700 }},
    'São Jorge': { receita: 48000, objetos: 11000, despesas: { aluguel: 3500, comissoes: 2200, extras: 800, folha_pagamento: 17000, impostos: 4800, veiculos: 5500, telefone: 450 }},
    'Jd. Marajoara': { receita: 61000, objetos: 15000, despesas: { aluguel: 5500, comissoes: 3000, extras: 1200, folha_pagamento: 21000, impostos: 6000, veiculos: 7000, telefone: 600 }},
  },
  evolucaoResultadoGeral: [ { mes: 'Jan', resultado: 280000 }, { mes: 'Fev', resultado: 350000 }, { mes: 'Mar', resultado: 410000 }, { mes: 'Abr', resultado: 420000 }, { mes: 'Mai', resultado: 580000 }, { mes: 'Jun', resultado: 450000 } ],
};

// --- COMPONENTES DE UI ---
const Card = ({ title, value, borderColor }: { title: string, value: string, borderColor: string }) => (
  <div className="bg-card p-4 rounded-lg border-l-4" style={{ borderImage: borderColor, borderImageSlice: 1 }}>
    <h3 className="text-sm text-text/80 font-semibold">{title}</h3>
    <p className="text-2xl font-bold text-text">{value}</p>
  </div>
);

const ChartContainer = ({ title, children, className = "" }: { title: string, children: ReactElement, className?: string }) => (
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
        {payload.map((pld: any, index: number) => ( <p key={index} style={{ color: pld.fill }}> {`${pld.name}: ${formatter(pld.value)}`} </p> ))}
      </div>
    );
  }
  return null;
};

// --- PÁGINA PRINCIPAL ---
export default function DashboardPage() {
  const [agfSelecionada, setAgfSelecionada] = useState('todas');
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [categoriasExcluidas, setCategoriasExcluidas] = useState<string[]>([]);

  const dadosProcessados = useMemo(() => {
    // LÓGICA DE FILTRO PRINCIPAL
    const agfsParaProcessar = agfSelecionada === 'todas' 
      ? mockApiData.agfs 
      : mockApiData.agfs.filter(agf => agf.nome === agfSelecionada);

    const totaisPorAgf = agfsParaProcessar.map(agf => {
      const dadosAgf = mockApiData.dadosMensais[agf.nome as keyof typeof mockApiData.dadosMensais];
      const despesaTotal = Object.values(dadosAgf.despesas).reduce((acc, val) => acc + val, 0);
      const resultado = dadosAgf.receita - despesaTotal;
      const margemLucro = dadosAgf.receita > 0 ? (resultado / dadosAgf.receita) * 100 : 0;
      const despesaSimulada = Object.entries(dadosAgf.despesas).filter(([key]) => !categoriasExcluidas.includes(key)).reduce((acc, [, val]) => acc + val, 0);
      const resultadoSimulado = dadosAgf.receita - despesaSimulada;
      const margemSimulada = dadosAgf.receita > 0 ? (resultadoSimulado / dadosAgf.receita) * 100 : 0;
      const ganhoMargem = margemSimulada - margemLucro;
      return { nome: agf.nome, receita: dadosAgf.receita, despesaTotal, resultado, margemLucro, objetos: dadosAgf.objetos, despesasDetalhadas: dadosAgf.despesas, margemLucroReal: margemLucro, ganhoMargem: ganhoMargem > 0 ? ganhoMargem : 0 };
    });

    const totaisGerais = { receita: totaisPorAgf.reduce((acc, agf) => acc + agf.receita, 0), despesa: totaisPorAgf.reduce((acc, agf) => acc + agf.despesaTotal, 0), resultado: totaisPorAgf.reduce((acc, agf) => acc + agf.resultado, 0), objetos: totaisPorAgf.reduce((acc, agf) => acc + agf.objetos, 0) };
    
    // TODO: A lógica do filtro de Mês/Ano deve ser aplicada na chamada da API do Bubble.
    // Por enquanto, ela re-renderiza o componente, mas os dados mockados não mudam.
    console.log(`Filtros aplicados: AGF=${agfSelecionada}, Mês=${mesSelecionado}, Ano=${anoSelecionado}`);

    return { totaisPorAgf, totaisGerais };
  }, [agfSelecionada, mesSelecionado, anoSelecionado, categoriasExcluidas]);

  const handleCategoriaToggle = (categoria: string) => { setCategoriasExcluidas(prev => prev.includes(categoria) ? prev.filter(c => c !== categoria) : [...prev, categoria]); };
  const currencyFormatter = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const percentFormatter = (value: number) => `${value.toFixed(1)}%`;
  const numberFormatter = (value: number) => value.toLocaleString('pt-BR');

  const CORES = { receita: '#4AA8FF', despesa: '#E74C3C', resultado: '#48DB8A', margem: '#A974F8', simulacaoReal: '#A974F8', simulacaoGanho: '#F4D35E' };

  return (
    <div className="p-4 md:p-8">
      <main className="max-w-7xl mx-auto flex flex-col gap-8">
        <header className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select className="bg-card border border-primary/50 text-white p-2 rounded-md focus:ring-2 focus:ring-primary w-full" onChange={(e) => setAgfSelecionada(e.target.value)}>
            <option value="todas">Todas as AGFs</option>
            {mockApiData.agfs.map(agf => <option key={agf.id} value={agf.nome}>{agf.nome}</option>)}
          </select>
          <select className="bg-card border border-primary/50 text-white p-2 rounded-md focus:ring-2 focus:ring-primary w-full" onChange={(e) => setMesSelecionado(Number(e.target.value))}>
            {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>)}
          </select>
          <select className="bg-card border border-primary/50 text-white p-2 rounded-md focus:ring-2 focus:ring-primary w-full" onChange={(e) => setAnoSelecionado(Number(e.target.value))}>
            {[2023, 2024, 2025].map(ano => <option key={ano} value={ano}>{ano}</option>)}
          </select>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card title="Resultado" value={currencyFormatter(dadosProcessados.totaisGerais.resultado)} borderColor="linear-gradient(to bottom, #48DB8A, #1a5935)" />
          <Card title="Receita Total" value={currencyFormatter(dadosProcessados.totaisGerais.receita)} borderColor={CORES.receita} />
          <Card title="Despesa Total" value={currencyFormatter(dadosProcessados.totaisGerais.despesa)} borderColor={CORES.despesa} />
          <Card title="Objetos Tratados" value={numberFormatter(dadosProcessados.totaisGerais.objetos)} borderColor="var(--tw-color-warning)" />
        </section>

        <section><ChartContainer title="Resultado ao longo do tempo" className="h-[300px]">
            <AreaChart data={mockApiData.evolucaoResultadoGeral} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id="colorResultado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F2935C" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#1F1F3C" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="mes" stroke="#E9F2FF" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} />
              <YAxis stroke="#E9F2FF" tickFormatter={(value) => value.toLocaleString('pt-BR', {notation: 'compact', compactDisplay: 'short'})} tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} />
              <Tooltip content={<CustomTooltip formatter={currencyFormatter} />} />
              <Area type="monotone" dataKey="resultado" name="Resultado" stroke="#F2935C" strokeWidth={2} fill="url(#colorResultado)" />
            </AreaChart>
        </ChartContainer></section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ChartContainer title="Comparativo de Receita" className="h-[280px]"><BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" /><XAxis dataKey="nome" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} /><YAxis hide={true} /><Tooltip content={<CustomTooltip formatter={currencyFormatter} />} /><Bar dataKey="receita" fill={CORES.receita} name="Receita"><LabelList dataKey="receita" position="top" formatter={(value: number) => value.toLocaleString('pt-BR', {notation: 'compact'})} style={{ fill: '#E9F2FF', fontSize: 12 }} /></Bar></BarChart></ChartContainer>
          <ChartContainer title="Comparativo de Despesa" className="h-[280px]"><BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" /><XAxis dataKey="nome" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} /><YAxis hide={true} /><Tooltip content={<CustomTooltip formatter={currencyFormatter} />} /><Bar dataKey="despesaTotal" fill={CORES.despesa} name="Despesa"><LabelList dataKey="despesaTotal" position="top" formatter={(value: number) => value.toLocaleString('pt-BR', {notation: 'compact'})} style={{ fill: '#E9F2FF', fontSize: 12 }} /></Bar></BarChart></ChartContainer>
          <ChartContainer title="Comparativo de Resultado" className="h-[280px]"><BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" /><XAxis dataKey="nome" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} /><YAxis hide={true} /><Tooltip content={<CustomTooltip formatter={currencyFormatter} />} /><Bar dataKey="resultado" fill={CORES.resultado} name="Resultado"><LabelList dataKey="resultado" position="top" formatter={(value: number) => value.toLocaleString('pt-BR', {notation: 'compact'})} style={{ fill: '#E9F2FF', fontSize: 12 }} /></Bar></BarChart></ChartContainer>
          <ChartContainer title="Comparativo de Margem de Lucro (%)" className="h-[280px]"><BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" /><XAxis dataKey="nome" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} /><YAxis hide={true} /><Tooltip content={<CustomTooltip formatter={percentFormatter} />} /><Bar dataKey="margemLucro" fill={CORES.margem} name="Margem"><LabelList dataKey="margemLucro" position="top" formatter={(value: number) => `${value.toFixed(1)}%`} style={{ fill: '#E9F2FF', fontSize: 12 }} /></Bar></BarChart></ChartContainer>
        </section>
        
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <ChartContainer title="Folha de Pagamento" className="h-[350px]"><BarChart data={dadosProcessados.totaisPorAgf} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" /><XAxis dataKey="nome" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} /><YAxis tickFormatter={(value) => value.toLocaleString('pt-BR', {notation: 'compact'})} tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} /><Tooltip content={<CustomTooltip formatter={currencyFormatter} />} /><Bar dataKey="despesasDetalhadas.folha_pagamento" fill="#4472CA" name="Folha de Pagamento" /></BarChart></ChartContainer>
            <ChartContainer title="Total Gasto em Veículos por AGF" className="h-[350px]"><PieChart><Tooltip formatter={currencyFormatter} /><Legend wrapperStyle={{fontSize: "12px", opacity: 0.8}} /><Pie data={dadosProcessados.totaisPorAgf} dataKey="despesasDetalhadas.veiculos" nameKey="nome" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => { const radius = innerRadius + (outerRadius - innerRadius) * 0.5; const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180)); const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180)); return (<text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12}>{`${(percent * 100).toFixed(0)}%`}</text>);}}>{dadosProcessados.totaisPorAgf.map((_, index) => (<Cell key={`cell-${index}`} fill={['#F2935C', '#BF6550', '#4472CA', '#48DB8A'][index % 4]} />))}</Pie></PieChart></ChartContainer>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-card p-4 rounded-lg"><h3 className="font-bold mb-4 text-text">Objetos Tratados</h3><table className="w-full text-left text-sm"><thead><tr className="border-b border-primary/20"><th className="p-2">AGF</th><th className="p-2 text-right">Quantidade</th></tr></thead><tbody>{dadosProcessados.totaisPorAgf.map(agf => (<tr key={agf.nome} className="border-b border-white/10"><td className="p-2 font-semibold">{agf.nome}</td><td className="p-2 text-right">{agf.objetos.toLocaleString('pt-BR')}</td></tr>))}</tbody></table></div>
            <div className="lg:col-span-2 bg-card p-4 rounded-lg"><h3 className="font-bold mb-4 text-text">Despesas por Categoria</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-primary/20"><th className="p-2">AGF</th>{mockApiData.categoriasDespesa.map(cat => <th key={cat} className="p-2 text-right capitalize">{cat.replace('_', ' ')}</th>)}</tr></thead><tbody>{dadosProcessados.totaisPorAgf.map(agf => (<tr key={agf.nome} className="border-b border-white/10"><td className="p-2 font-semibold">{agf.nome}</td>{mockApiData.categoriasDespesa.map(cat => (<td key={cat} className="p-2 text-right text-destructive/90">{(agf.despesasDetalhadas[cat as keyof typeof agf.despesasDetalhadas] || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })}</td>))}</tr>))}</tbody></table></div></div>
        </section>

        <section className="bg-card p-4 rounded-lg">
            <h3 className="font-bold mb-4 text-text">Simulação de Margem de Lucro</h3>
            <div className="mb-4"><p className="text-sm text-text/80 mb-2">Selecione despesas para excluir do cálculo:</p><div className="flex flex-wrap gap-2">{mockApiData.categoriasDespesa.map(cat => (<button key={cat} onClick={() => handleCategoriaToggle(cat)} className={`px-3 py-1 text-xs rounded-full transition-colors capitalize ${categoriasExcluidas.includes(cat) ? 'bg-primary text-white' : 'bg-gray-600/50 text-text/80'}`}>{cat.replace('_', ' ')}</button>))}</div></div>
            <ChartContainer title="" className="h-[300px]"><BarChart data={dadosProcessados.totaisPorAgf} layout="vertical" stackOffset="expand" margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" /><XAxis type="number" hide={true} /><YAxis type="category" dataKey="nome" stroke="#E9F2FF" tick={{ fill: '#E9F2FF', opacity: 0.7, fontSize: 12 }} width={80} /><Tooltip content={<CustomTooltip formatter={percentFormatter} />} /><Legend wrapperStyle={{fontSize: "12px", opacity: 0.8}} /><Bar dataKey="margemLucroReal" stackId="a" fill={CORES.simulacaoReal} name="Margem Real" /><Bar dataKey="ganhoMargem" stackId="a" fill={CORES.simulacaoGanho} name="Ganho de Margem" /></BarChart></ChartContainer>
        </section>
      </main>
    </div>
  );
}
