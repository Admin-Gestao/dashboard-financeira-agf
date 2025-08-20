import { NextResponse } from 'next/server';

/** ===== Variáveis de ambiente ===== */
const BASE = process.env.BUBBLE_BASE_URL!;
const KEY  = process.env.BUBBLE_API_KEY!;

/** ===== Utilitários ===== */
const enc = (s: string) => encodeURIComponent(s);
const constraints = (obj: any) => encodeURIComponent(JSON.stringify(obj));

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
  const s = v.replace(/\s+/g,'').replace(/[R$\u00A0]/g,'').replace(/\./g,'').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
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
  return (await res.json()) as { response: { results: T[] } };
}

/** ===== Mapas de categoria ===== */
const CAT_ID_TO_KEY: Record<string, string> = {
  '1751034521134x718767032318296000': 'aluguel',
  '1751034485642x432154856311750660': 'extras',
  '1751034473039x889328518957629400': 'honorarios',
  '1751034441316x205655876634673150': 'impostos',
  '1751034431059x728921665608876000': 'pitney',
  '1751034541896x868439199319326700': 'telefone',
  '1751034565744x102496125839998980': 'veiculos',
  '1751034502993x140272905276620800': 'veiculos',
  '1754514204139x526063856276349100': 'folha_pagamento',
};

function normalizeCategoriaNome(input: any): string {
  const s = String(input || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .trim();

  const direct: Record<string,string> = {
    'aluguel':'aluguel',
    'comissoes':'comissoes','comissao':'comissoes','comissão':'comissoes','comissões':'comissoes',
    'extras':'extras',
    'honorarios':'honorarios','honorario':'honorarios','honorário':'honorarios','honorários':'honorarios',
    'impostos':'impostos','imposto':'impostos','pis':'impostos','cofins':'impostos','irrf':'impostos','iss':'impostos',
    'pitney':'pitney',
    'telefone':'telefone','telefonia':'telefone',
    'veiculos':'veiculos','veiculo':'veiculos','veículo':'veiculos','combustivel':'veiculos','pedagio':'veiculos',
    'folha pagamento':'folha_pagamento','folha pagto':'folha_pagamento','folha pgto':'folha_pagamento'
  };
  if (direct[s]) return direct[s];

  if (s.includes('alug')) return 'aluguel';
  if (s.includes('comis')) return 'comissoes';
  if (s.includes('honor')) return 'honorarios';
  if (s.includes('impost')) return 'impostos';
  if (s.includes('pitney')) return 'pitney';
  if (s.includes('telef')) return 'telefone';
  if (s.includes('veic') || s.includes('combust') || s.includes('pedag')) return 'veiculos';
  if (s.includes('folha') || s.includes('pagament') || s.includes('pgto')) return 'folha_pagamento';
  if (s.includes('extra')) return 'extras';
  return 'extras';
}

/** ===== Handler ===== */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const empresaId = searchParams.get('empresa_id');
    if (!empresaId) return NextResponse.json({ error: 'empresa_id ausente' }, { status: 400 });

    // 1) AGFs
    const agfRes = await bubbleGet<{ _id: string; name?: string; ['Nome da AGF']?: string }>(
      `/api/1.1/obj/${enc('AGF')}?limit=200&constraints=${constraints([{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }])}`
    );
    const agfs = agfRes.response.results.map(a => ({ id: a._id, nome: (a as any)['Nome da AGF'] || a.name || a._id }));
    const agfIdToNome = new Map(agfs.map(a => [a.id, a.nome] as const));
    const agfIds = agfs.map(a => a.id);

    // 2) Lançamentos Mensais
    const lmRes = await bubbleGet<{
      _id: string; Ano?: any; Mês?: any; Data?: string;
      AGF?: string | { _id: string };
      total_receita?: number; total_despesa?: number; resultado_final?: number;
    }>(`/api/1.1/obj/${enc('Lançamento Mensal')}?limit=1000&constraints=${constraints([{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }])}`);

    const lmIndex = new Map<string, { ano: number; mes: number; agfNome: string }>();
    for (const lm of lmRes.response.results) {
      const ano = parseAno((lm as any).Ano) || parseAno((lm as any).Data?.split('/')[1]);
      const mes = parseMes((lm as any).Mês) || Number((lm as any).Data?.split('/')[0]);
      const agfId = typeof lm.AGF === 'string' ? lm.AGF : (lm.AGF as any)?._id;
      const agfNome = agfIdToNome.get(agfId || '') || agfId || 'AGF';
      if (lm._id && ano && mes) lmIndex.set(lm._id, { ano, mes, agfNome });
    }
    // ❗️Corrigido: nada de spread em iterator
    const lmIds = Array.from(lmIndex.keys());

    // 3) Categoria Despesa (id -> nome)
    const catRes = await bubbleGet<{ _id: string; Categoria?: string; Nome?: string; name?: string }>(
      `/api/1.1/obj/${enc('Categoria Despesa')}?limit=2000`
    );
    const catIdToNome = new Map<string,string>(
      catRes.response.results.map(c => [c._id, (c as any).Categoria || (c as any).Nome || (c as any).name || ''])
    );

    // 4) SubContas
    const scRes = await bubbleGet<{
      _id: string;
      AGF?: string | { _id: string };
      ['LançamentoMesnal']?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      ['LançamentoMensal']?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      ['Lançamento Mensal']?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      Categoria?: any;
      Valor: number | string;
    }>(`/api/1.1/obj/${enc('Despesa (Sub Contas)')}?limit=5000&constraints=${constraints([{ key: 'AGF', constraint_type: 'in', value: agfIds }])}`);

    // 5) Balancete -> objetos "Total"
    const balRes = await bubbleGet<{
      _id: string; ['Lançamento Mensal']?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      Quantidade?: number | string;
    }>(`/api/1.1/obj/${enc('Balancete')}?limit=2000&constraints=${constraints([
      { key: 'Lançamento Mensal', constraint_type: 'in', value: lmIds },
      { key: 'Tipo de objeto', constraint_type: 'equals', value: 'Total' },
    ])}`);

    /** ===== Estrutura de saída ===== */
    const categoriasBase = ['aluguel','comissoes','extras','honorarios','impostos','pitney','telefone','veiculos','folha_pagamento'];
    const categoriasVistas = new Set<string>(categoriasBase);

    const dados: Record<number, Record<number, Record<string, {
      receita: number; objetos: number; despesa_total: number;
      despesas: Record<string, number>; despesa_subcontas_total?: number;
    }>>> = {};

    const ensure = (ano: number, mes: number, agfNome: string) => {
      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) {
        const cols = Array.from(categoriasVistas);
        dados[ano][mes][agfNome] = {
          receita: 0, objetos: 0, despesa_total: 0,
          despesas: Object.fromEntries(cols.map(c => [c, 0] as const))
        };
      }
      return dados[ano][mes][agfNome];
    };

    // LM -> receita/despesa oficiais
    for (const lm of lmRes.response.results) {
      const meta = lmIndex.get(lm._id);
      if (!meta) continue;
      const entry = ensure(meta.ano, meta.mes, meta.agfNome);
      entry.receita       += Number((lm as any).total_receita || 0);
      entry.despesa_total += Number((lm as any).total_despesa || 0);
    }

    // Objetos
    for (const b of balRes.response.results) {
      const lmField = (b as any)['Lançamento Mensal'];
      let meta: any = null;
      if (typeof lmField === 'string') meta = lmIndex.get(lmField);
      else if (lmField && typeof lmField === 'object') meta = lmIndex.get((lmField as any)._id);
      if (!meta) continue;
      const entry = ensure(meta.ano, meta.mes, meta.agfNome);
      entry.objetos += parseValorBR((b as any).Quantidade);
    }

    // SubContas -> categorias
    for (const sc of scRes.response.results) {
      const lmField = (sc as any)['LançamentoMesnal'] ?? (sc as any)['LançamentoMensal'] ?? (sc as any)['Lançamento Mensal'];
      let meta: any = null;
      if (typeof lmField === 'string') meta = lmIndex.get(lmField);
      else if (lmField && typeof lmField === 'object') meta = lmIndex.get((lmField as any)._id);
      if (!meta) continue;

      let agfNome = meta.agfNome;
      if ((sc as any).AGF) {
        const agfId = typeof (sc as any).AGF === 'string' ? (sc as any).AGF : (sc as any).AGF?._id;
        agfNome = agfIdToNome.get(agfId || '') || agfNome;
      }

      let catId = '';
      let catNome = '';
      const raw = (sc as any).Categoria;
      if (typeof raw === 'string') { catId = raw; catNome = catIdToNome.get(raw) || ''; }
      else if (raw && typeof raw === 'object') {
        catId = (raw as any)._id || '';
        catNome = (raw as any).Categoria || (raw as any).Nome || (raw as any).name || '';
      }
      let key = CAT_ID_TO_KEY[catId] || normalizeCategoriaNome(catNome);
      categoriasVistas.add(key);

      const valor = parseValorBR((sc as any).Valor);
      const entry = ensure(meta.ano, meta.mes, agfNome);
      if (!(key in entry.despesas)) entry.despesas[key] = 0;
      entry.despesas[key] += valor;
      entry.despesa_subcontas_total = (entry.despesa_subcontas_total || 0) + valor;
    }

    // Normalização final
    for (const anoStr of Object.keys(dados)) {
      const ano = Number(anoStr);
      for (const mesStr of Object.keys(dados[ano])) {
        const mes = Number(mesStr);
        for (const agfNome of Object.keys(dados[ano][mes])) {
          const d = dados[ano][mes][agfNome];
          for (const c of Array.from(categoriasVistas)) d.despesas[c] = Number(d.despesas[c] || 0);
          d.receita = Number(d.receita || 0);
          d.objetos = Number(d.objetos || 0);
          d.despesa_total = Number(d.despesa_total || 0);
          d.despesa_subcontas_total = Number(d.despesa_subcontas_total || 0);
        }
      }
    }

    return NextResponse.json({
      agfs,
      categoriasDespesa: Array.from(categoriasVistas),
      dados
    });
  } catch (e: any) {
    console.error('Erro na API:', e);
    return NextResponse.json({ error: e.message || 'Erro Interno do Servidor' }, { status: 500 });
  }
}
