import { NextResponse } from 'next/server';

const BASE = process.env.BUBBLE_BASE_URL!;
const KEY  = process.env.BUBBLE_API_KEY!;

function enc(s: string) { return encodeURIComponent(s); }
function constraints(obj: any) { return encodeURIComponent(JSON.stringify(obj)); }

// -----------------------
// Utilidades de parsing
// -----------------------
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

// "04/2025" | "4/2025" → { mes, ano }
function parseMesAnoStr(s: any): { mes: number; ano: number } | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/^\s*([01]?\d)\s*\/\s*(\d{4})\s*$/);
  if (!m) return null;
  const mes = Number(m[1]);
  const ano = Number(m[2]);
  if (mes>=1 && mes<=12 && ano>1900) return { mes, ano };
  return null;
}

// valor "15.432" / "15.432,99" → 15432.99
function parseValorBR(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return 0;
  const s = v
    .replace(/\s+/g,'')
    .replace(/[R$\u00A0]/g,'')
    .replace(/\./g,'')
    .replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// normaliza categorias do Bubble para chaves fixas do front
function normalizeCategoria(input: any): string {
  const s = String(input || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .trim();

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

// lê 'display'/'text' ou variações usuais
function getDisplay(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return (
    v.display ??
    v.text ??
    v['Nome'] ??
    v['name'] ??
    v['Nome da AGF'] ??
    ''
  );
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

// -----------------------
// Handler
// -----------------------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const empresaId = searchParams.get('empresa_id');
    if (!empresaId) {
      return NextResponse.json({ error: 'empresa_id ausente' }, { status: 400 });
    }

    // 1) AGFs da empresa
    const agfCons = constraints([{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }]);
    const agfsRes = await bubbleGet<{ _id: string; 'Nome da AGF'?: string; nome?: string; name?: string; display?: string }>(
      `/api/1.1/obj/${enc('AGF')}?limit=200&constraints=${agfCons}`
    );

    const agfs = agfsRes.response.results.map(a => ({
      id: a._id,
      nome: (a as any)['Nome da AGF'] || (a as any).nome || (a as any).name || (a as any).display || a._id,
    }));
    const agfIdToNome = new Map<string, string>(agfs.map(a => [a.id, a.nome]));
    const agfIds = agfs.map(a => a.id);

    // 2) Lançamento Mensal
    const lmCons = constraints([{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }]);
    const lmRes = await bubbleGet<{
      _id: string;
      Ano: any;
      Mês: any;
      AGF: any; // string | object
      total_receita?: number | string;
      total_despesa?: number | string;
      resultado_final?: number | string;
      resultado_extra?: number | string;
    }>(`/api/1.1/obj/${enc('LançamentoMensal')}?limit=1000&constraints=${lmCons}`);

    const lmIndex = new Map<string, { ano: number; mes: number; agfId?: string; agfNome: string }>();
    const lmIndexByKey = new Map<string, string>(); // "ano-mes-agfNome" → lmId

    for (const lm of lmRes.response.results) {
      const ano = parseAno((lm as any).Ano);
      const mes = parseMes((lm as any).Mês);

      let agfId: string | undefined;
      let agfNome = 'AGF';
      const agfField = (lm as any).AGF;
      if (typeof agfField === 'string') {
        agfId = agfField;
        agfNome = agfIdToNome.get(agfId) || agfNome;
      } else if (agfField && typeof agfField === 'object') {
        agfId = agfField._id;
        agfNome = agfIdToNome.get(agfId || '') || getDisplay(agfField) || agfNome;
      }

      if (lm._id) {
        lmIndex.set(lm._id, { ano, mes, agfId, agfNome });
        if (ano && mes) lmIndexByKey.set(`${ano}-${mes}-${agfNome}`, lm._id);
      }
    }
    const lmIds = Array.from(lmIndex.keys());

    // 3) SubContas (por AGF)
    const scCons = constraints([{ key: 'AGF', constraint_type: 'in', value: agfIds }]);
    const scRes = await bubbleGet<{
      _id: string;
      Ano?: any; Mês?: any;
      AGF?: any; // string | object
      LançamentoMensal?: any; // string "4/2025" | object | id
      Categoria?: any; // option set (display/text) | string
      Valor: number | string;
    }>(`/api/1.1/obj/${enc('Despesa (SubConta)')}?limit=2000&constraints=${scCons}`);

    // 4) Balancete (por LM)
    const balCons = constraints([{ key: 'Lançamento Mensal', constraint_type: 'in', value: lmIds }]);
    const balRes = await bubbleGet<{
      _id: string;
      'Lançamento Mensal'?: any;
      Quantidade?: number | string;
    }>(`/api/1.1/obj/${enc('Balancete')}?limit=2000&constraints=${balCons}`);

    // -----------------------
    // AGREGAÇÃO
    // -----------------------
    const dados: Record<number, Record<number, Record<string, {
      receita: number;
      objetos: number;
      despesas: Record<string, number>;
    }>>> = {};

    const lmFallbackDespesa = new Map<string, { ano: number; mes: number; agfNome: string; total: number }>();

    // 4.1) Receita + fallback bruto
    for (const lm of lmRes.response.results) {
      const meta = lmIndex.get(lm._id);
      if (!meta) continue;
      const { ano, mes, agfNome } = meta;
      if (!ano || !mes) continue;

      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) dados[ano][mes][agfNome] = { receita: 0, objetos: 0, despesas: {} };

      dados[ano][mes][agfNome].receita += Number((lm as any).total_receita ?? 0);

      const totalLM = Number((lm as any).total_despesa ?? 0);
      if (totalLM > 0) lmFallbackDespesa.set(lm._id, { ano, mes, agfNome, total: totalLM });
    }

    // 4.2) Objetos (Balancete)
    for (const b of balRes.response.results) {
      const lmField = (b as any)['Lançamento Mensal'] || (b as any)['LançamentoMensal'];
      let ano = 0, mes = 0, agfNome = 'AGF';

      if (typeof lmField === 'string') {
        const meta = lmIndex.get(lmField);
        if (meta) {
          ano = meta.ano; mes = meta.mes; agfNome = meta.agfNome;
        }
      } else if (lmField && typeof lmField === 'object') {
        ano = parseAno(lmField.Ano);
        mes = parseMes(lmField.Mês);
        const aid = typeof lmField.AGF === 'string' ? lmField.AGF : lmField.AGF?._id;
        agfNome = agfIdToNome.get(aid || '') || getDisplay(lmField.AGF) || agfNome;
      }
      if (!ano || !mes) continue;

      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) dados[ano][mes][agfNome] = { receita: 0, objetos: 0, despesas: {} };

      dados[ano][mes][agfNome].objetos += Number((b as any).Quantidade ?? 0);
    }

    // 4.3) Despesas por categoria (SubConta)
    const lmCobertoPorSubconta = new Set<string>();
    const lmCobertoPorChave     = new Set<string>();

    for (const sc of scRes.response.results) {
      let ano = parseAno((sc as any).Ano);
      let mes = parseMes((sc as any).Mês);

      const lmField = (sc as any)['LançamentoMensal'] || (sc as any)['Lançamento Mensal'];
      let agfNome = 'AGF';
      let lmId: string | undefined;

      // LM pode vir como id, objeto, ou string "4/2025"
      if (typeof lmField === 'string') {
        if (lmIndex.has(lmField)) {
          lmId = lmField;
          const meta = lmIndex.get(lmField)!;
          ano = meta.ano || ano;
          mes = meta.mes || mes;
          agfNome = meta.agfNome || agfNome;
        } else {
          const parsed = parseMesAnoStr(lmField);
          if (parsed) { mes ||= parsed.mes; ano ||= parsed.ano; }
        }
      } else if (lmField && typeof lmField === 'object') {
        lmId = lmField._id;
        ano = parseAno(lmField.Ano) || ano;
        mes = parseMes(lmField.Mês) || mes;
        const aid = typeof lmField.AGF === 'string' ? lmField.AGF : lmField.AGF?._id;
        agfNome = agfIdToNome.get(aid || '') || getDisplay(lmField.AGF) || agfNome;
      }

      // AGF direto na SubConta tem prioridade
      if ((sc as any).AGF) {
        const agfField = (sc as any).AGF;
        const agfId = typeof agfField === 'string' ? agfField : agfField?._id;
        agfNome =
          agfIdToNome.get(agfId || '') ||
          getDisplay(agfField) ||
          agfNome;
      }

      if (!ano || !mes) continue;

      // Categoria (Option Set): usar display/text
      const catRaw = getDisplay((sc as any).Categoria);
      const categoria = normalizeCategoria(catRaw);

      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) dados[ano][mes][agfNome] = { receita: 0, objetos: 0, despesas: {} };

      const val = parseValorBR((sc as any).Valor);
      dados[ano][mes][agfNome].despesas[categoria] =
        (dados[ano][mes][agfNome].despesas[categoria] || 0) + val;

      if (lmId) lmCobertoPorSubconta.add(lmId);
      lmCobertoPorChave.add(`${ano}-${mes}-${agfNome}`);
    }

    // 4.4) Fallback de despesa → joga em "extras" apenas se NÃO houver subcontas
    lmFallbackDespesa.forEach((info, lmId) => {
      const { ano, mes, agfNome, total } = info;
      const key = `${ano}-${mes}-${agfNome}`;
      if (lmCobertoPorSubconta.has(lmId)) return;
      if (lmCobertoPorChave.has(key))     return;

      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) dados[ano][mes][agfNome] = { receita: 0, objetos: 0, despesas: {} };

      dados[ano][mes][agfNome].despesas['extras'] =
        (dados[ano][mes][agfNome].despesas['extras'] || 0) + Number(total || 0);
    });

    // ordem das colunas
    const categoriasDespesa = [
      'aluguel','comissoes','extras','honorarios','impostos','pitney','telefone','veiculos','folha_pagamento'
    ];

    // garantir chaves/numéricos
    for (const anoStr of Object.keys(dados)) {
      const ano = Number(anoStr);
      for (const mesStr of Object.keys(dados[ano])) {
        const mes = Number(mesStr);
        for (const agfNome of Object.keys(dados[ano][mes])) {
          const d = dados[ano][mes][agfNome];
          for (const c of categoriasDespesa) d.despesas[c] = Number(d.despesas[c] || 0);
          d.receita = Number(d.receita || 0);
          d.objetos = Number(d.objetos || 0);
        }
      }
    }

    return NextResponse.json({ agfs, categoriasDespesa, dados });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 });
  }
}
