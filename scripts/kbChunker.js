import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const HEADING_RE = /^(\d+(?:\.\d+)*)\.\s+(.+)$/;
const FAQ_QUESTION_RE = /^В:\s*(.+)$/m;
const FAQ_ANSWER_RE = /^О:\s*([\s\S]+)$/m;

const MAX_CHUNK_CHARS = 1800;
const SPLITTER = new RecursiveCharacterTextSplitter({
  chunkSize: 900,
  chunkOverlap: 120,
});

/**
 * @param {string} text
 * @returns {Array<{ content: string, metadata: Record<string, string> }>}
 */
export async function chunkKnowledgeBaseText(text) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').trim();
  const lines = normalized.split('\n');

  const blocks = [];
  let current = { heading: null, headingNum: null, lines: [] };

  const flushBlock = () => {
    if (current.lines.length === 0 && !current.heading) return;
    blocks.push({
      heading: current.heading,
      headingNum: current.headingNum,
      text: current.lines.join('\n').trim(),
    });
    current = { heading: null, headingNum: null, lines: [] };
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      flushBlock();
      current.headingNum = headingMatch[1];
      current.heading = line;
      continue;
    }

    current.lines.push(line);
  }
  flushBlock();

  const chunks = [];

  for (const block of blocks) {
    const section = block.heading ?? '';
    const sectionNum = block.headingNum ?? '';
    const isFaqSection = sectionNum.startsWith('4') || /^4\./.test(section);

    if (isFaqSection && block.text.includes('В:')) {
      chunks.push(...splitFaqBlock(block.text, section, sectionNum));
      continue;
    }

    if (!block.text) continue;

    const baseMeta = buildMetadata(section, sectionNum, block.text);
    const pieces =
      block.text.length > MAX_CHUNK_CHARS
        ? await SPLITTER.splitText(block.text)
        : [block.text];

    for (const piece of pieces) {
      chunks.push({
        content: piece.trim(),
        metadata: { ...baseMeta },
      });
    }
  }

  return chunks.filter((c) => c.content.length > 30);
}

/**
 * @param {string} text
 * @param {string} section
 * @param {string} sectionNum
 */
function splitFaqBlock(text, section, sectionNum) {
  const parts = text.split(/(?=^В:\s)/m).map((p) => p.trim()).filter(Boolean);
  const result = [];

  for (const part of parts) {
    const qMatch = part.match(FAQ_QUESTION_RE);
    const aMatch = part.match(FAQ_ANSWER_RE);
    if (!qMatch) continue;

    const question = qMatch[1].trim();
    const answerBody = aMatch ? aMatch[1].trim() : part.replace(FAQ_QUESTION_RE, '').trim();
    const content = `В: ${question}\nО: ${answerBody}`;

    result.push({
      content,
      metadata: {
        ...buildMetadata(section, sectionNum, content),
        content_type: 'faq',
        question,
      },
    });
  }

  return result;
}

/**
 * @param {string} section
 * @param {string} sectionNum
 * @param {string} content
 */
function buildMetadata(section, sectionNum, content) {
  const subsection = section || '';
  const topSection = sectionNum.split('.')[0] ?? '';

  let content_type = 'general';
  if (topSection === '2') content_type = 'product';
  else if (topSection === '3') content_type = 'regulation';
  else if (topSection === '4') content_type = 'faq';
  else if (topSection === '5') content_type = 'limits';

  const lower = `${section} ${content}`.toLowerCase();
  if (/цен|стоим|оплат|₽|прайс/.test(lower)) {
    content_type = 'prices';
  }

  const category_tags = [];
  const tagRules = [
    ['family', /семейн|развод|алимент|брак/],
    ['labor', /трудов|увольн|зарплат|работодател/],
    ['realty', /недвижим|квартир|егрн|сделк/],
    ['debts', /долг|коллектор|займ|кредит/],
    ['business', /бизнес|ип|контрагент|договор/],
    ['inheritance', /наследств/],
  ];
  for (const [tag, re] of tagRules) {
    if (re.test(lower)) category_tags.push(tag);
  }

  return {
    section: mapTopSection(topSection),
    subsection,
    section_num: sectionNum,
    content_type,
    category_tags: category_tags.join(','),
  };
}

/** @param {string} num */
function mapTopSection(num) {
  const map = {
    '1': 'О компании',
    '2': 'Продукты и услуги',
    '3': 'Регламент',
    '4': 'FAQ',
    '5': 'Ограничения',
  };
  return map[num] ?? 'Общее';
}

/**
 * Текст для embedding (обогащённый заголовками).
 * @param {{ content: string, metadata: Record<string, string> }} chunk
 */
export function formatChunkForEmbedding(chunk) {
  const lines = ['Документ: Правовой компас — контекст компании'];
  if (chunk.metadata.section) lines.push(`Раздел: ${chunk.metadata.section}`);
  if (chunk.metadata.subsection) lines.push(`Подраздел: ${chunk.metadata.subsection}`);
  if (chunk.metadata.question) lines.push(`Вопрос: ${chunk.metadata.question}`);
  lines.push(chunk.content);
  return lines.join('\n');
}
