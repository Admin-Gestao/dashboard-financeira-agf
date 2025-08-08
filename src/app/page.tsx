"use client"; // Necessário para usar hooks como useState e useEffect

import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

// --- DADOS MOCKADOS (SUBSTITUIR PELA API DO BUBBLE) ---
// Simula os dados que viriam da sua API do Bubble
const mockApiData = {
  cards: {
    receitaTotal: 125000,
    resultadoTotal: 35000,
    despesaTotal: 90000,
    objetosTratados: 15200,
    margemLucroMedia: 28, // em porcentagem
  },
  resultadoEvolucao: [
    { mes: 'Jan', resultado: 2800 },
    { mes: 'Fev', resultado: 3500 },
    { mes: 'Mar', resultado: 3100 },
    { mes: 'Abr', resultado: 4200 },
    { mes: 'Mai', resultado: 3800 },
    { mes: 'Jun', resultado: 4500 },
  ],
  comparativoAgfs: [
    { nome: 'AGF Campo Limpo', receita: 45000, despesa: 32000, resultado: 13000, margemLucro: 28.8 },
    { nome: 'AGF Santo Amaro', receita: 55000, despesa: 41000, resultado: 14000, margemLucro: 25.4 },
    { nome: 'AGF Pinheiros', receita: 25000, despesa: 17000, resultado: 8000, margemLucro: 32.0 },
  ],
  despesasPorCategoria: [
      { nome: 'AGF Campo Limpo', 'Folha de Pagamento': 15000, 'Veículos': 5000, 'Aluguel': 4000, 'Outros': 8000 },
      { nome: 'AGF Santo Amaro', 'Folha de Pagamento': 18000, 'Veículos': 7000, 'Aluguel': 5000, 'Outros': 11000 },
      { nome: 'AGF Pinheiros', 'Folha de Pagamento': 8000, 'Veículos': 3000, 'Aluguel': 2500, 'Outros': 3500 },
  ],
  objetosPorAgf: [
      { nome: 'AGF Campo Limpo', quantidade: 5800 },
      { nome: 'AGF Santo Amaro', quantidade: 6400 },
      { nome: 'AGF Pinheiros', quantidade: 3000 },
  ]
};
// --- FIM DOS DADOS MOCKADOS ---


export default function DashboardPage() {
  // Estado para os filtros
  const [agfSelecionada, setAgfSelecionada] = useState('todas');
  const [mesSelecionado, setMesSelecionado] = useState(new Date().getMonth() + 1);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  
  // Estado para armazenar os dados da API
  const [dados, setDados] = useState(mockApiData);

  // TODO: Implementar a chamada à API do Bubble
  useEffect(() => {
    // Exemplo de como você chamaria a API
    const fetchDados = async () => {
      // O ID da empresa mãe viria como parâmetro na URL quando você embutir no Bubble
      // Ex: https://sua-url.vercel.app?empresaMaeId=1751489874623x656617143249867800
      const urlParams = new URLSearchParams(window.location.search );
      const empresaMaeId = urlParams.get('empresaMaeId');

      if (!empresaMaeId) {
        console.error("ID da Empresa Mãe não encontrado!");
        // Você pode mostrar uma mensagem de erro na tela aqui
        return;
      }

      try {
        // Você precisará criar um endpoint no Bubble que retorne os dados neste formato
        // const response = await fetch(`https://sistema-de-gesto---agf.bubbleapps.io/version-test/api/1.1/wf/dashboard-data?empresaMaeId=${empresaMaeId}&mes=${mesSelecionado}&ano=${anoSelecionado}` );
        // const dataFromApi = await response.json();
        // setDados(dataFromApi.response); // A estrutura da resposta do Bubble pode variar
        
        // Por enquanto, usamos os dados mockados
        console.log(`Buscando dados para Empresa: ${empresaMaeId}, Mês: ${mesSelecionado}, Ano: ${anoSelecionado}`);
        setDados(mockApiData);

      } catch (error) {
        console.error("Erro ao buscar dados da API:", error);
      }
    };

    fetchDados();
  }, [agfSelecionada, mesSelecionado, anoSelecionado]);

  // Memoize os dados filtrados para evitar recálculos desnecessários
  const dadosFiltrados = useMemo(() => {
    if (agfSelecionada === 'todas') {
      return dados;
    }
    const agfData = dados.comparativoAgfs.find(agf => agf.nome === agfSelecionada);
    if (!agfData) return dados; // Retorna todos se não encontrar

    return {
      ...dados,
      cards: {
        receitaTotal: agfData.receita,
        resultadoTotal: agfData.resultado,
        despesaTotal: agfData.despesa,
        objetosTratados: dados.objetosPorAgf.find(a => a.nome === agfSelecionada)?.quantidade || 0,
        margemLucroMedia: agfData.margemLucro,
      }
    }
  }, [dados, agfSelecionada]);
  
  const CORES_GRAFICOS = {
    receita: '#3b82f6', // Azul
    despesa: '#ef4444', // Vermelho
    resultado: '#22c55e', // Verde
    margem: '#f97316', // Laranja
    veiculos: ['#BF6550', '#A65A46', '#8C4F3D']
  };

  return (
    <main className="p-4 md:p-8 font-poppins">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">Dashboard de Gestão</h1>
        <p className="text-text/80">Análise comparativa de franquias AGF.</p>
      </header>

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Filtro AGF */}
        <select value={agfSelecionada} onChange={(e) => setAgfSelecionada(e.target.value)} className="bg-background-start border border-primary/50 text-white p-2 rounded-md focus:ring-2 focus:ring-primary">
          <option value="todas">Todas as AGFs</option>
          {dados.comparativoAgfs.map(agf => <option key={agf.nome} value={agf.nome}>{agf.nome}</option>)}
        </select>
        {/* Filtro Mês */}
        <select value={mesSelecionado} onChange={(e) => setMesSelecionado(Number(e.target.value))} className="bg-background-start border border-primary/50 text-white p-2 rounded-md focus:ring-2 focus:ring-primary">
          {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</option>)}
        </select>
        {/* Filtro Ano */}
        <select value={anoSelecionado} onChange={(e) => setAnoSelecionado(Number(e.target.value))} className="bg-background-start border border-primary/50 text-white p-2 rounded-md focus:ring-2 focus:ring-primary">
          {[2023, 2024, 2025].map(ano => <option key={ano} value={ano}>{ano}</option>)}
        </select>
      </div>

      {/* Cards Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"><h3 className="text-sm text-text/80">Receita Total</h3><p className="text-2xl font-bold text-info">{dadosFiltrados.cards.receitaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
        <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"><h3 className="text-sm text-text/80">Despesa Total</h3><p className="text-2xl font-bold text-destructive">{dadosFiltrados.cards.despesaTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
        <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"><h3 className="text-sm text-text/80">Resultado Total</h3><p className="text-2xl font-bold text-success">{dadosFiltrados.cards.resultadoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
        <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"><h3 className="text-sm text-text/80">Objetos Tratados</h3><p className="text-2xl font-bold text-primary">{dadosFiltrados.cards.objetosTratados.toLocaleString('pt-BR')}</p></div>
        <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm"><h3 className="text-sm text-text/80">Margem de Lucro</h3><p className="text-2xl font-bold text-secondary">{dadosFiltrados.cards.margemLucroMedia.toFixed(1)}%</p></div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Gráfico de Evolução do Resultado */}
        <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
          <h3 className="font-bold mb-4">Evolução do Resultado ({agfSelecionada === 'todas' ? 'Geral' : agfSelecionada})</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dados.resultadoEvolucao}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="mes" stroke="#E9F2FF" />
              <YAxis stroke="#E9F2FF" />
              <Tooltip contentStyle={{ backgroundColor: '#010440', border: '1px solid #F2935C' }} />
              <Legend />
              <Line type="monotone" dataKey="resultado" stroke={CORES_GRAFICOS.resultado} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico Comparativo de Receita */}
        <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
          <h3 className="font-bold mb-4">Comparativo de Receita por AGF (Mês/Ano)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dados.comparativoAgfs}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(233, 242, 255, 0.1)" />
              <XAxis dataKey="nome" stroke="#E9F2FF" />
              <YAxis stroke="#E9F2FF" />
              <Tooltip contentStyle={{ backgroundColor: '#010440', border: '1px solid #F2935C' }} />
              <Bar dataKey="receita" fill={CORES_GRAFICOS.receita} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Gráfico de Pizza - Despesas com Veículos */}
        <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm">
          <h3 className="font-bold mb-4">Total Gasto em Veículos por AGF</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={dados.despesasPorCategoria} dataKey="Veículos" nameKey="nome" cx="50%" cy="50%" outerRadius={100} label>
                {dados.despesasPorCategoria.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CORES_GRAFICOS.veiculos[index % CORES_GRAFICOS.veiculos.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#010440', border: '1px solid #F2935C' }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela de Despesas por Categoria */}
        <div className="bg-white/10 p-4 rounded-lg backdrop-blur-sm lg:col-span-2">
            <h3 className="font-bold mb-4">Despesas por Categoria e AGF</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-primary/50">
                            <th className="p-2">AGF</th>
                            <th className="p-2 text-right">Folha de Pagamento</th>
                            <th className="p-2 text-right">Veículos</th>
                            <th className="p-2 text-right">Aluguel</th>
                            <th className="p-2 text-right">Outros</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dados.despesasPorCategoria.map((item) => (
                            <tr key={item.nome} className="border-b border-white/10">
                                <td className="p-2 font-semibold">{item.nome}</td>
                                <td className="p-2 text-right text-destructive/90">{item['Folha de Pagamento'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="p-2 text-right text-destructive/90">{item['Veículos'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="p-2 text-right text-destructive/90">{item['Aluguel'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                <td className="p-2 text-right text-destructive/90">{item['Outros'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </main>
  );
}
