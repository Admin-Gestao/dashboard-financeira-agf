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

// normaliza categorias das SubContas para chaves fixas do front
function normalizeCategoriaFromMeta(nomeCat: string, descricao: string, categoriaId?: string): string {
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

  // Heurísticas por nome
  if (s.includes('alug')) return 'aluguel';
  if (s.includes('comis')) return 'comissoes';
  if (s.includes('honor')) return 'honorarios';
  if (s.includes('pitney')) return 'pitney';
  if (s.includes('telef')) return 'telefone';
  if (s.includes('veic')) return 'veiculos';
  if (s.includes('impost') || s === 'pis' || s === 'cofins' || s === 'irrf' || s.includes('iss')) return 'impostos';
  if (s.includes('folha') || s.includes('pgto') || s.includes('pagament')) return 'folha_pagamento';
  if (s.includes('extra')) return 'extras';

  // Se o nome da categoria veio vazio/inesperado, tenta pela descrição
  const d = (descricao || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if (/(pis|cofins|irrf|iss)/.test(d)) return 'impostos';
  if (/(uber|post[oa]|estaciona|motoboy|pedag|sem parar|km|combust)/.test(d)) return 'veiculos';
  if (/(vivo|claro|america\s*net|telefonica|tim|oi|celular|fixo)/.test(d)) return 'telefone';
  if (/(pitney|loca[çc][aã]o|manuten|tinta|material|servic)/.test(d)) return 'pitney';
  if (/(dr|doutor|m[ée]dico|advog|contab)/.test(d)) return 'honorarios';
  if (/(omega|unifisa|ewd|emilio|ghisso|comiss)/.test(d)) return 'comissoes';
  if (/(aluguel|shopping)/.test(d)) return 'aluguel';

  // fallback
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

    // 2) Lançamentos Mensais (fonte oficial)
    const lmCons = constraints([{ key: 'Empresa Mãe', constraint_type: 'equals', value: empresaId }]);
    const lmRes = await bubbleGet<{
      _id: string;
      Ano: any;
      Mês: any;
      AGF: string | { _id: string };
      total_receita?: number;
      total_despesa?: number;
      resultado_final?: number;
      Data?: string;
    }>(`/api/1.1/obj/${enc('LançamentoMensal')}?limit=1000&constraints=${lmCons}`);

    const lmIndex = new Map<string, { ano: number; mes: number; agfId?: string; agfNome: string }>();
    for (const lm of lmRes.response.results) {
      const ano = parseAno((lm as any).Ano) || parseAno((lm as any).Data?.split('/')[1]);
      const mes = parseMes((lm as any).Mês) || Number((lm as any).Data?.split('/')[0]);
      const agfId = typeof lm.AGF === 'string' ? lm.AGF : (lm.AGF as any)?._id;
      const agfNome = agfIdToNome.get(agfId || '') || agfId || 'AGF';
      if (lm._id) lmIndex.set(lm._id, { ano, mes, agfId, agfNome });
    }
    const lmIds = Array.from(lmIndex.keys());

    // 3) Categorias (id -> nome) — pega o máximo possível
    const catRes = await bubbleGet<{ _id: string; Categoria?: string; Nome?: string; name?: string; nome?: string; Descrição?: string; descricao?: string }>(
      `/api/1.1/obj/${enc('Categoria Despesa')}?limit=2000`
    );
    const catIdToNome = new Map<string, string>(
      catRes.response.results.map(c => {
        const nome =
          (c as any).Categoria || (c as any).Nome || (c as any).name || (c as any).nome ||
          (c as any).Descrição || (c as any).descricao || '';
        return [c._id, String(nome)] as const;
      })
    );

    // 4) SubContas (detalhe das despesas por categoria)
    const scCons = constraints([{ key: 'AGF', constraint_type: 'in', value: agfIds }]);
    const scRes = await bubbleGet<{
      _id: string;
      AGF: string | { _id: string };
      'LançamentoMesnal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      'LançamentoMensal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      'Lançamento Mensal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      Categoria?: any;
      Valor: number | string;
      Descrição?: string;
      descricao?: string;
    }>(`/api/1.1/obj/${enc('Despesa (SubConta)')}?limit=5000&constraints=${scCons}`);

    // (4b) Se aparecerem IDs de categoria que não vieram na listagem, busca 1-a-1
    const missingCatIds = Array.from(new Set(
      scRes.response.results
        .map(sc => (typeof (sc as any).Categoria === 'string' ? (sc as any).Categoria : null))
        .filter((id): id is string => !!id && !catIdToNome.has(id))
    ));
    for (const cid of missingCatIds) {
      try {
        const single = await bubbleGet<{ _id: string; Categoria?: string; Nome?: string; name?: string; nome?: string }>(
          `/api/1.1/obj/${enc('Categoria Despesa')}/${enc(cid)}`
        );
        const item = single.response.results?.[0] as any;
        const nome = item?.Categoria || item?.Nome || item?.name || item?.nome || '';
        if (nome) catIdToNome.set(cid, String(nome));
      } catch {
        /* ignora falha individual */
      }
    }

    // 5) Balancete (objetos) – somente "Total"
    const balCons = constraints([
      { key: 'Lançamento Mensal', constraint_type: 'in', value: lmIds },
      { key: 'Tipo de objeto',    constraint_type: 'equals', value: 'Total' },
    ]);
    const balRes = await bubbleGet<{
      _id: string;
      'Lançamento Mensal'?: string | { _id: string; Ano?: any; Mês?: any; AGF?: any };
      Quantidade?: number | string;
    }>(`/api/1.1/obj/${enc('Balancete')}?limit=2000&constraints=${balCons}`);

    // -------- AGREGAÇÃO --------
    const categoriasDespesa = [
      'aluguel','comissoes','extras','honorarios','impostos','pitney','telefone','veiculos','folha_pagamento'
    ];

    const dados: Record<number, Record<number, Record<string, {
      receita: number;              // total_receita LM
      objetos: number;             // balancete
      despesa_total: number;       // total_despesa LM
      despesas: Record<string, number>; // soma das SubContas por categoria
      despesa_subcontas_total?: number; // informativo
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

    // 5.1) LM -> receita e despesa (oficiais)
    for (const lm of lmRes.response.results) {
      const meta = lmIndex.get(lm._id);
      if (!meta) continue;
      const { ano, mes, agfNome } = meta;
      if (!ano || !mes) continue;

      const entry = ensure(ano, mes, agfNome);
      entry.receita       += Number((lm as any).total_receita || 0);
      entry.despesa_total += Number((lm as any).total_despesa || 0);
    }

    // 5.2) Objetos (Balancete – somente "Total")
    for (const b of balRes.response.results) {
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

    // 5.3) Despesas por categoria (SubContas)
    for (const sc of scRes.response.results) {
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

      // se vier AGF direto na SubConta, sobrescreve
      if ((sc as any).AGF) {
        const agfField = (sc as any).AGF;
        const agfId = typeof agfField === 'string' ? agfField : agfField?._id;
        agfNome = agfIdToNome.get(agfId || '') || agfNome;
      }
      if (!ano || !mes) continue;

      const entry = ensure(ano, mes, agfNome);

      // Categoria pode ser ID, texto ou objeto
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
          for (const c of categoriasDespesa) d.despesas[c] = Number(d.despesas[c] || 0);
          d.despesa_subcontas_total = Number(d.despesa_subcontas_total || 0);
        }
      }
    }

    return NextResponse.json({ agfs, categoriasDespesa, dados });
  } catch (e: any) {
    console.error('Erro na API:', e);
    return NextResponse.json({ error: e.message || 'Erro Interno do Servidor' }, { status: 500 });
  }
}
