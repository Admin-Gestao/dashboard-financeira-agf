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

// valor "17.827,51" -> 17827.51
function parseValorBR(v: any): number {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return 0;
  const s = v
    .toString()
    .replace(/\s+/g,'')
    .replace(/[R$\u00A0]/g,'')
    .replace(/\./g,'')       // remove milhar
    .replace(',', '.');      // vírgula -> ponto
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

// "04/2025" | "4/2025" → { mes:4, ano:2025 } (senão null)
function parseMesAnoStr(s: any): { mes: number; ano: number } | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/^\s*([01]?\d)\s*\/\s*(\d{4})\s*$/);
  if (!m) return null;
  const mes = Number(m[1]);
  const ano = Number(m[2]);
  if (mes>=1 && mes<=12 && ano>1900) return { mes, ano };
  return null;
}

// normaliza categorias vindas variadas para chaves fixas do frontend
function normalizeCategoria(input: any): string {
  const s = String(input || '').toLowerCase()
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

    // 1) AGFs da Empresa Mãe
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

    // 2) LançamentoMensal
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

    // índices: por id e por (ano-mes-agfNome)
    const lmIndex = new Map<string, { ano: number; mes: number; agfId?: string; agfNome: string }>();
    const lmIndexByKey = new Map<string, string>(); // key -> lmId

    for (const lm of lmRes.response.results) {
      const ano = parseAno((lm as any).Ano);
      const mes = parseMes((lm as any).Mês);
      const agfId = typeof lm.AGF === 'string' ? lm.AGF : (lm.AGF as any)?._id;
      const agfNome =
        agfIdToNome.get(agfId || '') ||
        (typeof lm.AGF === 'object' ? ((lm.AGF as any)['Nome da AGF'] || (lm.AGF as any).nome || (lm.AGF as any).name) : '') ||
        agfId || 'AGF';
      if (lm._id) {
        lmIndex.set(lm._id, { ano, mes, agfId, agfNome });
        if (ano && mes) {
          lmIndexByKey.set(`${ano}-${mes}-${agfNome}`, lm._id);
        }
      }
    }
    const lmIds = Array.from(lmIndex.keys());

    // 3) SubConta (por AGF)
    const scCons = constraints([{ key: 'AGF', constraint_type: 'in', value: agfIds }]);
    const scRes = await bubbleGet<{
      _id: string;
      Ano?: any; Mês?: any;
      AGF?: string | { _id: string; 'Nome da AGF'?: string; nome?: string; name?: string };
      LançamentoMensal?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      Categoria?: string | { _id: string; Nome?: string; name?: string };
      Valor: number | string;
    }>(`/api/1.1/obj/${enc('Despesa (SubConta)')}?limit=2000&constraints=${scCons}`);

    // 4) Balancete (por LM)
    const balCons = constraints([{ key: 'Lançamento Mensal', constraint_type: 'in', value: lmIds }]);
    const balRes = await bubbleGet<{
      _id: string;
      'Lançamento Mensal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      Quantidade?: number;
    }>(`/api/1.1/obj/${enc('Balancete')}?limit=2000&constraints=${balCons}`);

    // --------- AGREGAÇÃO ----------

    const dados: Record<number, Record<number, Record<string, {
      receita: number;
      objetos: number;
      despesas: Record<string, number>;
    }>>> = {};

    // fallback despesa total por LM
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

      dados[ano][mes][agfNome].receita += Number((lm as any).total_receita || 0);

      const totalLM = Number((lm as any).total_despesa || 0);
      if (totalLM > 0) lmFallbackDespesa.set(lm._id, { ano, mes, agfNome, total: totalLM });
    }

    // 4.2) Objetos (Balancete)
    for (const b of balRes.response.results) {
      const lmField = (b as any)['Lançamento Mensal'] || (b as any)['LançamentoMensal'];
      let ano = 0, mes = 0, agfNome = 'AGF';

      if (typeof lmField === 'string') {
        const meta = lmIndex.get(lmField);
        if (!meta) continue;
        ano = meta.ano; mes = meta.mes; agfNome = meta.agfNome;
      } else if (typeof lmField === 'object' && lmField) {
        ano = parseAno((lmField as any).Ano);
        mes = parseMes((lmField as any).Mês);
        const aid =
          typeof (lmField as any).AGF === 'string'
            ? (lmField as any).AGF
            : (lmField as any).AGF?._id;
        agfNome = agfIdToNome.get(aid || '') || agfNome;
      }
      if (!ano || !mes) continue;

      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) dados[ano][mes][agfNome] = { receita: 0, objetos: 0, despesas: {} };

      dados[ano][mes][agfNome].objetos += Number((b as any).Quantidade || 0);
    }

    // 4.3) Despesas por categoria (SubConta)
    const lmCobertoPorSubconta = new Set<string>();        // por id
    const lmCobertoPorChave = new Set<string>();           // por (ano-mes-agf)

    for (const sc of scRes.response.results) {
      let ano = parseAno((sc as any).Ano);
      let mes = parseMes((sc as any).Mês);

      const lmField = (sc as any)['LançamentoMensal'] || (sc as any)['Lançamento Mensal'];
      let agfNome = 'AGF';
      let lmId: string | undefined;

      // se LM vier como objeto/id
      if (typeof lmField === 'string') {
        // pode ser id OU "04/2025"
        if (lmIndex.has(lmField)) {
          lmId = lmField;
          const meta = lmIndex.get(lmField)!;
          ano = meta.ano || ano;
          mes = meta.mes || mes;
          agfNome = meta.agfNome || agfNome;
        } else {
          const parsed = parseMesAnoStr(lmField);
          if (parsed) {
            mes = mes || parsed.mes;
            ano = ano || parsed.ano;
          }
        }
      } else if (typeof lmField === 'object' && lmField) {
        lmId = (lmField as any)._id;
        ano = parseAno((lmField as any).Ano) || ano;
        mes = parseMes((lmField as any).Mês) || mes;
        const aid =
          typeof (lmField as any).AGF === 'string'
            ? (lmField as any).AGF
            : (lmField as any).AGF?._id;
        agfNome = agfIdToNome.get(aid || '') || agfNome;
      }

      // AGF direto no registro tem prioridade
      if ((sc as any).AGF) {
        const agfField = (sc as any).AGF;
        const agfId = typeof agfField === 'string' ? agfField : agfField?._id;
        agfNome =
          agfIdToNome.get(agfId || '') ||
          (typeof agfField === 'object'
            ? (agfField['Nome da AGF'] || agfField.nome || agfField.name)
            : '') ||
          agfNome;
      }

      if (!ano || !mes) continue;

      const rawCat = (() => {
        const c = (sc as any).Categoria;
        if (!c) return '';
        if (typeof c === 'string') return c;
        return c.Nome || c.name || '';
      })();
      const categoria = normalizeCategoria(rawCat);

      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) dados[ano][mes][agfNome] = { receita: 0, objetos: 0, despesas: {} };

      const val = parseValorBR((sc as any).Valor);
      dados[ano][mes][agfNome].despesas[categoria] =
        (dados[ano][mes][agfNome].despesas[categoria] || 0) + val;

      // marca cobertura do LM
      if (lmId) {
        lmCobertoPorSubconta.add(lmId);
      }
      const key = `${ano}-${mes}-${agfNome}`;
      lmCobertoPorChave.add(key);
    }

    // 4.4) Fallback de despesa (LM sem SubContas) → soma em "extras"
    lmFallbackDespesa.forEach((info, lmId) => {
      const { ano, mes, agfNome, total } = info;
      const key = `${ano}-${mes}-${agfNome}`;
      if (lmCobertoPorSubconta.has(lmId)) return; // já coberto por id
      if (lmCobertoPorChave.has(key)) return;     // já coberto por (ano,mes,agf)

      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) dados[ano][mes][agfNome] = { receita: 0, objetos: 0, despesas: {} };

      dados[ano][mes][agfNome].despesas['extras'] =
        (dados[ano][mes][agfNome].despesas['extras'] || 0) + Number(total || 0);
    });

    // categorias na ordem desejada
    const categoriasDespesa = [
      'aluguel','comissoes','extras','honorarios','impostos','pitney','telefone','veiculos','folha_pagamento'
    ];

    // garante chaves e números
    for (const anoStr of Object.keys(dados)) {
      const ano = Number(anoStr);
      for (const mesStr of Object.keys(dados[ano])) {
        const mes = Number(mesStr);
        for (const agfNome of Object.keys(dados[ano][mes])) {
          const d = dados[ano][mes][agfNome];
          for (const c of categoriasDespesa) {
            d.despesas[c] = Number(d.despesas[c] || 0);
          }
          d.receita = Number(d.receita || 0);
          d.objetos = Number(d.objetos || 0);
        }
      }
    }

    return NextResponse.json({
      agfs,
      categoriasDespesa,
      dados,
    });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Erro' }, { status: 500 });
  }
}
