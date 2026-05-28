import React from 'react';

interface Props {
  html: string;
  className?: string;
  compact?: boolean;
}

function cleanHtml(html: string): string {
  // ── 1. Limpeza básica ────────────────────────────────────────────────────
  let result = html
    .replace(/<\/div>(\s*<br\s*\/?>[\s]*)+<div/gi, '</div><div')
    .replace(/<div([^>]*)>([\s]*<br\s*\/?>[\s]*)/gi, '<div$1>')
    .replace(/([\s]*<br\s*\/?>[\s]*)<\/div>/gi, '</div>')
    .replace(/<p>([\s\u00a0]|<br\s*\/?>)*<\/p>/gi, '')
    .replace(/<br\s*\/?>\s*<br\s*\/?>\s*/gi, '<div class="section-divider"></div>');

  // ── 2. DOM: detecta desc-label nos padrões de span ───────────────────────
  if (typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = result;

    container.querySelectorAll('[dir="auto"]').forEach(p => {
      // Padrão C: texto plano "-Label:<br>valor" (primeiro nó é texto + br)
      const firstChild = p.firstChild;
      if (firstChild?.nodeType === Node.TEXT_NODE) {
        const match = (firstChild.textContent ?? '').match(/^[-\u2013]?\s*([^:<>\n]{3,60}):\s*$/);
        if (match) {
          const labelSpan = document.createElement('span');
          labelSpan.className = 'desc-label';
          labelSpan.textContent = match[1].trim() + ':';
          p.replaceChild(labelSpan, firstChild);
          // Remove <br> separador e garante espaço antes do valor
          const nextNode = labelSpan.nextSibling;
          if (nextNode && (nextNode as Element).tagName?.toLowerCase() === 'br') {
            nextNode.remove();
            const afterBr = labelSpan.nextSibling;
            if (afterBr?.nodeType === Node.TEXT_NODE) {
              (afterBr as Text).textContent = ' ' + ((afterBr as Text).textContent ?? '').replace(/^\s+/, '');
            } else {
              p.insertBefore(document.createTextNode(' '), labelSpan.nextSibling);
            }
          }
          return;
        }
      }

      // Padrões A/B: baseados em spans
      const spans = Array.from(p.querySelectorAll(':scope > span'));
      if (spans.length < 1) return;
      const firstSpan = spans[0] as HTMLElement;
      const firstText = firstSpan.textContent || '';

      // Só aplica se o span está no início do <p> (sem conteúdo relevante antes)
      const noTextBefore = !firstSpan.previousSibling ||
        (firstSpan.previousSibling.nodeType === Node.TEXT_NODE &&
         !(firstSpan.previousSibling.textContent ?? '').trim());
      if (!noTextBefore) return;

      // Padrão A: span termina com ":"  ex: <span>Técnico: </span>
      if (/^[^:<>]{3,60}:\s*$/.test(firstText.trim())) {
        firstSpan.classList.add('desc-label');
      }
      // Padrão B: rótulo num span, ":" no seguinte ex: <span>Título</span><span>: </span>
      else if (
        spans.length >= 2 &&
        /^[^:<>]{3,60}$/.test(firstText.trim()) &&
        /^:\s*/.test(spans[1].textContent || '')
      ) {
        const labelSpan = document.createElement('span');
        labelSpan.className = 'desc-label';
        labelSpan.textContent = firstText.trim() + ':';
        (spans[1] as HTMLElement).textContent =
          (spans[1].textContent || '').replace(/^:\s*/, ' ');
        p.replaceChild(labelSpan, firstSpan);
      }
    });

    // Fallback ampliado: qualquer <span> que pareça rótulo e inicie visualmente uma linha
    // (cobre spans dentro de <strong>, <em>, ou quando o pai não é p/div direto)
    const blockTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br', 'hr']);
    container.querySelectorAll('span').forEach(span => {
      if (span.classList.contains('desc-label')) return;
      const text = (span.textContent ?? '').trim();
      if (!/^[^:<>]{3,60}:\s*$/.test(text)) return;
      const prev = span.previousSibling;
      const isLineStart =
        !prev ||
        (prev.nodeType === Node.TEXT_NODE && !(prev.textContent ?? '').trim()) ||
        (prev.nodeType === Node.ELEMENT_NODE && blockTags.has((prev as Element).tagName.toLowerCase()));
      if (isLineStart) span.classList.add('desc-label');
    });

    // 2b. Mescla <p> consecutivos que são continuação de frase.
    //     Repete até estabilizar (ex.: vírgula isolada + espaço + texto).
    let mergeHappened = true;
    while (mergeHappened) {
      mergeHappened = false;
      const allPs = Array.from(container.querySelectorAll('p'));
      for (let i = allPs.length - 1; i >= 1; i--) {
        const curr = allPs[i] as HTMLElement;
        if (!curr.parentNode) continue; // já foi removido nesta passagem
        const prev = curr.previousElementSibling as HTMLElement | null;
        if (!prev || prev.tagName.toLowerCase() !== 'p') continue;

        const prevText = (prev.textContent ?? '').trimEnd();
        const currText = curr.textContent ?? '';

        const shouldMerge =
          /[,;]$/.test(prevText) ||        // termina no meio da frase
          /^[\s\u00a0]/.test(currText) ||  // começa com espaço (continuação)
          /^[,;]/.test(currText);           // vírgula/ponto foi parar no início do próximo

        if (shouldMerge) {
          if (!/[\s\u00a0]$/.test(prevText) && !/^[\s\u00a0,;]/.test(currText)) {
            prev.appendChild(document.createTextNode(' '));
          }
          while (curr.firstChild) prev.appendChild(curr.firstChild);
          curr.remove();
          mergeHappened = true;
        }
      }
    }

    // 2c. Mescla div[dir="auto"] consecutivos da mesma linha/parágrafo.
    //     Usa nós de texto para detectar linha em branco (separador real de parágrafo).
    const allDivs = Array.from(container.querySelectorAll('div[dir="auto"]'));
    for (let i = allDivs.length - 1; i >= 1; i--) {
      const curr = allDivs[i] as HTMLElement;
      if (!curr.parentNode) continue; // já foi removido nesta passagem
      if (curr.querySelector('.desc-label')) continue;
      if (!(curr.textContent ?? '').trim()) continue;

      // Novo campo com "Rótulo: valor" → é início de nova seção, não continuação
      const currFirstText = (curr.textContent ?? '').trimStart();
      if (/^[^:<>]{1,60}:(?!\/\/)/.test(currFirstText)) continue;

      const prev = curr.previousElementSibling as HTMLElement | null;
      if (!prev || prev.tagName.toLowerCase() !== 'div' || prev.getAttribute('dir') !== 'auto') continue;

      // Não mescla se há linha em branco (\n\n) entre os dois elementos
      let hasBlankLine = false;
      let node: Node | null = prev.nextSibling;
      while (node && node !== curr) {
        if (node.nodeType === Node.TEXT_NODE && /\n[ \t]*\n/.test(node.textContent ?? '')) {
          hasBlankLine = true;
          break;
        }
        node = node.nextSibling;
      }
      if (hasBlankLine) continue;

      // Só mescla se é claramente uma continuação de frase:
      //   - começa com letra minúscula  → continuação direta
      //   - começa com espaço/nbsp     → linha foi quebrada antes do texto
      //   - começa com vírgula/ponto   → pontuação foi parar no próximo div
      const currText = curr.textContent ?? '';
      const firstChar = currFirstText.charAt(0);
      const isContinuation =
        /^[\s\u00a0]/.test(currText) ||
        /^[,;]/.test(currFirstText) ||
        (firstChar === firstChar.toLowerCase() && firstChar !== firstChar.toUpperCase());

      if (!isContinuation) continue;

      const prevText = (prev.textContent ?? '').trimEnd();
      if (!/[\s\u00a0]$/.test(prevText) && !/^[\s\u00a0]/.test(currText)) {
        prev.appendChild(document.createTextNode(' '));
      }
      while (curr.firstChild) prev.appendChild(curr.firstChild);
      curr.remove();
    }

    // 2d. Links: target="_blank" em <a> existentes + auto-link URLs em texto puro
    container.querySelectorAll('a[href]').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });

    const urlRe = /https?:\/\/[^\s<>"']+/g;
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let wNode: Node | null;
    while ((wNode = walker.nextNode())) {
      // Ignora texto dentro de <a>
      let parent = (wNode as Text).parentElement;
      let insideAnchor = false;
      while (parent && parent !== container) {
        if (parent.tagName.toLowerCase() === 'a') { insideAnchor = true; break; }
        parent = parent.parentElement;
      }
      if (!insideAnchor && urlRe.test(wNode.textContent ?? '')) textNodes.push(wNode as Text);
      urlRe.lastIndex = 0;
    }
    for (const textNode of textNodes) {
      const text = textNode.textContent ?? '';
      urlRe.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = urlRe.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        // Remove pontuação final que não faz parte da URL
        const href = m[0].replace(/[.,;:!?)"'\]]+$/, '');
        const tail = m[0].slice(href.length);
        const a = document.createElement('a');
        a.href = href; a.textContent = href;
        a.target = '_blank'; a.rel = 'noopener noreferrer';
        frag.appendChild(a);
        if (tail) frag.appendChild(document.createTextNode(tail));
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode?.replaceChild(frag, textNode);
    }

    result = container.innerHTML;
  }

  // ── 3. Regex pós-DOM ─────────────────────────────────────────────────────

  // Remove spans vazios/<br> imediatamente após desc-label
  result = result
    .replace(
      /(<span class="desc-label">[^<]*<\/span>)(?:\s*<span[^>]*>(?:&nbsp;|\s|<br\s*\/?>)*<\/span>)*/g,
      '$1'
    )
    .replace(/(<span class="desc-label">[^<]*<\/span>)\s*<br\s*\/?>/g, '$1');

  // Mescla <p> que contém apenas rótulo com o próximo <p>
  // (permite spans vazios opcionais entre o rótulo e </p>)
  result = result.replace(
    /<p([^>]*)>\s*(<span class="desc-label">[^<]*<\/span>)(?:\s*<span[^>]*>[\s\u00a0]*<\/span>)*\s*<\/p>\s*<p[^>]*>/g,
    '<p$1>$2 '
  );

  // Detecção em div[dir="auto"] com texto plano (espaço após : é opcional)
  result = result
    .replace(/(<div[^>]*>)([^<:]{1,60}):(?!\/\/)[\s\u00a0]?/g,
      '$1<span class="desc-label">$2:</span> ')
    .replace(/(<br\s*\/?>)([^<:]{1,60}):(?!\/\/)[\s\u00a0]?/g,
      '$1<span class="desc-label">$2:</span> ')
    .replace(/(<div class="section-divider"><\/div>)([^<:]{1,60}):(?!\/\/)[\s\u00a0]?/g,
      '$1<span class="desc-label">$2:</span> ');

  return result;
}

export const MarkdownRenderer: React.FC<Props> = ({ html, className = '', compact = false }) => {
  const content = compact ? cleanHtml(html) : html;
  return (
    <div
      className={`markdown-body ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};
