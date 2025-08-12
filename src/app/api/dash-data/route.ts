import { NextResponse } from 'next/server';

const BASE = process.env.BUBBLE_BASE_URL!;
const KEY = process.env.BUBBLE_API_KEY!;

function enc(s: string) { return encodeURIComponent(s); }
function constraints(obj: any) { return encodeURIComponent(JSON.stringify(obj)); }

// mapeia "jan", "janeiro" → 1, etc.
const MESES: Record<string, number> = {
  '1':1,'01':1,'jan':1,'janeiro':1,
  '2':2,'02':2,'fev':2,'fevereiro':2,
  '3':3,'03':3,'mar':3,'março':3,'marco':3,
  '4':4,'04':4,'abr':4,'abril':4,
  '5':5,'05':5,'mai':5,'maio':5,
  '6':6,'06':6,'jun':6,'junho':6,
  '7':7,'07':7,'jul':7,'julho':7,
  '8':8,'08':8,'ago':8,'agosto':8,
  '9':9,'09':9,'set':9,'setembro':9,
  '10':10,'out':10,'outubro':10,
  '11':11,'nov':11,'novembro':11,
  '12':12,'dez':12,'dezembro':12,
};

function parseAno(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  // Option set como objeto? tenta name/display
  const s = (v?.display || v?.name || '').toString();
  const n = Number(s.replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseMes(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const key = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); // tira acentos
    return MESES[key] ?? Number(v);
  }
  const s = (v?.display || v?.name || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return MESES[s] ?? 0;
}

async function bubbleGet<T>(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bubble GET ${path} -> ${res.status} ${body}`);
  }
  return (await res.json()) as { response: { results: T[]; count?: number } };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const empresaId = searchParams.get('empresa_id');
    if (!empresaId) return NextResponse.json({ error: 'empresa_id ausente' }, { status: 400 });

    // 1) AGFs da Empresa Mãe (usa campo "Nome da AGF" para exibir)
    const agfCons = constraints([{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }]);
    const agfsRes = await bubbleGet<{ _id: string; 'Nome da AGF'?: string; nome?: string; name?: string }>(
      `/api/1.1/obj/${enc('AGF')}?limit=200&constraints=${agfCons}`
    );
    const agfs = agfsRes.response.results.map(a => ({
      id: a._id,
      nome: (a as any)['Nome da AGF'] || (a as any).nome || (a as any).name || a._id,
    }));
    const agfIdToNome = new Map<string, string>(agfs.map(a => [a.id, a.nome]));
    const agfIds = agfs.map(a => a.id);

    // 2) LançamentoMensal (filtra por Empresa Mãe)
    const lmCons = constraints([{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }]);
    const lmRes = await bubbleGet<{
      _id: string;
      Ano: any;
      Mês: any;
      AGF: string | { _id: string; 'Nome da AGF'?: string; nome?: string; name?: string };
      total_receita?: number;
      total_despesa?: number;
      resultado_final?: number;
      resultado_extra?: number;
    }>(`/api/1.1/obj/${enc('LançamentoMensal')}?limit=1000&constraints=${lmCons}`);
    const lmIds = lmRes.response.results.map(r => r._id);

    // 3) SubConta (filtra por AGF IN [ids])
    const scCons = constraints([{ key: 'AGF', constraint_type: 'in', value: agfIds }]);
    const scRes = await bubbleGet<{
      _id: string;
      Ano?: any; Mês?: any;
      AGF?: string | { _id: string; 'Nome da AGF'?: string; nome?: string; name?: string };
      LançamentoMensal?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      Categoria?: string | { _id: string; Nome?: string; name?: string };
      Valor: number;
    }>(`/api/1.1/obj/${enc('Despesa (SubConta)')}?limit=2000&constraints=${scCons}`);

    // 4) Balancete (filtra por Lançamento Mensal IN [ids])
    const balCons = constraints([{ key: 'Lançamento Mensal', constraint_type: 'in', value: lmIds }]);
    const balRes = await bubbleGet<{
      _id: string;
      'Lançamento Mensal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      Quantidade?: number;
      Remuneração?: number;
      'Tipo de objeto'?: string;
    }>(`/api/1.1/obj/${enc('Balancete')}?limit=2000&constraints=${balCons}`);

    // --------- AGREGAÇÃO PARA O FRONT ----------
    const dados: Record<number, Record<number, Record<string, {
      receita: number;
      objetos: number;
      despesas: Record<string, number>;
    }>>> = {};

    // 4.1) Receita (LançamentoMensal)
    for (const lm of lmRes.response.results) {
      const ano = parseAno((lm as any).Ano);
      const mes = parseMes((lm as any).Mês);
      if (!ano || !mes) continue;

      const agfId = typeof lm.AGF === 'string' ? lm.AGF : (lm.AGF as any)?._id;
      const agfNome =
        agfIdToNome.get(agfId || '') ||
        (typeof lm.AGF === 'object' ? ((lm.AGF as any)['Nome da AGF'] || (lm.AGF as any).nome || (lm.AGF as any).name) : '') ||
        agfId || 'AGF';

      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) dados[ano][mes][agfNome] = { receita: 0, objetos: 0, despesas: {} };

      dados[ano][mes][agfNome].receita += Number((lm as any).total_receita || 0);
    }

    // 4.2) Objetos (Balancete)
    for (const b of balRes.response.results) {
      const lm = (b as any)['Lançamento Mensal'];
      const ano = parseAno(typeof lm === 'object' ? lm?.Ano : undefined);
      const mes = parseMes(typeof lm === 'object' ? lm?.Mês : undefined);
      if (!ano || !mes) continue;

      let agfNome = 'AGF';
      if (typeof lm === 'object' && lm?.AGF) {
        const agfId = typeof lm.AGF === 'string' ? lm.AGF : lm.AGF?._id;
        agfNome = agfIdToNome.get(agfId || '') ||
                  (typeof lm.AGF === 'object' ? (lm.AGF['Nome da AGF'] || lm.AGF.nome || lm.AGF.name) : '') ||
                  agfNome;
      }

      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) dados[ano][mes][agfNome] = { receita: 0, objetos: 0, despesas: {} };

      dados[ano][mes][agfNome].objetos += Number((b as any).Quantidade || 0);
    }

    // 4.3) Despesas por categoria (SubConta)
    const categoriasSet = new Set<string>();
    for (const sc of scRes.response.results) {
      let ano = parseAno((sc as any).Ano);
      let mes = parseMes((sc as any).Mês);

      const lm = (sc as any)['LançamentoMensal'];
      if ((!ano || !mes) && typeof lm === 'object') {
        ano = parseAno(lm?.Ano);
        mes = parseMes(lm?.Mês);
      }
      if (!ano || !mes) continue;

      let agfNome = 'AGF';
      if ((sc as any).AGF) {
        const agfField = (sc as any).AGF;
        const agfId = typeof agfField === 'string' ? agfField : agfField?._id;
        agfNome = agfIdToNome.get(agfId || '') ||
                  (typeof agfField === 'object' ? (agfField['Nome da AGF'] || agfField.nome || agfField.name) : '') ||
                  agfNome;
      } else if (typeof lm === 'object' && lm?.AGF) {
        const agfId = typeof lm.AGF === 'string' ? lm.AGF : lm.AGF?._id;
        agfNome = agfIdToNome.get(agfId || '') ||
                  (typeof lm.AGF === 'object' ? (lm.AGF['Nome da AGF'] || lm.AGF.nome || lm.AGF.name) : '') ||
                  agfNome;
      }

      let categoria = 'sem_categoria';
      const catField = (sc as any).Categoria;
      if (catField) {
        if (typeof catField === 'string') categoria = catField.toLowerCase();
        else categoria = (catField.Nome || catField.name || 'sem_categoria').toLowerCase();
      }
      categoriasSet.add(categoria);

      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) dados[ano][mes][agfNome] = { receita: 0, objetos: 0, despesas: {} };

      dados[ano][mes][agfNome].despesas[categoria] =
        (dados[ano][mes][agfNome].despesas[categoria] || 0) + Number((sc as any).Valor || 0);
    }

    if (categoriasSet.size === 0) {
      ['aluguel','comissoes','extras','folha_pagamento','impostos','veiculos','telefone'].forEach(c => categoriasSet.add(c));
    }

    return NextResponse.json({
      agfs,
      categoriasDespesa: Array.from(categoriasSet),
      dados,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 });
  }
}
