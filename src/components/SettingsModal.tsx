import React from 'react';
import { RepoMappingConfig } from './RepoMappingConfig';
import type { ViewTab } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  // Props para ViewManager (não usado ainda, mas mantido para compatibilidade)
  views?: any[];
  onSaveViews?: (views: any[]) => void;
  allStatuses?: string[];
  allLabels: string[];
  // Props para RepoMapping
  org: string;
  token: string;
  availableViews: ViewTab[];
}

export const SettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  allLabels,
  org,
  token,
  availableViews
}) => {
  // Renderiza os modais completos individualmente com base na tab ativa
  if (!isOpen) return null;

  // Por enquanto, apenas o RepoMappingConfig
  // Pode adicionar activeTab no futuro para alternar entre views e repos
  return (
    <RepoMappingConfig
      isOpen={isOpen}
      onClose={onClose}
      availableTags={allLabels}
      org={org}
      token={token}
      availableViews={availableViews}
    />
  );
};
