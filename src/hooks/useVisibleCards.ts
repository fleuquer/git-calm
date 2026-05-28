import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook para rastrear quais cards estão visíveis na viewport
 * Usa IntersectionObserver para detectar quando cards aparecem/desaparecem da tela
 */
export function useVisibleCards() {
  const [visibleCardNumbers, setVisibleCardNumbers] = useState<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardElementsRef = useRef<Map<number, Element>>(new Map());

  // Inicializar o IntersectionObserver
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisibleCardNumbers((prev) => {
          const updated = new Set(prev);

          entries.forEach((entry) => {
            const cardNumber = parseInt(entry.target.getAttribute('data-card-number') || '0', 10);

            if (entry.isIntersecting) {
              // Card entrou na viewport
              updated.add(cardNumber);
            } else {
              // Card saiu da viewport
              updated.delete(cardNumber);
            }
          });

          return updated;
        });
      },
      {
        // Configuração: carregar quando o card estiver 10% visível
        threshold: 0.1,
        // Adicionar margem para começar a carregar antes do card aparecer
        rootMargin: '50px',
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Função para observar um elemento de card
  const observeCard = useCallback((element: Element | null, cardNumber: number) => {
    if (!element || !observerRef.current) return;

    // Remover observação anterior se existir
    const existingElement = cardElementsRef.current.get(cardNumber);
    if (existingElement) {
      observerRef.current.unobserve(existingElement);
    }

    // Adicionar atributo data para identificar o card
    element.setAttribute('data-card-number', cardNumber.toString());

    // Observar novo elemento
    observerRef.current.observe(element);
    cardElementsRef.current.set(cardNumber, element);
  }, []);

  // Função para parar de observar um card
  const unobserveCard = useCallback((cardNumber: number) => {
    const element = cardElementsRef.current.get(cardNumber);
    if (element && observerRef.current) {
      observerRef.current.unobserve(element);
      cardElementsRef.current.delete(cardNumber);

      setVisibleCardNumbers((prev) => {
        const updated = new Set(prev);
        updated.delete(cardNumber);
        return updated;
      });
    }
  }, []);

  // Limpar tudo
  const clearAll = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    cardElementsRef.current.clear();
    setVisibleCardNumbers(new Set());
  }, []);

  return {
    visibleCardNumbers: Array.from(visibleCardNumbers),
    observeCard,
    unobserveCard,
    clearAll,
  };
}
