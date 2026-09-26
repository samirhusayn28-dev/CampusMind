import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { useThemeStore } from '../store/useThemeStore';
import { spacing, borderRadius } from '../theme/spacing';
import { typography } from '../theme/typography';

interface RichMarkdownProps {
  content: string;
  isUser?: boolean;
  language?: string;
}

// -------------------------------------------------------------
// LaTeX Math Normalizer: converts raw LaTeX macros to readable symbols
// -------------------------------------------------------------
function normalizeMathFormula(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\times/g, '×')
    .replace(/\\cdot/g, '·')
    .replace(/\\le(q)?/g, '≤')
    .replace(/\\ge(q)?/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\pm/g, '±')
    .replace(/\\in/g, '∈')
    .replace(/\\infty/g, '∞')
    .replace(/\\sum/g, '∑')
    .replace(/\\prod/g, '∏')
    .replace(/\\partial/g, '∂')
    .replace(/\\nabla/g, '∇')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathbf\{([^}]+)\}/g, '$1')
    .replace(/\\math(it|rm|sf)\{([^}]+)\}/g, '$2')
    .replace(/\\quad/g, '   ')
    .replace(/\\,/g, ' ')
    .replace(/\\left[([{|]/g, '')
    .replace(/\\right[)\]}|]/g, '')
    .replace(/\\\\/g, '\n')
    .trim();
}

// -------------------------------------------------------------
// Inline Tokenizer & Formatter
// -------------------------------------------------------------
interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'boldItalic' | 'code' | 'strike' | 'link';
  text: string;
  url?: string;
}

function tokenizeInline(text: string): InlineToken[] {
  // Convert HTML line breaks to real newlines
  const cleaned = text.replace(/<br\s*\/?>/gi, '\n');

  // Match: ***bold-italic***, **bold**, *italic*, `code`, ~~strike~~, [text](url)
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+\*(?!\*)|(?<!_)_[^_]+_(?!_)|`[^`]+`|~~[^~]+~~|\[([^\]]+)\]\(([^)]+)\))/g;

  const tokens: InlineToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', text: cleaned.slice(lastIndex, match.index) });
    }

    const tokenStr = match[0];

    if (tokenStr.startsWith('***') && tokenStr.endsWith('***')) {
      tokens.push({ type: 'boldItalic', text: tokenStr.slice(3, -3) });
    } else if ((tokenStr.startsWith('**') && tokenStr.endsWith('**')) || (tokenStr.startsWith('__') && tokenStr.endsWith('__'))) {
      tokens.push({ type: 'bold', text: tokenStr.slice(2, -2) });
    } else if (tokenStr.startsWith('`') && tokenStr.endsWith('`')) {
      tokens.push({ type: 'code', text: tokenStr.slice(1, -1) });
    } else if (tokenStr.startsWith('~~') && tokenStr.endsWith('~~')) {
      tokens.push({ type: 'strike', text: tokenStr.slice(2, -2) });
    } else if ((tokenStr.startsWith('*') && tokenStr.endsWith('*')) || (tokenStr.startsWith('_') && tokenStr.endsWith('_'))) {
      tokens.push({ type: 'italic', text: tokenStr.slice(1, -1) });
    } else if (tokenStr.startsWith('[') && tokenStr.includes('](')) {
      tokens.push({
        type: 'link',
        text: match[2] || 'link',
        url: match[3],
      });
    } else {
      tokens.push({ type: 'text', text: tokenStr });
    }

    lastIndex = match.index + tokenStr.length;
  }

  if (lastIndex < cleaned.length) {
    tokens.push({ type: 'text', text: cleaned.slice(lastIndex) });
  }

  return tokens;
}

// Inline Text Renderer component
export const InlineFormattedText: React.FC<{
  text: string;
  color?: string;
  isUser?: boolean;
  style?: any;
}> = ({ text, color, isUser = false, style }) => {
  const { colors } = useThemeStore();
  const tokens = useMemo(() => tokenizeInline(text), [text]);
  const defaultTextColor = color || (isUser ? colors.onPrimary : colors.textPrimary);

  return (
    <Text style={style}>
      {tokens.map((token, idx) => {
        switch (token.type) {
          case 'boldItalic':
            return (
              <Text
                key={idx}
                style={{
                  fontWeight: '700',
                  fontStyle: 'italic',
                  color: defaultTextColor,
                }}
              >
                {token.text}
              </Text>
            );
          case 'bold':
            return (
              <Text
                key={idx}
                style={{
                  fontWeight: '700',
                  color: isUser ? colors.onPrimary : colors.textPrimary,
                }}
              >
                {token.text}
              </Text>
            );
          case 'italic':
            return (
              <Text
                key={idx}
                style={{
                  fontStyle: 'italic',
                  color: defaultTextColor,
                }}
              >
                {token.text}
              </Text>
            );
          case 'strike':
            return (
              <Text
                key={idx}
                style={{
                  textDecorationLine: 'line-through',
                  color: isUser ? 'rgba(255,255,255,0.7)' : colors.textTertiary,
                }}
              >
                {token.text}
              </Text>
            );
          case 'code':
            return (
              <Text
                key={idx}
                style={[
                  styles.inlineCode,
                  {
                    backgroundColor: isUser ? 'rgba(0,0,0,0.18)' : colors.surfaceSubtle,
                    color: isUser ? colors.onPrimary : colors.primary,
                    borderColor: isUser ? 'rgba(255,255,255,0.2)' : colors.borderSubtle,
                  },
                ]}
              >
                {` ${token.text} `}
              </Text>
            );
          case 'link':
            return (
              <Text
                key={idx}
                style={[
                  styles.linkText,
                  { color: isUser ? colors.onPrimary : colors.primary },
                ]}
                onPress={() => {
                  if (token.url) {
                    Linking.openURL(token.url).catch(() => {});
                  }
                }}
              >
                {token.text}
              </Text>
            );
          case 'text':
          default:
            return (
              <Text key={idx} style={{ color: defaultTextColor }}>
                {token.text}
              </Text>
            );
        }
      })}
    </Text>
  );
};

// -------------------------------------------------------------
// Block Tokenizer: breaks markdown into structured block elements
// -------------------------------------------------------------
export type MarkdownBlock =
  | { type: 'heading'; level: number; text: string }
  | {
      type: 'table';
      headers: string[];
      alignments: ('left' | 'center' | 'right')[];
      rows: string[][];
    }
  | { type: 'code_block'; language: string; code: string }
  | { type: 'math_block'; formula: string }
  | { type: 'blockquote'; text: string }
  | { type: 'list'; items: { bullet: string; text: string; isOrdered: boolean }[] }
  | { type: 'paragraph'; text: string };

export function parseMarkdownBlocks(rawContent: string): MarkdownBlock[] {
  if (!rawContent) return [];

  // Normalize line endings and preprocess <br> tags
  const content = rawContent
    .replace(/\r\n/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  const blocks: MarkdownBlock[] = [];
  const lines = content.split('\n');
  let i = 0;

  const isTableLine = (l: string) => {
    const t = l.trim();
    return t.startsWith('|') && t.endsWith('|') && t.split('|').length >= 3;
  };

  while (i < lines.length) {
    const line = lines[i];

    // 1. Code Block (``` ... ```)
    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({
        type: 'code_block',
        language: language || 'code',
        code: codeLines.join('\n'),
      });
      continue;
    }

    // 2. Math Block ($$ ... $$ or \[ ... \])
    if (line.trim().startsWith('$$') || line.trim().startsWith('\\[')) {
      const isBracket = line.trim().startsWith('\\[');
      const closeDelim = isBracket ? '\\]' : '$$';
      const openDelim = isBracket ? '\\[' : '$$';

      const trimmed = line.trim();
      if (
        trimmed.length > openDelim.length &&
        trimmed.endsWith(closeDelim) &&
        trimmed !== openDelim
      ) {
        const formula = trimmed.slice(openDelim.length, -closeDelim.length).trim();
        blocks.push({ type: 'math_block', formula: normalizeMathFormula(formula) });
        i++;
        continue;
      }

      const mathLines: string[] = [];
      const remainder = trimmed.slice(openDelim.length).trim();
      if (remainder) mathLines.push(remainder);
      i++;
      while (i < lines.length && !lines[i].trim().endsWith(closeDelim)) {
        mathLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        const last = lines[i].trim().replace(new RegExp(`${closeDelim}$`), '').trim();
        if (last) mathLines.push(last);
        i++;
      }
      blocks.push({
        type: 'math_block',
        formula: normalizeMathFormula(mathLines.join('\n')),
      });
      continue;
    }

    // 3. Table (| Col 1 | Col 2 | \n | --- | --- |)
    if (isTableLine(line) && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      const isSep = /^\|?(\s*:?-+:?\s*\|)+\s*$/.test(nextLine);

      if (isSep) {
        const headers = line
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());

        const sepCells = nextLine
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());

        const alignments = sepCells.map((s) => {
          if (s.startsWith(':') && s.endsWith(':')) return 'center' as const;
          if (s.endsWith(':')) return 'right' as const;
          return 'left' as const;
        });

        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && isTableLine(lines[i])) {
          const cells = lines[i]
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());
          rows.push(cells);
          i++;
        }

        blocks.push({
          type: 'table',
          headers,
          alignments,
          rows,
        });
        continue;
      }
    }

    // 4. Headings (# to ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      i++;
      continue;
    }

    // 5. Blockquote (> ...)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [line.trim().replace(/^>\s*/, '')];
      i++;
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s*/, ''));
        i++;
      }
      blocks.push({
        type: 'blockquote',
        text: quoteLines.join('\n'),
      });
      continue;
    }

    // 6. Lists (bullet and numbered)
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const items = [
        {
          bullet: listMatch[2],
          text: listMatch[3],
          isOrdered: /\d+\./.test(listMatch[2]),
        },
      ];
      i++;
      while (i < lines.length) {
        const nextMatch = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (nextMatch) {
          items.push({
            bullet: nextMatch[2],
            text: nextMatch[3],
            isOrdered: /\d+\./.test(nextMatch[2]),
          });
          i++;
        } else break;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    // 7. Paragraph (normal text lines)
    if (line.trim().length > 0) {
      const paraLines = [line];
      i++;
      while (
        i < lines.length &&
        lines[i].trim().length > 0 &&
        !lines[i].trim().startsWith('#') &&
        !lines[i].trim().startsWith('```') &&
        !lines[i].trim().startsWith('$$') &&
        !lines[i].trim().startsWith('\\[') &&
        !lines[i].trim().startsWith('>') &&
        !isTableLine(lines[i]) &&
        !lines[i].match(/^(\s*)([-*+]|\d+\.)\s+/)
      ) {
        paraLines.push(lines[i]);
        i++;
      }
      blocks.push({
        type: 'paragraph',
        text: paraLines.join('\n'),
      });
      continue;
    }

    i++;
  }

  return blocks;
}

// -------------------------------------------------------------
// Visual Table Component with Horizontal Scroll & Zebra Striping
// -------------------------------------------------------------
interface MarkdownTableProps {
  headers: string[];
  alignments: ('left' | 'center' | 'right')[];
  rows: string[][];
  isUser?: boolean;
}

const MarkdownTable: React.FC<MarkdownTableProps> = ({
  headers,
  alignments,
  rows,
  isUser = false,
}) => {
  const { colors, isDark } = useThemeStore();

  // Dynamic min width based on longest header/cell to prevent awkward word wraps
  const getColMinWidth = (colIdx: number) => {
    let maxLen = (headers[colIdx] || '').length;
    for (const r of rows) {
      const cellLen = (r[colIdx] || '').length;
      if (cellLen > maxLen) maxLen = cellLen;
    }
    if (maxLen > 30) return 160;
    if (maxLen > 18) return 130;
    return 95;
  };

  const borderColor = isUser ? 'rgba(255,255,255,0.25)' : colors.borderSubtle;
  const headerBg = isUser ? 'rgba(0,0,0,0.18)' : colors.surfaceSubtle;
  const evenRowBg = isUser ? 'rgba(255,255,255,0.06)' : colors.surface;
  const oddRowBg = isUser
    ? 'rgba(0,0,0,0.08)'
    : isDark
    ? 'rgba(255,255,255,0.03)'
    : colors.surfaceSubtle;

  return (
    <View style={[styles.tableContainer, { borderColor }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Header Row */}
          <View style={[styles.tableHeaderRow, { backgroundColor: headerBg, borderBottomColor: borderColor }]}>
            {headers.map((h, colIdx) => {
              const align = alignments[colIdx] || 'left';
              const minWidth = getColMinWidth(colIdx);
              return (
                <View
                  key={`th_${colIdx}`}
                  style={[
                    styles.tableCellWrapper,
                    {
                      minWidth,
                      alignItems:
                        align === 'center'
                          ? 'center'
                          : align === 'right'
                          ? 'flex-end'
                          : 'flex-start',
                      borderRightColor:
                        colIdx === headers.length - 1 ? 'transparent' : borderColor,
                      borderRightWidth: colIdx === headers.length - 1 ? 0 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tableHeaderText,
                      {
                        color: isUser ? colors.onPrimary : colors.textPrimary,
                        textAlign: align,
                      },
                    ]}
                  >
                    {h}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Table Body Rows */}
          {rows.map((row, rowIdx) => {
            const rowBg = rowIdx % 2 === 0 ? evenRowBg : oddRowBg;
            const isLastRow = rowIdx === rows.length - 1;

            return (
              <View
                key={`tr_${rowIdx}`}
                style={[
                  styles.tableDataRow,
                  {
                    backgroundColor: rowBg,
                    borderBottomColor: borderColor,
                    borderBottomWidth: isLastRow ? 0 : 1,
                  },
                ]}
              >
                {headers.map((_, colIdx) => {
                  const cellText = row[colIdx] || '';
                  const align = alignments[colIdx] || 'left';
                  const minWidth = getColMinWidth(colIdx);

                  return (
                    <View
                      key={`td_${rowIdx}_${colIdx}`}
                      style={[
                        styles.tableCellWrapper,
                        {
                          minWidth,
                          alignItems:
                            align === 'center'
                              ? 'center'
                              : align === 'right'
                              ? 'flex-end'
                              : 'flex-start',
                          borderRightColor:
                            colIdx === headers.length - 1 ? 'transparent' : borderColor,
                          borderRightWidth: colIdx === headers.length - 1 ? 0 : 1,
                        },
                      ]}
                    >
                      <InlineFormattedText
                        text={cellText}
                        isUser={isUser}
                        style={[
                          styles.tableCellText,
                          {
                            color: isUser ? colors.onPrimary : colors.textPrimary,
                            textAlign: align,
                          },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

// -------------------------------------------------------------
// Main RichMarkdown Component
// -------------------------------------------------------------
export const RichMarkdown: React.FC<RichMarkdownProps> = ({
  content,
  isUser = false,
  language = 'en',
}) => {
  const { colors, isDark } = useThemeStore();
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);
  const isUrdu = language === 'urdu';

  return (
    <View style={styles.richRoot}>
      {blocks.map((block, index) => {
        const key = `block_${index}`;

        switch (block.type) {
          case 'heading': {
            const isH1 = block.level === 1;
            const isH2 = block.level === 2;
            const isH3 = block.level === 3;

            return (
              <View
                key={key}
                style={[
                  styles.headingWrapper,
                  {
                    marginTop: index === 0 ? 0 : isH1 ? 14 : isH2 ? 12 : 8,
                    marginBottom: 4,
                  },
                ]}
              >
                <InlineFormattedText
                  text={block.text}
                  isUser={isUser}
                  style={[
                    isH1
                      ? styles.h1
                      : isH2
                      ? styles.h2
                      : isH3
                      ? styles.h3
                      : styles.h4,
                    {
                      color: isUser ? colors.onPrimary : colors.textPrimary,
                      textAlign: isUrdu ? 'right' : 'left',
                    },
                  ]}
                />
              </View>
            );
          }

          case 'table':
            return (
              <View key={key} style={styles.blockSpacing}>
                <MarkdownTable
                  headers={block.headers}
                  alignments={block.alignments}
                  rows={block.rows}
                  isUser={isUser}
                />
              </View>
            );

          case 'math_block':
            return (
              <View
                key={key}
                style={[
                  styles.mathCard,
                  {
                    backgroundColor: isUser ? 'rgba(0,0,0,0.18)' : colors.surfaceSubtle,
                    borderColor: isUser ? 'rgba(255,255,255,0.2)' : colors.borderSubtle,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.mathFormulaText,
                    { color: isUser ? colors.onPrimary : colors.primary },
                  ]}
                  selectable
                >
                  {block.formula}
                </Text>
              </View>
            );

          case 'code_block':
            return (
              <View
                key={key}
                style={[
                  styles.codeBlockCard,
                  {
                    backgroundColor: isDark ? '#111311' : '#1E2320',
                    borderColor: colors.borderSubtle,
                  },
                ]}
              >
                {block.language && block.language !== 'code' && (
                  <View style={styles.codeHeader}>
                    <Text style={styles.codeLangText}>{block.language.toUpperCase()}</Text>
                  </View>
                )}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Text style={styles.codeBlockText} selectable>
                    {block.code}
                  </Text>
                </ScrollView>
              </View>
            );

          case 'blockquote':
            return (
              <View
                key={key}
                style={[
                  styles.blockquoteCard,
                  {
                    borderLeftColor: isUser ? colors.onPrimary : colors.primary,
                    backgroundColor: isUser ? 'rgba(0,0,0,0.12)' : colors.surfaceSubtle,
                  },
                ]}
              >
                <InlineFormattedText
                  text={block.text}
                  isUser={isUser}
                  style={[
                    styles.blockquoteText,
                    {
                      color: isUser ? colors.onPrimary : colors.textSecondary,
                      textAlign: isUrdu ? 'right' : 'left',
                    },
                  ]}
                />
              </View>
            );

          case 'list':
            return (
              <View key={key} style={styles.listContainer}>
                {block.items.map((item, itemIdx) => (
                  <View key={`li_${itemIdx}`} style={styles.listItemRow}>
                    <Text
                      style={[
                        styles.bulletPoint,
                        {
                          color: isUser ? colors.onPrimary : colors.primary,
                          fontWeight: item.isOrdered ? '700' : '900',
                          minWidth: item.isOrdered ? 20 : 12,
                        },
                      ]}
                    >
                      {item.isOrdered ? item.bullet : '•'}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <InlineFormattedText
                        text={item.text}
                        isUser={isUser}
                        style={[
                          styles.paragraphText,
                          {
                            color: isUser ? colors.onPrimary : colors.textPrimary,
                            textAlign: isUrdu ? 'right' : 'left',
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            );

          case 'paragraph':
          default:
            return (
              <View key={key} style={styles.paragraphWrapper}>
                <InlineFormattedText
                  text={block.text}
                  isUser={isUser}
                  style={[
                    styles.paragraphText,
                    {
                      color: isUser ? colors.onPrimary : colors.textPrimary,
                      textAlign: isUrdu ? 'right' : 'left',
                    },
                  ]}
                />
              </View>
            );
        }
      })}
    </View>
  );
};

// -------------------------------------------------------------
// Stylesheet
// -------------------------------------------------------------
const styles = StyleSheet.create({
  richRoot: {
    width: '100%',
  },
  headingWrapper: {
    width: '100%',
  },
  h1: {
    ...typography.presets.headline,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
  },
  h2: {
    ...typography.presets.titleMedium,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  h3: {
    ...typography.presets.labelLarge,
    fontSize: 14.5,
    fontWeight: '700',
    lineHeight: 20,
  },
  h4: {
    ...typography.presets.labelMedium,
    fontSize: 13.5,
    fontWeight: '700',
  },
  paragraphWrapper: {
    marginVertical: 3,
  },
  paragraphText: {
    ...typography.presets.bodyMedium,
    fontSize: 14,
    lineHeight: 21,
  },
  blockSpacing: {
    marginVertical: 6,
  },
  inlineCode: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12.5,
    fontWeight: '600',
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  linkText: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  // Table Styles
  tableContainer: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tableDataRow: {
    flexDirection: 'row',
  },
  tableCellWrapper: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  tableHeaderText: {
    ...typography.presets.labelMedium,
    fontWeight: '700',
    fontSize: 12.5,
  },
  tableCellText: {
    ...typography.presets.bodySmall,
    fontSize: 12.5,
    lineHeight: 18,
  },
  // Math Card
  mathCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mathFormulaText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 13.5,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Code Block
  codeBlockCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginVertical: 6,
  },
  codeHeader: {
    marginBottom: 6,
  },
  codeLangText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#8A9188',
    letterSpacing: 0.8,
  },
  codeBlockText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: 12.5,
    color: '#E2EDE4',
    lineHeight: 19,
  },
  // Blockquote
  blockquoteCard: {
    borderLeftWidth: 3.5,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 5,
  },
  blockquoteText: {
    fontStyle: 'italic',
    fontSize: 13.5,
    lineHeight: 20,
  },
  // List
  listContainer: {
    marginVertical: 4,
    gap: 3,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 21,
  },
});
