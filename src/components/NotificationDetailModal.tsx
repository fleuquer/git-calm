import React, { useState, useEffect, useCallback } from 'react';
import {
  X, AtSign, MessageCircle, UserCheck, Bell, ExternalLink,
  ChevronLeft, ChevronRight, GitPullRequest, AlertCircle, RefreshCw,
} from 'lucide-react';
import type { GithubNotification } from '../hooks/useGithubNotifications';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Props {
  queue: GithubNotification[];
  token: string;
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onOpenCard: (notification: GithubNotification) => void;
}

function getReasonIcon(reason: string) {
  switch (reason) {
    case 'mention':
    case 'team_mention':
      return <AtSign size={20} className="text-purple-500" />;
    case 'comment':
      return <MessageCircle size={20} className="text-blue-500" />;
    case 'assign':
      return <UserCheck size={20} className="text-green-500" />;
    case 'review_requested':
      return <GitPullRequest size={20} className="text-orange-500" />;
    default:
      return <Bell size={20} className="text-gray-400" />;
  }
}

function getReasonLabel(reason: string): string {
  switch (reason) {
    case 'mention': return 'Você foi mencionado';
    case 'team_mention': return 'Seu time foi mencionado';
    case 'comment': return 'Novo comentário';
    case 'assign': return 'Você foi atribuído';
    case 'review_requested': return 'Revisão solicitada';
    case 'subscribed': return 'Atualização';
    default: return 'Nova notificação';
  }
}

function getAccentClass(reason: string): string {
  switch (reason) {
    case 'mention':
    case 'team_mention':
      return 'border-purple-400 dark:border-purple-500';
    case 'comment':
      return 'border-blue-400 dark:border-blue-500';
    case 'assign':
      return 'border-green-400 dark:border-green-500';
    default:
      return 'border-gray-300 dark:border-gray-600';
  }
}

function getDotClass(reason: string): string {
  switch (reason) {
    case 'mention':
    case 'team_mention':
      return 'bg-purple-500';
    case 'comment':
      return 'bg-blue-500';
    case 'assign':
      return 'bg-green-500';
    default:
      return 'bg-gray-400';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export function NotificationDetailModal({ queue, token, onDismiss, onDismissAll, onOpenCard }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [commentBodyHtml, setCommentBodyHtml] = useState<string | null>(null);
  const [isLoadingBody, setIsLoadingBody] = useState(false);
  const [bodyError, setBodyError] = useState(false);

  const current = queue[Math.min(currentIndex, queue.length - 1)];

  // Ajusta índice se fila encolher
  useEffect(() => {
    if (currentIndex >= queue.length && queue.length > 0) {
      setCurrentIndex(queue.length - 1);
    }
  }, [queue.length, currentIndex]);

  // Busca o corpo do comentário/menção quando muda o item
  useEffect(() => {
    if (!current || !token) return;

    const url = current.latestCommentUrl || current.subjectUrl;
    if (!url) { setCommentBodyHtml(null); return; }

    let cancelled = false;
    setIsLoadingBody(true);
    setCommentBodyHtml(null);
    setBodyError(false);

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        // body_html vem renderizado pelo GitHub (Accept: application/vnd.github.html não é necessário —
        // a API REST já inclui body_html no payload padrão de issues/comments)
        setCommentBodyHtml(data?.body_html || null);
      })
      .catch(() => {
        if (!cancelled) setBodyError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingBody(false);
      });

    return () => { cancelled = true; };
  }, [current?.id, token]);

  const handleOpenCard = useCallback(() => {
    if (!current) return;
    onOpenCard(current);
    onDismiss(current.id);
  }, [current, onOpenCard, onDismiss]);

  const handleDismissCurrent = useCallback(() => {
    if (!current) return;
    onDismiss(current.id);
  }, [current, onDismiss]);

  const goNext = useCallback(() => {
    setCurrentIndex(i => (i + 1) % queue.length);
  }, [queue.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex(i => (i - 1 + queue.length) % queue.length);
  }, [queue.length]);

  if (queue.length === 0) return null;

  const accentClass = getAccentClass(current.reason);
  const dotClass = getDotClass(current.reason);
  const MAX_DOTS = 8;

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleDismissCurrent}
      />

      {/* Modal */}
      <div
        className={`relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border-2 ${accentClass} overflow-hidden`}
        onClick={e => e.stopPropagation()}
      >
        {/* Indicador de fila */}
        {queue.length > 1 && (
          <div className="flex items-center justify-between px-4 pt-3">
            <div className="flex items-center gap-1.5">
              {queue.slice(0, MAX_DOTS).map((n, i) => (
                <button
                  key={n.id}
                  onClick={() => setCurrentIndex(i)}
                  className={`rounded-full transition-all duration-200 ${
                    i === currentIndex
                      ? `w-4 h-2 ${dotClass}`
                      : 'w-2 h-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                  }`}
                  title={n.title}
                />
              ))}
              {queue.length > MAX_DOTS && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-0.5">
                  +{queue.length - MAX_DOTS}
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">
              {currentIndex + 1} de {queue.length}
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-2">
          <div className="shrink-0 mt-0.5">
            {getReasonIcon(current.reason)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
              {getReasonLabel(current.reason)}
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
              {current.title}
            </p>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1">
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {current.repoFullName}
              </span>
              {current.issueNumber && (
                <>
                  <span className="text-[11px] text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    #{current.issueNumber}
                  </span>
                </>
              )}
              <span className="text-[11px] text-gray-300 dark:text-gray-600">·</span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {timeAgo(current.updatedAt)}
              </span>
            </div>
          </div>

          {/* Botão fechar */}
          <button
            onClick={handleDismissCurrent}
            className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Corpo do comentário/menção */}
        <div className="mx-4 mb-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 overflow-hidden">
          {isLoadingBody ? (
            <div className="flex items-center gap-2 px-4 py-6 text-xs text-gray-400">
              <RefreshCw size={13} className="animate-spin" />
              Carregando conteúdo...
            </div>
          ) : bodyError ? (
            <div className="flex items-center gap-2 px-4 py-4 text-xs text-red-400">
              <AlertCircle size={13} />
              Não foi possível carregar o conteúdo.
            </div>
          ) : commentBodyHtml ? (
            <div className="px-4 py-3 max-h-64 overflow-y-auto">
              <MarkdownRenderer html={commentBodyHtml} className="text-sm" />
            </div>
          ) : (
            <div className="px-4 py-4 text-xs text-gray-400 dark:text-gray-500 italic">
              Sem prévia disponível — abra o card para ver o contexto completo.
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 px-4 pb-4 flex-wrap">
          {/* Prev / Next */}
          {queue.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Anterior"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                onClick={goNext}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Próxima"
              >
                <ChevronRight size={15} />
              </button>
            </>
          )}

          {/* Abrir card no sistema */}
          <button
            onClick={handleOpenCard}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
          >
            Abrir card
          </button>

          {/* Dispensar */}
          <button
            onClick={handleDismissCurrent}
            className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {queue.length > 1 ? 'Pular' : 'Fechar'}
          </button>

          {/* GitHub ↗ */}
          {current.subjectHtmlUrl && (
            <a
              href={current.subjectHtmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              title="Abrir no GitHub"
            >
              <ExternalLink size={12} />
              GitHub
            </a>
          )}

          {/* Fechar todas */}
          {queue.length > 1 && (
            <button
              onClick={onDismissAll}
              className="ml-auto text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              Fechar todas ({queue.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
