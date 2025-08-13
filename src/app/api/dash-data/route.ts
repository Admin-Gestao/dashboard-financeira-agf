import { NextResponse } from 'next/server';

const BASE = process.env.BUBBLE_BASE_URL!;
const KEY  = process.env.BUBBLE_API_KEY!;

function enc(s: string) { return encodeURIComponent(s); }
function constraints(obj: any) { return encodeURIComponent(JSON.stringify(obj)); }

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
  const s = (v?.display || v?.name || '').toString();
  const n = Number(s.replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function parseMes(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const key = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    return MESES[key] ?? Number(v);
  }
  const s = (v?.display || v?.name || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return MESES[s] ?? 0;
}

function parseValorBR(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return 0;
  const s = v.toString()
    .replace(/\s+/g,'')
    .replace(/[R$\u00A0]/g,'')
    .replace(/\./g,'')
    .replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseMesAnoStr(s: any): { mes: number; ano: number } | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/^\s*([01]?\d)\s*\/\s*(\d{4})\s*$/);
  if (!m) return null;
  const mes = Number(m[1]);
  const ano = Number(m[2]);
  if (mes>=1 && mes<=12 && ano>1900) return { mes, ano };
  return null;
}

function pick<T=any>(obj: any, keys: string[]): T | undefined {
  if (!obj) return undefined as any;
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
  }
  return undefined as any;
}

function normalizeCategoria(input: any): string {
  const raw = String(input || '').trim();
  const s = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  const direct: Record<string,string> = {
    'aluguel':'aluguel', 'comissoes':'comissoes', 'comissão':'comissoes', 'comissao':'comissoes',
    'extras':'extras', 'honorarios':'honorarios', 'honorário':'honorarios', 'honorario':'honorarios',
    'imposto':'impostos', 'impostos':'impostos', 'pitney':'pitney', 'telefone':'telefone',
    'veiculos':'veiculos', 'veículo':'veiculos', 'veiculo':'veiculos',
    'folha pgto':'folha_pagamento', 'folha pgto.':'folha_pagamento', 'folha pagamento':'folha_pagamento',
  };
  if (direct[s]) return direct[s];

  if (s.includes('alug')) return 'aluguel';
  if (s.includes('comis')) return 'comissoes';
  if (s.includes('honor')) return 'honorarios';
  if (s.includes('pitney')) return 'pitney';
  if (s.includes('telef')) return 'telefone';
  if (s.includes('veic')) return 'veiculos';
  if (s.includes('impost')) return 'impostos';
  if (s.includes('folha') || s.includes('pgto') || s.includes('pagament')) return 'folha_pagamento';
  if (s.includes('extra')) return 'extras';

  return 'extras';
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

    // 1) AGFs da empresa
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

    // 2) Lançamentos Mensais
    const lmCons = constraints([{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }]);
    const lmRes = await bubbleGet<{
      _id: string; Ano: any; Mês: any; AGF: any;
      total_receita?: number; total_despesa?: number;
    }>(`/api/1.1/obj/${enc('LançamentoMensal')}?limit=1000&constraints=${lmCons}`);

    const lmIndex = new Map<string, { ano: number; mes: number; agfNome: string }>();
    for (const lm of lmRes.response.results) {
      const ano = parseAno(lm.Ano);
      const mes = parseMes(lm.Mês);
      const agfId = typeof lm.AGF === 'string' ? lm.AGF : lm.AGF?._id;
      const agfNome = agfIdToNome.get(agfId || '') || 'AGF';
      if (lm._id && ano && mes) {
        lmIndex.set(lm._id, { ano, mes, agfNome });
      }
    }
    const lmIds = Array.from(lmIndex.keys());

    // 3) CATEGORIAS (mapa id -> nome)
    const catRes = await bubbleGet<{ _id: string; Categoria?: string; Nome?: string; name?: string }>(
      `/api/1.1/obj/${enc('Categoria Despesa')}?limit=2000`
    );
    const catIdToNome = new Map<string, string>(
      catRes.response.results.map(c => [c._id, (c as any).Categoria || (c as any).Nome || (c as any).name || ''])
    );

    // 4) Despesas (SubConta) - *** AQUI ESTÁ A CORREÇÃO ***
    const despesaCons = constraints([{ key: 'AGF', constraint_type: 'in', value: agfIds }]);
    const despesaRes = await bubbleGet<{
      _id: string; LançamentoMensal?: string; Categoria?: any; Valor: number | string;
    }>(`/api/1.1/obj/${enc('Despesa (SubConta)')}?limit=5000&constraints=${despesaCons}`);

    // 5) Balancete por LM
    const balCons = constraints([{ key: 'Lançamento Mensal', constraint_type: 'in', value: lmIds }]);
    const balRes = await bubbleGet<{ 'Lançamento Mensal'?: any; Quantidade?: number; }>(
      `/api/1.1/obj/${enc('Balancete')}?limit=2000&constraints=${balCons}`
    );

    // -------- AGREGAÇÃO --------
    const dados: Record<number, Record<number, Record<string, {
      receita: number; objetos: number; despesa_total: number; despesas: Record<string, number>;
    }>>> = {};

    const categoriasDespesa = [
      'aluguel','comissoes','extras','honorarios','impostos','pitney','telefone','veiculos','folha_pagamento'
    ];

    const initAgfData = () => ({
      receita: 0, objetos: 0, despesa_total: 0,
      despesas: Object.fromEntries(categoriasDespesa.map(c => [c, 0]))
    });

    // 5.1) Receita (LM)
    for (const lm of lmRes.response.results) {
      const meta = lmIndex.get(lm._id);
      if (!meta) continue;
      const { ano, mes, agfNome } = meta;
      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) dados[ano][mes][agfNome] = initAgfData();
      dados[ano][mes][agfNome].receita += Number((lm as any).total_receita || 0);
    }

    // 5.2) Objetos (Balancete)
    for (const b of balRes.response.results) {
      const lmId = typeof b['Lançamento Mensal'] === 'string' ? b['Lançamento Mensal'] : b['Lançamento Mensal']?._id;
      if (!lmId) continue;
      const meta = lmIndex.get(lmId);
      if (!meta) continue;
      const { ano, mes, agfNome } = meta;
      if (!dados[ano]?.[mes]?.[agfNome]) continue;
      dados[ano][mes][agfNome].objetos += Number(b.Quantidade || 0);
    }

    // 5.3) Despesas por categoria
    for (const d of despesaRes.response.results) {
      const lmId = d.LançamentoMensal;
      if (!lmId) continue;
      const meta = lmIndex.get(lmId);
      if (!meta) continue;
      const { ano, mes, agfNome } = meta;
      if (!dados[ano]?.[mes]?.[agfNome]) continue;
      
      const rawCat = pick<any>(d, ['Categoria', 'categoria']);
      const catNome = typeof rawCat === 'string' ? (catIdToNome.get(rawCat) || rawCat) : (pick<string>(rawCat, ['Categoria', 'Nome', 'name']) || '');
      const categoria = normalizeCategoria(catNome);
      
      const val = parseValorBR(d.Valor);
      dados[ano][mes][agfNome].despesas[categoria] += val;
    }

    // Garantir chaves e recalcular despesa_total
    for (const ano of Object.keys(dados)) {
      for (const mes of Object.keys(dados[Number(ano)])) {
        for (const agfNome of Object.keys(dados[Number(ano)][Number(mes)])) {
          const d = dados[Number(ano)][Number(mes)][agfNome];
          d.despesa_total = Object.values(d.despesas).reduce((sum, val) => sum + val, 0);
        }
      }
    }

    return NextResponse.json({ agfs, categoriasDespesa, dados });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Erro Interno do Servidor' }, { status: 500 });
  }
}
