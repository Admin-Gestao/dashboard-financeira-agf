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
function parseMesAnoStr(s: any): { mes: number; ano: number } | null {
  if (typeof s !== 'string') return null;
  const m = s.match(/^\s*([01]?\d)\s*\/\s*(\d{4})\s*$/);
  if (!m) return null;
  const mes = Number(m[1]);
  const ano = Number(m[2]);
  if (mes>=1 && mes<=12 && ano>1900) return { mes, ano };
  return null;
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

/** Mapa rápido (opcional) de ID de Categoria -> chave canônica */
const CAT_ID_TO_KEY: Record<string, string> = {
  // AGF 1751032012715x423593633964884000 (Campo Limpo)
  "1754514204139x526063856276349100": "folha_pagamento",
  "1751034502993x140272905276620800": "veiculos",
  "1751034541896x868439199319326700": "telefone",
  "1751034431059x728921665608876000": "pitney",
  "1751034441316x205655876634673150": "impostos",
  "1751034473039x889328518957629400": "honorarios",
  "1751034485642x432154856311750660": "extras",
  "1751034521134x718767032318296000": "aluguel",
  "1751034565744x102496125839998980": "comissoes",

  // AGF 1752096538554x179551120588800000
  "1754070490704x231856758205448200": "aluguel",
  "1754070514400x329889315937845250": "comissoes",
  "1754070456208x252559865169575940": "extras",
  "1754070443985x667206317484277800": "honorarios",
  "1754070430759x682734868761149400": "impostos",
  "1754070420062x128183682507735040": "pitney",
  "1754070502210x652422025222553600": "telefone",
  "1754070474958x145718347264426000": "veiculos",
  "1755707826761x652862801132216600": "folha_pagamento",

  // AGF 1751494194789x272905751163116770
  "1755695251313x921435259610147000": "aluguel",
  "1755695225576x725117049811793400": "comissoes",
  "1755695134198x500541998866248700": "extras",
  "1755695100227x210629430516269020": "honorarios",
  "1755695074934x439006081075832060": "impostos",
  "1755695046174x268899668131042720": "pitney",
  "1755695193899x693528764351259500": "telefone",
  "1755695164261x607361797055734100": "veiculos",
  "1755695521004x217825384616417760": "folha_pagamento",
};

/* =========================
   BUBBLE FETCH COM FALLBACK
   ========================= */
type BubbleResponse<T=any> = { response: { results?: T[]; count?: number } & Record<string, any> };

async function bubbleGetFirst<T=any>(paths: string[]): Promise<BubbleResponse<T>> {
  let lastError: any = null;
  for (const p of paths) {
    try {
      const res = await fetch(`${BASE}${p}`, {
        headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} on ${p}`);
        continue;
      }
      const json = await res.json();
      return json as BubbleResponse<T>;
    } catch (e) {
      lastError = e;
      continue;
    }
  }
  throw lastError ?? new Error('Falha ao consultar Bubble');
}

function objPathsPlural(objectCandidates: string[], query: string) {
  return objectCandidates.map(o => `/api/1.1/obj/${enc(o)}${query}`);
}
function objPathSingle(objectCandidates: string[], id: string) {
  return objectCandidates.map(o => `/api/1.1/obj/${enc(o)}/${enc(id)}`);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const empresaId = searchParams.get('empresa_id');
    if (!empresaId) return NextResponse.json({ error: 'empresa_id ausente' }, { status: 400 });

    // Candidatos de nome para cada objeto (tenta todos nessa ordem)
    const OBJ = {
      agf: ['agf','AGF'],
      lm: ['lançamentomensal','LançamentoMensal','lan%C3%A7amentomensal'], // redundante por segurança
      categoria: ['categoriadespesa','Categoria Despesa'],
      subconta: ['despesa(subconta)','Despesa (SubConta)'],
      balancete: ['balancete','Balancete'],
    };

    // === 1) AGFs da empresa ===
    const agfCons = constraints([{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }]);
    const agfsRes = await bubbleGetFirst<{ _id: string; 'Nome da AGF'?: string; nome?: string; name?: string }>(
      objPathsPlural(OBJ.agf, `?limit=200&constraints=${agfCons}`)
    );
    const agfs = (agfsRes.response.results || []).map(a => ({
      id: a._id,
      nome: (a as any)['Nome da AGF'] || (a as any).nome || (a as any).name || a._id,
    }));
    const agfIdToNome = new Map<string, string>(agfs.map(a => [a.id, a.nome]));
    const agfIds = agfs.map(a => a.id);

    // Se não houver AGF, devolve estrutura vazia (evita 500 por IN [])
    if (agfIds.length === 0) {
      return NextResponse.json({ agfs: [], categoriasDespesa: [
        'aluguel','comissoes','extras','honorarios','impostos','pitney','telefone','veiculos','folha_pagamento'
      ], dados: {} });
    }

    // === 2) Lançamentos Mensais da empresa ===
    const lmCons = constraints([{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }]);
    const lmRes = await bubbleGetFirst<{
      _id: string; Ano: any; Mês: any; AGF: string | { _id: string };
      total_receita?: number; total_despesa?: number; resultado_final?: number; Data?: string;
    }>(objPathsPlural(OBJ.lm, `?limit=1000&constraints=${lmCons}`));

    const lmIndex = new Map<string, { ano: number; mes: number; agfId?: string; agfNome: string }>();
    for (const lm of (lmRes.response.results || [])) {
      const ano = parseAno((lm as any).Ano) || parseAno((lm as any).Data?.split('/')[1]);
      const mes = parseMes((lm as any).Mês) || Number((lm as any).Data?.split('/')[0]);
      const agfId = typeof lm.AGF === 'string' ? lm.AGF : (lm.AGF as any)?._id;
      const agfNome = agfIdToNome.get(agfId || '') || agfId || 'AGF';
      if (lm._id) lmIndex.set(lm._id, { ano, mes, agfId, agfNome });
    }
    const lmIds = Array.from(lmIndex.keys());

    // === 3) Categorias (id -> nome) ===
    const catRes = await bubbleGetFirst<{ _id: string; Categoria?: string; Nome?: string; name?: string; nome?: string; Descrição?: string; descricao?: string }>(
      objPathsPlural(OBJ.categoria, `?limit=2000`)
    );
    const catIdToNome = new Map<string, string>(
      (catRes.response.results || []).map(c => {
        const nome =
          (c as any).Categoria || (c as any).Nome || (c as any).name || (c as any).nome ||
          (c as any).Descrição || (c as any).descricao || '';
        return [c._id, String(nome)] as const;
      })
    );

    // === 4) SubContas (busca por AGF e por LM; evita IN [] quando não houver LM) ===
    const scParts: any[] = [];

    // por AGF
    const subByAgfCons = constraints([{ key: 'AGF', constraint_type: 'in', value: agfIds }]);
    const scAgf = await bubbleGetFirst<any>(objPathsPlural(OBJ.subconta, `?limit=5000&constraints=${subByAgfCons}`));
    scParts.push(...(scAgf.response.results || []));

    // por LM, só se houver LM
    if (lmIds.length > 0) {
      const subByLmCons  = constraints([{ key: 'LançamentoMesnal', constraint_type: 'in', value: lmIds }]);
      const subByLmCons2 = constraints([{ key: 'Lançamento Mensal', constraint_type: 'in', value: lmIds }]);
      const [scLm1, scLm2] = await Promise.all([
        bubbleGetFirst<any>(objPathsPlural(OBJ.subconta, `?limit=5000&constraints=${subByLmCons}`)),
        bubbleGetFirst<any>(objPathsPlural(OBJ.subconta, `?limit=5000&constraints=${subByLmCons2}`)),
      ]);
      scParts.push(...(scLm1.response.results || []), ...(scLm2.response.results || []));
    }

    // merge únicos por _id
    const scMap = new Map<string, any>();
    for (const it of scParts) scMap.set(it._id, it);
    const subAll = Array.from(scMap.values());

    // (4b) Trazer nomes de categorias faltantes
    const missingCatIds = Array.from(new Set(
      subAll
        .map((sc: any) => (typeof sc?.Categoria === 'string' ? sc.Categoria : null))
        .filter((id: any): id is string => !!id && !catIdToNome.has(id))
    ));
    for (const cid of missingCatIds) {
      try {
        const single = await bubbleGetFirst<any>(objPathSingle(OBJ.categoria, cid));
        // Bubble pode retornar {response: {...}} direto ou com results
        const item = (single.response as any).results?.[0] || (single.response as any);
        const nome = item?.Categoria || item?.Nome || item?.name || item?.nome || '';
        if (nome) catIdToNome.set(cid, String(nome));
      } catch { /* ignora */ }
    }

    // === 5) Balancete (objetos - Total) ===
    let balResults: any[] = [];
    if (lmIds.length > 0) {
      const balCons = constraints([
        { key: 'Lançamento Mensal', constraint_type: 'in', value: lmIds },
        { key: 'Tipo de objeto',    constraint_type: 'equals', value: 'Total' },
      ]);
      const balRes = await bubbleGetFirst<any>(objPathsPlural(OBJ.balancete, `?limit=2000&constraints=${balCons}`));
      balResults = balRes.response.results || [];
    }

    // -------- AGREGAÇÃO --------
    const categoriasDespesa = [
      'aluguel','comissoes','extras','honorarios','impostos','pitney','telefone','veiculos','folha_pagamento'
    ];

    const dados: Record<number, Record<number, Record<string, {
      receita: number;
      objetos: number;
      despesa_total: number;
      despesas: Record<string, number>;
      despesa_subcontas_total?: number;
    }>>> = {};

    const ensure = (ano: number, mes: number, agfNome: string) => {
      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][agfNome]) {
        dados[ano][mes][agfNome] = {
          receita: 0,
          objetos: 0,
          despesa_total: 0,
          despesas: Object.fromEntries(categoriasDespesa.map(c => [c, 0]))
        };
      }
      return dados[ano][mes][agfNome];
    };

    // 5.1) LM -> receita e despesa
    for (const lm of (lmRes.response.results || [])) {
      const meta = lmIndex.get(lm._id);
      if (!meta) continue;
      const { ano, mes, agfNome } = meta;
      if (!ano || !mes) continue;

      const entry = ensure(ano, mes, agfNome);
      entry.receita       += Number((lm as any).total_receita || 0);
      entry.despesa_total += Number((lm as any).total_despesa || 0);
    }

    // 5.2) Objetos
    for (const b of balResults) {
      const lmField = (b as any)['Lançamento Mensal'];
      let ano = 0, mes = 0, agfNome = 'AGF';

      if (typeof lmField === 'string') {
        const meta = lmIndex.get(lmField);
        if (!meta) continue;
        ano = meta.ano; mes = meta.mes; agfNome = meta.agfNome;
      } else if (typeof lmField === 'object' && lmField) {
        ano = parseAno((lmField as any).Ano);
        mes = parseMes((lmField as any).Mês);
        const aid = typeof (lmField as any).AGF === 'string' ? (lmField as any).AGF : (lmField as any).AGF?._id;
        agfNome = agfIdToNome.get(aid || '') || agfNome;
      }
      if (!ano || !mes) continue;

      const entry = ensure(ano, mes, agfNome);
      entry.objetos += parseValorBR((b as any).Quantidade);
    }

    // 5.3) Despesas por categoria (SubContas) — soma todas as linhas
    for (const sc of subAll) {
      const lmField =
        (sc as any)['LançamentoMesnal'] ??
        (sc as any)['LançamentoMensal'] ??
        (sc as any)['Lançamento Mensal'];

      let ano = 0, mes = 0, agfNome = 'AGF';

      if (typeof lmField === 'string') {
        const meta = lmIndex.get(lmField);
        if (meta) {
          ano = meta.ano; mes = meta.mes; agfNome = meta.agfNome;
        } else {
          const parsed = parseMesAnoStr(lmField);
          if (parsed) { ano = parsed.ano; mes = parsed.mes; }
        }
      } else if (typeof lmField === 'object' && lmField) {
        ano = parseAno((lmField as any).Ano);
        mes = parseMes((lmField as any).Mês);
        const aid = typeof (lmField as any).AGF === 'string' ? (lmField as any).AGF : (lmField as any).AGF?._id;
        agfNome = agfIdToNome.get(aid || '') || agfNome;
      }

      // se vier AGF direto na SubConta, prioriza
      if ((sc as any).AGF) {
        const agfField = (sc as any).AGF;
        const agfId = typeof agfField === 'string' ? agfField : agfField?._id;
        agfNome = agfIdToNome.get(agfId || '') || agfNome;
      }
      if (!ano || !mes) continue;

      const entry = ensure(ano, mes, agfNome);

      let nomeCategoria = '';
      const c = (sc as any).Categoria;
      if (c) {
        if (typeof c === 'string') nomeCategoria = catIdToNome.get(c) || '';
        else if (typeof c === 'object') {
          nomeCategoria = (c as any).Categoria || (c as any).Nome || (c as any).name || '';
        }
      }
      const descricao = (sc as any).Descrição ?? (sc as any).descricao ?? '';
      const categoria = normalizeCategoriaFromMeta(nomeCategoria, descricao, typeof c === 'string' ? c : undefined);
      const valor = parseValorBR((sc as any).Valor);

      entry.despesas[categoria] = (entry.despesas[categoria] || 0) + valor;
      entry.despesa_subcontas_total = (entry.despesa_subcontas_total || 0) + valor;
    }

    // 5.4) Normalizações finais
    for (const anoStr of Object.keys(dados)) {
      const ano = Number(anoStr);
      for (const mesStr of Object.keys(dados[ano])) {
        const mes = Number(mesStr);
        for (const agfNome of Object.keys(dados[ano][mes])) {
          const d = dados[ano][mes][agfNome];
          d.receita = Number(d.receita || 0);
          d.objetos = Number(d.objetos || 0);
          d.despesa_total = Number(d.despesa_total || 0);
          for (const c of ['aluguel','comissoes','extras','honorarios','impostos','pitney','telefone','veiculos','folha_pagamento'])
            d.despesas[c] = Number(d.despesas[c] || 0);
          d.despesa_subcontas_total = Number(d.despesa_subcontas_total || 0);
        }
      }
    }

    return NextResponse.json({ agfs, categoriasDespesa, dados });
  } catch (e: any) {
    console.error('Erro na API /api/dash-data:', e?.message || e);
    return NextResponse.json({ error: e?.message || 'Erro Interno do Servidor' }, { status: 500 });
  }
}
