import { NextResponse } from 'next/server';

// ----------------- CONFIG -----------------
const BASE = process.env.BUBBLE_BASE_URL!;
const KEY  = process.env.BUBBLE_API_KEY!;

function enc(s: string) { return encodeURIComponent(s); }
function constraints(obj: any) { return encodeURIComponent(JSON.stringify(obj)); }

// ----------------- HELPERS -----------------
function normAgfName(s: string) {
  return String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

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

// -------- MAPA Categoria(ID) -> chave canônica --------
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

  // AGF 1752096538554x179551120588800000 (Senador Teotonio)
  "1754070490704x231856758205448200": "aluguel",
  "1754070514400x329889315937845250": "comissoes",
  "1754070456208x252559865169575940": "extras",
  "1754070443985x667206317484277800": "honorarios",
  "1754070430759x682734868761149400": "impostos",
  "1754070420062x128183682507735040": "pitney",
  "1754070502210x652422025222553600": "telefone",
  "1754070474958x145718347264426000": "veiculos",
  "1755707826761x652862801132216600": "folha_pagamento",

  // AGF 1751494194789x272905751163116770 (Sao Jorge)
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

// ---------- Normalização de categoria ----------
function normalizeCategoriaFromMeta(nomeCat: string, descricao: string, categoriaId?: string): string {
  if (categoriaId && CAT_ID_TO_KEY[categoriaId]) {
    return CAT_ID_TO_KEY[categoriaId];
  }
  const raw = String(nomeCat || '').trim();
  const s = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  const direct: Record<string,string> = {
    'aluguel':'aluguel',
    'comissoes':'comissoes','comissão':'comissoes','comissao':'comissoes',
    'extras':'extras',
    'honorarios':'honorarios','honorário':'honorarios','honorario':'honorarios',
    'imposto':'impostos','impostos':'impostos',
    'pitney':'pitney',
    'telefone':'telefone','telefonia':'telefone',
    'veiculos':'veiculos','veículo':'veiculos','veiculo':'veiculos',
    'folha pgto':'folha_pagamento','folha pgto.':'folha_pagamento','folha pagamento':'folha_pagamento',
  };
  if (direct[s]) return direct[s];

  if (s.includes('alug')) return 'aluguel';
  if (s.includes('comis')) return 'comissoes';
  if (s.includes('honor')) return 'honorarios';
  if (s.includes('pitney')) return 'pitney';
  if (s.includes('telef')) return 'telefone';
  if (s.includes('veic')) return 'veiculos';
  if (s.includes('impost') || s === 'pis' || s === 'cofins' || s === 'irrf' || s.includes('iss')) return 'impostos';
  if (s.includes('folha') || s.includes('pgto') || s.includes('pagament')) return 'folha_pagamento';
  if (s.includes('extra')) return 'extras';

  const d = (descricao || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (/(pis|cofins|irrf|iss)/.test(d)) return 'impostos';
  if (/(uber|post[oa]|estaciona|motoboy|pedag|sem parar|km|combust)/.test(d)) return 'veiculos';
  if (/(vivo|claro|america\s*net|telefonica|tim|oi|celular|fixo)/.test(d)) return 'telefone';
  if (/(pitney|loca[çc][aã]o|manuten|tinta|material|servic)/.test(d)) return 'pitney';
  if (/(dr|doutor|m[ée]dico|advog|contab)/.test(d)) return 'honorarios';
  if (/(omega|unifisa|ewd|emilio|ghisso|comiss)/.test(d)) return 'comissoes';
  if (/(aluguel|shopping)/.test(d)) return 'aluguel';

  return 'extras';
}

// ------------- BUBBLE CLIENT (com paginação) -------------
async function bubbleFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Bubble GET ${path} -> ${res.status} ${body}`);
  }
  return res.json();
}

async function bubbleGetAll<T>(type: string, cons?: any, limit = 1000): Promise<T[]> {
  const items: T[] = [];
  let cursor: number | undefined = undefined;

  while (true) {
    const qs: string[] = [`limit=${limit}`];
    if (cons) qs.push(`constraints=${constraints(cons)}`);
    if (typeof cursor === 'number') qs.push(`cursor=${cursor}`);

    const data = await bubbleFetch(`/api/1.1/obj/${enc(type)}?${qs.join('&')}`);
    const res = data?.response;
    if (!res) break;

    const batch = (res.results || []) as T[];
    items.push(...batch);

    const remaining = Number(res.remaining ?? 0);
    if (remaining > 0) {
      cursor = Number(res.cursor ?? 0) + (batch.length || 0);
    } else break;
  }
  return items;
}

async function bubbleGetOne<T>(type: string, id: string): Promise<T | null> {
  const data = await bubbleFetch(`/api/1.1/obj/${enc(type)}/${enc(id)}`);
  return (data && data.response) ? (data.response as T) : null;
}

// ----------------- HANDLER -----------------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const empresaId = searchParams.get('empresa_id');
    if (!empresaId) return NextResponse.json({ error: 'empresa_id ausente' }, { status: 400 });

    // 1) AGFs da empresa
    const agfList = await bubbleGetAll<{ _id: string; 'Nome da AGF'?: string; nome?: string; name?: string }>(
      'AGF',
      [{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }],
      1000
    );
    const agfs = agfList.map(a => {
      const nomeRaw = (a as any)['Nome da AGF'] || (a as any).nome || (a as any).name || a._id;
      return { id: a._id, nome: normAgfName(nomeRaw) };
    });
    const agfIdToNome = new Map<string, string>(agfs.map(a => [a.id, a.nome]));
    const agfIds = agfs.map(a => a.id);

    // 2) Lançamentos Mensais
    const lmList = await bubbleGetAll<{
      _id: string; Ano: any; Mês: any; AGF: string | { _id: string }; Data?: string;
      total_receita?: number; total_despesa?: number; resultado_final?: number;
    }>('LançamentoMensal', [{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }], 1000);

    const lmIndex = new Map<string, { ano: number; mes: number; agfId?: string; agfNome: string }>();
    for (const lm of lmList) {
      const ano = parseAno((lm as any).Ano) || parseAno((lm as any).Data?.split?.('/')[1]);
      const mes = parseMes((lm as any).Mês) || Number((lm as any).Data?.split?.('/')?.[0]);
      const agfId = typeof lm.AGF === 'string' ? lm.AGF : (lm.AGF as any)?._id;
      const agfNome = normAgfName(agfIdToNome.get(agfId || '') || agfId || 'AGF');
      lmIndex.set(lm._id, { ano, mes, agfId, agfNome });
    }

    // 3) Categorias (id -> nome)
    const catList = await bubbleGetAll<{ _id: string; Categoria?: string; Nome?: string; name?: string; nome?: string; Descrição?: string; descricao?: string }>(
      'Categoria Despesa', undefined, 2000
    );
    const catIdToNome = new Map<string, string>(
      catList.map(c => {
        const nome =
          (c as any).Categoria || (c as any).Nome || (c as any).name || (c as any).nome ||
          (c as any).Descrição || (c as any).descricao || '';
        return [c._id, String(nome)] as const;
      })
    );

    // 4) SubContas
    const scList = await bubbleGetAll<{
      _id: string;
      AGF: string | { _id: string };
      'LançamentoMesnal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      'LançamentoMensal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      'Lançamento Mensal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      Categoria?: any;
      Valor: number | string;
      Descrição?: string;
      descricao?: string;
    }>('Despesa (SubConta)', [{ key: 'AGF', constraint_type: 'in', value: agfIds }], 1000);

    // (4b) Completar categorias faltantes (se algum ID não veio na lista)
    const missingCatIds = Array.from(new Set(
      scList
        .map(sc => (typeof (sc as any).Categoria === 'string' ? (sc as any).Categoria : null))
        .filter((id): id is string => !!id && !catIdToNome.has(id))
    ));
    for (const cid of missingCatIds) {
      try {
        const one = await bubbleGetOne<any>('Categoria Despesa', cid);
        const nome = one?.Categoria || one?.Nome || one?.name || one?.nome || '';
        if (nome) catIdToNome.set(cid, String(nome));
      } catch { /* ignore */ }
    }

    // (4c) Completar LMs referenciados só nas SubContas
    const scLmIds = Array.from(new Set(
      scList.map(sc => {
        const lmField =
          (sc as any)['LançamentoMesnal'] ??
          (sc as any)['LançamentoMensal'] ??
          (sc as any)['Lançamento Mensal'];
        return (typeof lmField === 'string') ? lmField : (lmField?._id || null);
      }).filter((id: any) => typeof id === 'string')
    )) as string[];
    const missingLmIds = scLmIds.filter(id => !lmIndex.has(id));
    for (const id of missingLmIds) {
      try {
        const one = await bubbleGetOne<any>('LançamentoMensal', id);
        if (!one) continue;
        const ano = parseAno(one.Ano) || parseAno(one?.Data?.split?.('/')?.[1]);
        const mes = parseMes(one.Mês) || Number(one?.Data?.split?.('/')?.[0]);
        const agfId = typeof one.AGF === 'string' ? one.AGF : one.AGF?._id;
        const agfNome = normAgfName(agfIdToNome.get(agfId || '') || agfId || 'AGF');
        lmIndex.set(id, { ano, mes, agfId, agfNome });
      } catch { /* ignore */ }
    }

    // 5) Balancete (objetos) – somente "Total"
    const balList = await bubbleGetAll<{
      _id: string;
      'Lançamento Mensal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      Quantidade?: number | string;
    }>('Balancete', [
      { key: 'Lançamento Mensal', constraint_type: 'in', value: Array.from(lmIndex.keys()) },
      { key: 'Tipo de objeto',    constraint_type: 'equals', value: 'Total' },
    ], 1000);

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
      const key = normAgfName(agfNome);
      if (!dados[ano]) dados[ano] = {};
      if (!dados[ano][mes]) dados[ano][mes] = {};
      if (!dados[ano][mes][key]) {
        dados[ano][mes][key] = {
          receita: 0,
          objetos: 0,
          despesa_total: 0,
          despesas: Object.fromEntries(categoriasDespesa.map(c => [c, 0]))
        };
      }
      return dados[ano][mes][key];
    };

    // 5.1) LM oficiais (receita/total)
    for (const lm of lmList) {
      const meta = lmIndex.get(lm._id);
      if (!meta) continue;
      const { ano, mes, agfNome } = meta;
      if (!ano || !mes) continue;

      const entry = ensure(ano, mes, agfNome);
      entry.receita       += Number((lm as any).total_receita || 0);
      entry.despesa_total += Number((lm as any).total_despesa || 0);
    }

    // 5.2) Objetos
    for (const b of balList) {
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
        agfNome = normAgfName(agfIdToNome.get(aid || '') || agfNome);
      }
      if (!ano || !mes) continue;

      const entry = ensure(ano, mes, agfNome);
      entry.objetos += parseValorBR((b as any).Quantidade);
    }

    // 5.3) SubContas por categoria
    for (const sc of scList) {
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
        agfNome = normAgfName(agfIdToNome.get(aid || '') || agfNome);
      }

      // Se AGF vier direto na SubConta, usa ele (normalizado)
      if ((sc as any).AGF) {
        const agfField = (sc as any).AGF;
        const agfId = typeof agfField === 'string' ? agfField : agfField?._id;
        agfNome = normAgfName(agfIdToNome.get(agfId || '') || agfNome);
      }
      if (!ano || !mes) continue;

      const entry = ensure(ano, mes, agfNome);

      // Categoria pode ser ID, objeto ou texto
      let nomeCategoria = '';
      const c = (sc as any).Categoria;
      if (c) {
        if (typeof c === 'string') nomeCategoria = catIdToNome.get(c) || '';
        else if (typeof c === 'object') {
          nomeCategoria = (c as any).Categoria || (c as any).Nome || (c as any).name || (c as any).nome || '';
        } else if (typeof c === 'number') {
          nomeCategoria = String(c);
        }
      }
      const descricao = (sc as any).Descrição ?? (sc as any).descricao ?? '';
      let categoria = normalizeCategoriaFromMeta(nomeCategoria, descricao, typeof c === 'string' ? c : undefined);

      if (!(['aluguel','comissoes','extras','honorarios','impostos','pitney','telefone','veiculos','folha_pagamento'] as const).includes(categoria as any)) {
        categoria = 'extras';
      }

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

    return NextResponse.json({
      agfs,
      categoriasDespesa,
      dados
    });
  } catch (e: any) {
    console.error('Erro na API:', e);
    return NextResponse.json({ error: e.message || 'Erro Interno do Servidor' }, { status: 500 });
  }
}
